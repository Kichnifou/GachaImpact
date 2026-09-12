import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { CombatService } from '../../application/combat/daily-combat-service.js';
import type { DailyCombatView } from '../../application/combat/daily-combat-store.js';
import type { PlayerResourceBalances } from '../../application/player/player-resource-store.js';
import { toPlayerResourcesDto } from '../serializers/gameplay.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: CombatService }>;
const slotParams = z.object({ position: z.coerce.number().int().min(1).max(4) }).strict();
const slotBody = z.object({ characterId: z.string().uuid() }).strict();
const fightBody = z.object({ idempotencyKey: z.string().uuid() }).strict();

export const registerDailyCombatRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get('/api/v1/me/combat/daily', { preHandler: options.authenticate }, async (request) => serializeView(await options.service.getDaily(requireAuthenticatedIdentity(request))));
  app.put('/api/v1/me/combat/daily/loadout/:position', { preHandler: options.authenticate }, async (request) => {
    const params = parse(slotParams, request.params); const body = parse(slotBody, request.body);
    return serializeView(await options.service.setSlot(requireAuthenticatedIdentity(request), params.position, body.characterId));
  });
  app.delete('/api/v1/me/combat/daily/loadout/:position', { preHandler: options.authenticate }, async (request) => {
    const params = parse(slotParams, request.params);
    return serializeView(await options.service.removeSlot(requireAuthenticatedIdentity(request), params.position));
  });
  app.post('/api/v1/me/combat/daily/loadout/copy-active', { preHandler: options.authenticate }, async (request) => serializeView(await options.service.copyActiveTeam(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/combat/daily/loadout/auto', { preHandler: options.authenticate }, async (request) => serializeView(await options.service.autoSelect(requireAuthenticatedIdentity(request))));
  app.delete('/api/v1/me/combat/daily/loadout', { preHandler: options.authenticate }, async (request) => serializeView(await options.service.clearLoadout(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/combat/daily/fight', { preHandler: options.authenticate }, async (request) => {
    const body = parse(fightBody, request.body); const result = await options.service.fight(requireAuthenticatedIdentity(request), body.idempotencyKey);
    return { operation: result.operation, result: result.result, view: serializeView(result.view), resources: toPlayerResourcesDto(result.resources as PlayerResourceBalances) };
  });
};

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('La requête Combat est invalide.', 400, 'VALIDATION_ERROR');
  return result.data;
}

function serializeView(view: DailyCombatView) {
  return {
    ...view,
    reward: { primogems: view.reward.primogems.toString(), moras: view.reward.moras.toString() },
    availableCharacters: view.availableCharacters.map(serializeCharacter),
    loadout: { ...view.loadout, slots: view.loadout.slots.map((slot) => ({ ...slot, character: slot.character ? serializeCharacter(slot.character) : null })) },
    lastAttempt: view.lastAttempt ? { ...view.lastAttempt, createdAt: view.lastAttempt.createdAt.toISOString() } : null,
    playerStats: Object.fromEntries(Object.entries(view.playerStats).map(([key, value]) => [key, value.toString()])),
  };
}

function serializeCharacter(character: DailyCombatView['availableCharacters'][number]) {
  return {
    ...character,
    firstObtainedAt: character.firstObtainedAt.toISOString(),
    combatStats: { ...character.combatStats, fights: character.combatStats.fights.toString(), wins: character.combatStats.wins.toString(), losses: character.combatStats.losses.toString() },
  };
}
