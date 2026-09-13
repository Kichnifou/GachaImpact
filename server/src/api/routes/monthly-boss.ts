import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { MonthlyBossService, MonthlyBossView } from '../../application/combat/monthly-boss-service.js';
import type { PlayerResourceBalances } from '../../application/player/player-resource-store.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { toPlayerResourcesDto } from '../serializers/gameplay.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: MonthlyBossService }>;
const slotParams = z.object({ position: z.coerce.number().int().min(1).max(4) }).strict();
const slotBody = z.object({ characterId: z.string().uuid() }).strict();
const bossParams = z.object({ bossId: z.string().uuid() }).strict();
const attackBody = z.object({ bossId: z.string().uuid(), idempotencyKey: z.string().uuid() }).strict();
const historyQuery = z.object({ page: z.coerce.number().int().min(1).default(1) }).strict();

export const registerMonthlyBossRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get('/api/v1/me/combat/boss', { preHandler: options.authenticate }, async (request) => serializeView(await options.service.getCurrent(requireAuthenticatedIdentity(request))));
  app.put('/api/v1/me/combat/boss/loadout/slots/:position', { preHandler: options.authenticate }, async (request) => {
    const params = parse(slotParams, request.params); const body = parse(slotBody, request.body);
    return serializeView(await options.service.setSlot(requireAuthenticatedIdentity(request), params.position, body.characterId));
  });
  app.delete('/api/v1/me/combat/boss/loadout/slots/:position', { preHandler: options.authenticate }, async (request) => {
    const params = parse(slotParams, request.params);
    return serializeView(await options.service.removeSlot(requireAuthenticatedIdentity(request), params.position));
  });
  app.post('/api/v1/me/combat/boss/loadout/copy-active-team', { preHandler: options.authenticate }, async (request) => serializeView(await options.service.copyActiveTeam(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/combat/boss/loadout/clear', { preHandler: options.authenticate }, async (request) => serializeView(await options.service.clearLoadout(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/combat/boss/attack', { preHandler: options.authenticate }, async (request) => {
    const body = parse(attackBody, request.body);
    const result = await options.service.attack(requireAuthenticatedIdentity(request), body.bossId, body.idempotencyKey);
    return { operation: result.operation, result: { ...result.result, damage: result.result.damage.toString() }, view: serializeView(result.view), resources: toPlayerResourcesDto(result.resources as PlayerResourceBalances) };
  });
  app.get('/api/v1/combat/boss/:bossId/ranking', async (request) => {
    const params = parse(bossParams, request.params);
    const result = await options.service.getRanking(params.bossId);
    return { boss: { ...result.boss, defeatedAt: result.boss.defeatedAt?.toISOString() ?? null }, ranking: result.ranking.map(serializeRanking) };
  });
  app.get('/api/v1/combat/boss/history', async (request) => {
    const query = parse(historyQuery, request.query);
    const result = await options.service.getHistory(query.page);
    return { ...result, bosses: result.bosses.map((boss) => ({ ...boss, maxHp: boss.maxHp.toString(), currentHp: boss.currentHp.toString(), defeatedAt: boss.defeatedAt?.toISOString() ?? null })) };
  });
};

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('La requête Boss est invalide.', 400, 'VALIDATION_ERROR');
  return result.data;
}

function serializeView(view: MonthlyBossView) {
  return {
    ...view,
    boss: { ...view.boss, baseHp: view.boss.baseHp.toString(), maxHp: view.boss.maxHp.toString(), currentHp: view.boss.currentHp.toString(), defeatedAt: view.boss.defeatedAt?.toISOString() ?? null, nextBaseAdjustment: view.boss.nextBaseAdjustment?.toString() ?? null },
    loadout: { slots: view.loadout.slots.map((slot) => ({ ...slot, character: slot.character ? serializeCharacter(slot.character) : null })) },
    availableCharacters: view.availableCharacters.map(serializeCharacter),
    preview: view.preview ? { totalDamage: view.preview.totalDamage.toString(), contributions: view.preview.contributions.map((item) => ({ ...item, damageBeforeResistance: item.damageBeforeResistance.toString(), damage: item.damage.toString() })) } : null,
    reward: { primogems: view.reward.primogems.toString(), moras: view.reward.moras.toString() },
    participation: view.participation ? { ...view.participation, totalDamage: view.participation.totalDamage.toString(), attackCount: view.participation.attackCount.toString(), bestHit: view.participation.bestHit.toString() } : null,
    ranking: view.ranking.map(serializeRanking),
    playerStats: Object.fromEntries(Object.entries(view.playerStats).map(([key, value]) => [key, value.toString()])),
  };
}

function serializeCharacter(character: MonthlyBossView['availableCharacters'][number]) { return { ...character, firstObtainedAt: character.firstObtainedAt.toISOString() }; }
function serializeRanking(entry: MonthlyBossView['ranking'][number]) { return { ...entry, totalDamage: entry.totalDamage.toString(), attackCount: entry.attackCount.toString(), bestHit: entry.bestHit.toString() }; }
