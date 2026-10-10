import { randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { eventDrawPosition, eventDrawTotal, eventDrawWinner, type EventDrawParticipant } from '../../domain/event/monthly-draw.js';
import { creditMasterlessStellaFortuna } from '../../infrastructure/database/prisma-box-store.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { lockPlayerMutation } from '../player/player-mutation-guard.js';
import { assertPlayerDomainReady } from '../player/player-recovery-readiness.js';
import type { EventService } from './event-service.js';

/** Private entropy reservation -> sealed edition -> atomic reward/result. A failed
 * credit never changes the sealed winner, and never publishes a completed result. */
export class EventMonthlyDrawService {
  constructor(private readonly db: PrismaClient, private readonly clock: Clock,
    private readonly entropy: () => string = () => randomBytes(32).toString('hex')) {}

  async catchUp() {
    const activation = await this.db.eventDrawActivation.findUniqueOrThrow({ where: { id: 'R1053' } });
    const editions = await this.db.eventEdition.findMany({ where: {
      startsAt: { gte: activation.firstEditionStartsAt }, endsAt: { lte: this.clock.now(), gt: activation.activatedAt },
      OR: [{ monthlyDraw: null }, { monthlyDraw: { status: { in: ['PENDING', 'FROZEN'] } } }],
    }, orderBy: [{ endsAt: 'asc' }, { id: 'asc' }], take: 24, select: { id: true } });
    for (const edition of editions) await this.processEdition(edition.id);
    return editions.length;
  }

  async processEdition(editionId: string) {
    let reservedSeed: string | undefined;
    // Entropy is committed before any selection. An aborted seal reuses this seed.
    await this.retry(async tx => {
      const edition = await this.lockEdition(tx, editionId);
      const activation = await tx.eventDrawActivation.findUniqueOrThrow({ where: { id: 'R1053' } });
      if (edition.startsAt < activation.firstEditionStartsAt || edition.endsAt <= activation.activatedAt || edition.endsAt > this.clock.now()) throw new Error('EVENT_DRAW_EDITION_NOT_ELIGIBLE');
      if (await tx.eventMonthlyDraw.findUnique({ where: { eventEditionId: editionId } })) return;
      const seed = reservedSeed ??= this.entropy();
      if (!/^[a-f0-9]{64}$/u.test(seed)) throw new Error('EVENT_DRAW_INVALID_ENTROPY');
      await tx.eventMonthlyDraw.create({ data: { eventEditionId: editionId, activationId: activation.id, closesAt: edition.endsAt, entropySeed: seed } });
    });
    await this.retry(async tx => {
      const edition = await this.lockEdition(tx, editionId);
      const draw = await tx.eventMonthlyDraw.findUniqueOrThrow({ where: { eventEditionId: editionId } });
      if (draw.status !== 'PENDING') return;
      const entries = await tx.eventParticipant.findMany({ where: { eventEditionId: editionId, points: { gt: 0 }, player: { status: { not: 'ARCHIVED' } } }, orderBy: { playerId: 'asc' }, select: { playerId: true, points: true } });
      const population = entries.map(entry => ({ playerId: entry.playerId, points: entry.points.toString() }));
      const total = eventDrawTotal(population), now = this.clock.now();
      if (edition.endsAt > now) throw new Error('EVENT_DRAW_EDITION_NOT_CLOSED');
      await tx.eventEdition.update({ where: { id: editionId }, data: { status: 'FINISHED' } });
      await tx.eventMonthlyDraw.update({ where: { eventEditionId: editionId }, data: { population, totalTickets: total.toString(), frozenAt: now,
        ...(total ? { status: 'FROZEN', ticketIndex: eventDrawPosition(draw.entropySeed, total).toString() } : { status: 'NO_ELIGIBLE', completedAt: now }) } });
      if (!total) await this.notifyAdmins(tx, editionId, { editionId, festival: festivalName(edition.snapshot), winnerPlayerId: null, tickets: '0', stellaGranted: false }, now);
    });
    return this.retry(async tx => {
      const edition = await this.lockEdition(tx, editionId);
      const draw = await tx.eventMonthlyDraw.findUniqueOrThrow({ where: { eventEditionId: editionId } });
      if (draw.status !== 'FROZEN') return draw;
      const population = draw.population as unknown as EventDrawParticipant[];
      const total = eventDrawTotal(population);
      if (draw.totalTickets?.toFixed(0) !== total.toString() || !draw.ticketIndex) throw new Error('EVENT_DRAW_FROZEN_RESULT_INVALID');
      const winnerPlayerId = eventDrawWinner(population, BigInt(draw.ticketIndex.toFixed(0))), now = this.clock.now();
      await lockPlayerMutation(tx, winnerPlayerId);
      await assertPlayerDomainReady(tx, winnerPlayerId, 'EVENT');
      const winner = await tx.player.findUniqueOrThrow({ where: { id: winnerPlayerId }, select: { displayName: true } });
      const operation = await tx.businessOperation.create({ data: { playerId: winnerPlayerId, operationType: 'event.monthly-draw.reward', sourceChannel: 'SYSTEM', idempotencyKey: `event-monthly-draw:${editionId}`, startedAt: now } });
      await creditMasterlessStellaFortuna(tx, { playerId: winnerPlayerId, amount: 1n, operationId: operation.id, sourceKey: 'EVENT_MONTHLY_DRAW', provenance: { editionId, ticketIndex: draw.ticketIndex.toFixed(0), totalTickets: total.toString() }, now });
      const festival = festivalName(edition.snapshot);
      const summary = { editionId, festival, winnerPlayerId, winnerName: winner.displayName,
        winnerTickets: population.find(entry => entry.playerId === winnerPlayerId)!.points, totalTickets: total.toString(), ticketIndex: draw.ticketIndex.toFixed(0), stellaGranted: true, operationId: operation.id };
      await tx.notification.create({ data: { playerId: winnerPlayerId, domainKey: 'event', typeKey: 'EVENT_MONTHLY_DRAW_WON', deduplicationKey: `event-draw-won:${editionId}`, payload: { editionId, title: festival, message: `🏆 Tu remportes le tirage du ${festival} ! ✨ +1 Masterless Stella Fortuna` }, createdAt: now } });
      await this.notifyAdmins(tx, editionId, summary, now);
      await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now, resultSummary: summary } });
      return tx.eventMonthlyDraw.update({ where: { eventEditionId: editionId }, data: { status: 'COMPLETED', winnerPlayerId, operationId: operation.id, completedAt: now } });
    });
  }

  private async lockEdition(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM event_editions WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.eventEdition.findUniqueOrThrow({ where: { id } });
  }
  private async retry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }); }
      catch (error) { if (attempt < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
  private async notifyAdmins(tx: Prisma.TransactionClient, editionId: string, payload: Prisma.InputJsonObject, now: Date) {
    const admins = await tx.playerRoleAssignment.findMany({ where: { role: 'ADMIN', revokedAt: null, player: { status: 'ACTIVE' } }, select: { playerId: true }, distinct: ['playerId'] });
    const message = payload.stellaGranted ? `${payload.festival} : ${payload.winnerName} remporte +1 Masterless Stella Fortuna, attribution confirmée. ${payload.winnerTickets}/${payload.totalTickets} tickets. Édition ${editionId}, opération ${payload.operationId}.` : `${payload.festival} : clôture sans participant éligible, aucune Stella attribuée. Édition ${editionId}.`;
    for (const admin of admins) await tx.notification.create({ data: { playerId: admin.playerId, domainKey: 'event', typeKey: 'EVENT_MONTHLY_DRAW_ADMIN', deduplicationKey: `event-draw-admin:${editionId}:${admin.playerId}`, payload: { ...payload, title: 'Tirage mensuel Event — contrôle ADMIN', message }, createdAt: now } });
  }
}

function festivalName(snapshot: Prisma.JsonValue): string {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || typeof snapshot.displayName !== 'string') throw new Error('EVENT_DRAW_INVALID_EDITION_SNAPSHOT');
  return snapshot.displayName;
}

export class EventMonthlyDrawScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private running?: Promise<void>;
  private reportedActive = false;
  constructor(private readonly draws: Pick<EventMonthlyDrawService, 'catchUp'>,
    private readonly events: Pick<EventService, 'resolveCurrentEdition'>, private readonly db: PrismaClient,
    private readonly clock: Clock, private readonly onEvent: (event: { status: string; processed?: number; error?: unknown }) => void = console.info) {}
  async start() { this.stopped = false; await this.tick(); }
  async stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.timer = undefined; await this.running; }
  private async tick() {
    if (this.stopped || this.running) return;
    this.running = this.run();
    try { await this.running; } finally { this.running = undefined; }
  }
  private async run() {
    let delay = 60_000;
    try {
      const context = await this.events.resolveCurrentEdition(this.db, this.clock.now());
      const processed = await this.draws.catchUp();
      if (!this.reportedActive || processed) this.onEvent({ status: 'EVENT_MONTHLY_DRAW_SCHEDULER_ACTIVE', processed });
      this.reportedActive = true;
      delay = Math.min(delay, Math.max(1, context.edition.endsAt.getTime() - this.clock.now().getTime()));
    } catch (error) {
      // Never dump Prisma arguments containing private entropy or population.
      this.onEvent({ status: 'EVENT_MONTHLY_DRAW_SCHEDULER_RETRY', error: { name: error instanceof Error ? error.name : 'UnknownError',
        code: error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : undefined } });
    }
    if (!this.stopped) { this.timer = setTimeout(() => { this.timer = undefined; void this.tick(); }, delay); this.timer.unref?.(); }
  }
}
