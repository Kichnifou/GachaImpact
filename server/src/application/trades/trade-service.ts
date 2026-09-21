import { Prisma, type PrismaClient, type SourceChannel } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { BusinessError } from '../errors.js';
import { isElementKey, particleResourceKey } from '../../domain/economy/resources.js';
import { getNextBusinessResetAt, type Clock } from '../../domain/time/business-date.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';
import { unblockedRecipient } from '../social/contact-permission.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { expireTrades, particleStock, reconcileParticleTrades, refreshTradeNotification } from './trade-state.js';

export type TradeSource = Extract<SourceChannel, 'UI' | 'INTERNAL_CHAT' | 'TWITCH'>;
export type TradeAction = 'accept' | 'refuse' | 'cancel';
type Result = { requestId: string; state: string; amount: string };
const unavailable = () => new AppError('Cet échange est indisponible.', 409, 'TRADE_UNAVAILABLE');
const identity = { id: true, displayName: true, elementKey: true } as const;
const include = { sender: { select: identity }, recipient: { select: identity } } as const;

export class TradeService {
  private readonly economy: PrismaEconomyService;
  constructor(private readonly database: PrismaClient, private readonly clock: Clock,
    economy?: PrismaEconomyService, private readonly activity = new PlayerActivityRecorder()) {
    this.economy = economy ?? new PrismaEconomyService(() => clock.now());
  }
  private async transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('particles:trades'))`;
          await expireTrades(tx, this.clock.now());
          return run(tx);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) { if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
  private async lockPlayers(tx: Prisma.TransactionClient, ids: string[]) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join([...new Set(ids)].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  }
  private async lockResources(tx: Prisma.TransactionClient, ids: string[], resources: string[]) {
    const rows = await tx.$queryRaw<{ player_id: string; resource_key: string }[]>(Prisma.sql`SELECT player_id, resource_key FROM player_resource_balances
      WHERE player_id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) AND resource_key IN (${Prisma.join(resources)})
      ORDER BY player_id, resource_key FOR UPDATE`);
    if (rows.length !== 4) throw unavailable();
  }
  private async actor(tx: Prisma.TransactionClient, id: string) {
    const player = await tx.player.findFirst({ where: { id, status: 'ACTIVE' }, select: identity });
    if (!player || !player.elementKey || !isElementKey(player.elementKey)) throw unavailable();
    return { ...player, elementKey: player.elementKey };
  }
  private async pair(tx: Prisma.TransactionClient, senderId: string, recipientId: string) {
    const sender = await this.actor(tx, senderId);
    const recipient = await tx.player.findFirst({ where: { AND: [{ id: recipientId }, unblockedRecipient(senderId)] }, select: identity });
    if (!recipient?.elementKey || !isElementKey(recipient.elementKey) || recipient.elementKey === sender.elementKey) throw unavailable();
    return { sender, recipient, senderResource: particleResourceKey(recipient.elementKey), recipientResource: particleResourceKey(sender.elementKey) };
  }
  private async operation(tx: Prisma.TransactionClient, playerId: string, key: string, source: TradeSource, action: string, target: string) {
    if (!['UI', 'INTERNAL_CHAT', 'TWITCH'].includes(source)) throw unavailable();
    const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: source, idempotencyKey: key } });
    if (existing) {
      const summary = existing.resultSummary as { target: string; result?: Result; ids?: string[]; results?: Result[] };
      if (existing.playerId !== playerId || existing.operationType !== `trades.${action}` || summary?.target !== target) throw new AppError('Cette clé appartient à une autre action.', 409, 'TRADE_IDEMPOTENCY_CONFLICT');
      return { row: existing, summary };
    }
    const row = await tx.businessOperation.create({ data: { playerId, operationType: `trades.${action}`, sourceChannel: source, idempotencyKey: key, resultSummary: { target }, startedAt: this.clock.now() } });
    return { row, summary: { target } as { target: string; result?: Result; ids?: string[]; results?: Result[] } };
  }
  private async complete(tx: Prisma.TransactionClient, operationId: string, target: string, result: Result) {
    await tx.businessOperation.update({ where: { id: operationId }, data: { status: 'COMPLETED', completedAt: this.clock.now(), resultSummary: { target, result } } });
    return result;
  }
  private async record(tx: Prisma.TransactionClient, id: string, source: TradeSource) {
    await this.activity.record(tx, id, this.clock.now(), source === 'TWITCH' ? 'TWITCH' : source === 'INTERNAL_CHAT' ? 'INTERNAL_CHAT' : 'APPLICATION');
  }
  async create(senderId: string, recipientId: string, amount: bigint | undefined, key: string, source: TradeSource = 'UI'): Promise<Result> {
    if (senderId === recipientId || (amount !== undefined && amount <= 0n)) throw unavailable();
    return this.transaction(async tx => {
      await this.lockPlayers(tx, [senderId, recipientId]);
      await this.actor(tx, senderId);
      const target = `${recipientId}:${amount ?? 'MAX'}`;
      const operation = await this.operation(tx, senderId, key, source, 'create', target);
      if (operation.summary.result) return operation.summary.result;
      const pair = await this.pair(tx, senderId, recipientId);
      await this.lockResources(tx, [senderId, recipientId], [pair.senderResource, pair.recipientResource]);
      if (await tx.tradeRequest.findFirst({ where: { state: 'PENDING', OR: [{ senderPlayerId: senderId, recipientPlayerId: recipientId }, { senderPlayerId: recipientId, recipientPlayerId: senderId }] } })) throw unavailable();
      const a = await particleStock(tx, senderId, pair.senderResource), b = await particleStock(tx, recipientId, pair.recipientResource);
      const maximum = a.available < b.available ? a.available : b.available;
      const quantity = amount ?? maximum;
      if (quantity <= 0n || quantity > maximum) throw new AppError('Le stock disponible est insuffisant.', 409, 'TRADE_INSUFFICIENT_STOCK');
      const now = this.clock.now();
      const request = await tx.tradeRequest.create({ data: { senderPlayerId: senderId, recipientPlayerId: recipientId, senderResourceKey: pair.senderResource, recipientResourceKey: pair.recipientResource, originalAmount: quantity, currentAmount: quantity, sourceChannel: source, operationId: operation.row.id, createdAt: now, updatedAt: now, expiresAt: getNextBusinessResetAt(now) } });
      // A new outgoing reservation can reduce incoming offers to its sender.
      await reconcileParticleTrades(tx, [senderId], now);
      await refreshTradeNotification(tx, recipientId, now, true);
      await this.record(tx, senderId, source);
      return this.complete(tx, operation.row.id, target, { requestId: request.id, state: request.state, amount: quantity.toString() });
    });
  }
  async mutate(playerId: string, requestId: string, action: TradeAction, key: string, source: TradeSource = 'UI'): Promise<Result> {
    return this.transaction(async tx => {
      const request = await tx.tradeRequest.findUnique({ where: { id: requestId } });
      if (!request || (action === 'cancel' ? request.senderPlayerId !== playerId : request.recipientPlayerId !== playerId)) throw unavailable();
      await this.lockPlayers(tx, [request.senderPlayerId, request.recipientPlayerId]);
      await this.actor(tx, playerId);
      const operation = await this.operation(tx, playerId, key, source, action, requestId);
      if (operation.summary.result) return operation.summary.result;
      if (request.state !== 'PENDING') return this.complete(tx, operation.row.id, requestId, { requestId, state: 'UNAVAILABLE', amount: '0' });
      const now = this.clock.now();
      const state = action === 'accept' ? 'ACCEPTED' : action === 'refuse' ? 'REFUSED' : 'CANCELLED';
      if (action === 'accept') {
        const pair = await this.pair(tx, request.senderPlayerId, request.recipientPlayerId);
        await this.lockResources(tx, [request.senderPlayerId, request.recipientPlayerId], [pair.senderResource, pair.recipientResource]);
        if (pair.senderResource !== request.senderResourceKey || pair.recipientResource !== request.recipientResourceKey) throw unavailable();
        const a = await particleStock(tx, request.senderPlayerId, request.senderResourceKey), b = await particleStock(tx, request.recipientPlayerId, request.recipientResourceKey);
        if (a.available + request.currentAmount < request.currentAmount || b.available < request.currentAmount) throw new AppError('Le stock disponible a changé.', 409, 'TRADE_STOCK_CHANGED');
        // Release exactly this reservation before the four audited transfer legs.
        await tx.tradeRequest.update({ where: { id: requestId }, data: { state, resolvedAt: now, updatedAt: now } });
        await this.economy.exchangeParticlesWithoutStats(tx, { senderId: request.senderPlayerId, recipientId: request.recipientPlayerId, senderResource: pair.senderResource, recipientResource: pair.recipientResource, amount: request.currentAmount, operationId: operation.row.id, sourceChannel: source });
        await tx.tradeExecution.create({ data: { tradeRequestId: requestId, amount: request.currentAmount, operationId: operation.row.id, executedAt: now } });
      } else await tx.tradeRequest.update({ where: { id: requestId }, data: { state, resolvedAt: now, updatedAt: now } });
      await refreshTradeNotification(tx, request.recipientPlayerId, now);
      await this.record(tx, playerId, source);
      return this.complete(tx, operation.row.id, requestId, { requestId, state, amount: request.currentAmount.toString() });
    });
  }
  async all(playerId: string, action: 'accept' | 'refuse', key: string, source: TradeSource = 'UI') {
    // Persist the initial ordered set. A retry must never include later arrivals.
    const batch = await this.transaction(async tx => {
      await this.lockPlayers(tx, [playerId]); await this.actor(tx, playerId);
      const op = await this.operation(tx, playerId, key, source, `${action}-all`, 'all');
      if (op.summary.ids) return { id: op.row.id, ids: op.summary.ids, results: op.summary.results };
      const ids = (await tx.tradeRequest.findMany({ where: { recipientPlayerId: playerId, state: 'PENDING' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })).map(r => r.id);
      await tx.businessOperation.update({ where: { id: op.row.id }, data: { resultSummary: { target: 'all', ids } } });
      return { id: op.row.id, ids, results: undefined };
    });
    if (batch.results) return { results: batch.results };
    const results: Result[] = [];
    let retryableFailure: unknown;
    for (const id of batch.ids) {
      try { results.push(await this.mutate(playerId, id, action, `${key}:${id}`, source)); }
      catch (error) {
        // Continue other independent transactions, but leave the batch unfinished
        // after an infrastructure failure so exact child keys can be replayed.
        if (!(error instanceof AppError) && !(error instanceof BusinessError)) retryableFailure = error;
        results.push({ requestId: id, state: 'UNAVAILABLE', amount: '0' });
      }
    }
    if (retryableFailure) throw retryableFailure;
    return this.transaction(async tx => {
      const existing = await tx.businessOperation.findUniqueOrThrow({ where: { id: batch.id } });
      const saved = (existing.resultSummary as { results?: Result[] }).results;
      if (saved) return { results: saved };
      await tx.businessOperation.update({ where: { id: batch.id }, data: { status: 'COMPLETED', completedAt: this.clock.now(), resultSummary: { target: 'all', ids: batch.ids, results } } });
      return { results };
    });
  }
  async expire() { await this.transaction(async () => undefined); }
  async snapshot(playerId: string) {
    return this.transaction(async tx => {
      await this.actor(tx, playerId);
      const balances = await tx.playerResourceBalance.findMany({ where: { playerId, resourceKey: { startsWith: 'particles_' } }, orderBy: { resourceKey: 'asc' } });
      const stocks = await Promise.all(balances.map(async balance => { const stock = await particleStock(tx, playerId, balance.resourceKey); return { resourceKey: balance.resourceKey, total: stock.total.toString(), reserved: stock.reserved.toString(), available: stock.available.toString() }; }));
      const where = { OR: [{ senderPlayerId: playerId }, { recipientPlayerId: playerId }] };
      const requests = await tx.tradeRequest.findMany({ where: { ...where, state: 'PENDING' }, include, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      const project = (r: typeof requests[number]) => ({ id: r.id, sender: r.sender, recipient: r.recipient, senderResourceKey: r.senderResourceKey, recipientResourceKey: r.recipientResourceKey, originalAmount: r.originalAmount.toString(), currentAmount: r.currentAmount.toString(), createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() });
      const history = await tx.tradeExecution.findMany({ where: { request: where }, include: { request: { include } }, orderBy: [{ executedAt: 'desc' }, { id: 'desc' }], take: 25 });
      return { stocks, received: requests.filter(r => r.recipientPlayerId === playerId).map(project), sent: requests.filter(r => r.senderPlayerId === playerId).map(project), history: history.map(h => ({ ...project(h.request), amount: h.amount.toString(), executedAt: h.executedAt.toISOString() })) };
    });
  }
  async partners(playerId: string, q = '', requestedPage = 1) {
    return this.transaction(async tx => {
      const actor = await this.actor(tx, playerId);
      const players = await tx.player.findMany({ where: { AND: [unblockedRecipient(playerId), { elementKey: { not: actor.elementKey } }] }, select: identity });
      const pending = await tx.tradeRequest.findMany({ where: { state: 'PENDING', OR: [{ senderPlayerId: playerId }, { recipientPlayerId: playerId }] }, select: { senderPlayerId: true, recipientPlayerId: true } });
      const paired = new Set(pending.flatMap(r => [r.senderPlayerId, r.recipientPlayerId]));
      const candidates = players.filter(p => p.elementKey && isElementKey(p.elementKey) && !paired.has(p.id) && normalizePlayerSearch(p.displayName).includes(normalizePlayerSearch(q)));
      const ids = [playerId, ...candidates.map(p => p.id)];
      const balances = await tx.playerResourceBalance.findMany({ where: { playerId: { in: ids }, resourceKey: { startsWith: 'particles_' } }, select: { playerId: true, resourceKey: true, amount: true } });
      const reservations = await tx.tradeRequest.groupBy({ by: ['senderPlayerId', 'senderResourceKey'], where: { senderPlayerId: { in: ids }, state: 'PENDING' }, _sum: { currentAmount: true } });
      const available = new Map(balances.map(row => [`${row.playerId}:${row.resourceKey}`, row.amount]));
      for (const row of reservations) { const key = `${row.senderPlayerId}:${row.senderResourceKey}`; available.set(key, (available.get(key) ?? 0n) - (row._sum.currentAmount ?? 0n)); }
      const rows = [];
      for (const player of candidates) {
        const a = available.get(`${playerId}:particles_${player.elementKey}`) ?? 0n, b = available.get(`${player.id}:${particleResourceKey(actor.elementKey)}`) ?? 0n;
        const max = a < b ? a : b;
        if (max > 0n) rows.push({ ...player, maximum: max.toString() });
      }
      rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
      const totalPages = Math.max(1, Math.ceil(rows.length / 10)), page = Math.min(totalPages, Math.max(1, requestedPage));
      return { partners: rows.slice((page - 1) * 10, page * 10), page, pageSize: 10, total: rows.length, totalPages };
    });
  }
}
