import { AsyncLocalStorage } from 'node:async_hooks';
import type { Clock } from '../../domain/time/business-date.js';
import type { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';

export type CommandSource = Extract<SourceChannel, 'INTERNAL_CHAT' | 'TWITCH'>;
export type CommandTargets = { bannerId?: string; gachaTargetId?: string | null; eventEditionId?: string;
  activeTeam?: { id: string | null; members: { position: number; characterId: string }[] };
  expedition?: { characterId: string | null; departedAt: string | null }; combat?: { encounterId: string; characterIds: string[] }; friendIds?: string[]; tradeIds?: string[] };
type Execution = CommandTargets & { now: Date; source: CommandSource; key?: string; responseBodyLimit?: number };
const execution = new AsyncLocalStorage<Execution>();

/** Server-internal scope: no client input, no global clock/config mutation. */
export function withPlayerCommandExecution<T>(context: Execution, action: () => T): T {
  return execution.run(context, action);
}
export function commandNow(clock: Clock): Date {
  return new Date(execution.getStore()?.now ?? clock.now());
}
export function commandSource<T extends SourceChannel | 'CHAT'>(fallback: T): T | CommandSource {
  return execution.getStore()?.source ?? fallback;
}
export function commandBannerId(): string | undefined { return execution.getStore()?.bannerId; }
export function commandResponseBodyLimit(): number | undefined { return execution.getStore()?.responseBodyLimit; }

export function commandKey(): string | undefined { return execution.getStore()?.key; }
export function commandTargets(): CommandTargets | undefined { return execution.getStore(); }
export async function assertCommandTargets(tx: Prisma.TransactionClient, playerId: string, kind: 'gacha' | 'team' | 'expedition') {
  const expected = commandTargets();
  if (!expected) return;
  const changed = () => new AppError('Le contexte de cette action a changé. Envoie une nouvelle commande.', 409, 'COMMAND_CONTEXT_CHANGED');
  if (kind === 'gacha' && expected.gachaTargetId !== undefined) {
    const state = await tx.playerGachaState.findUnique({ where: { playerId }, select: { selectedBannerCharacterId: true } });
    if (state?.selectedBannerCharacterId !== expected.gachaTargetId) throw changed();
  }
  if ((kind === 'gacha' || kind === 'team') && expected.activeTeam) {
    const team = await tx.team.findFirst({ where: { playerId, isActive: true }, select: { id: true, members: { select: { position: true, characterId: true }, orderBy: { position: 'asc' } } } });
    if (JSON.stringify({ id: team?.id ?? null, members: team?.members ?? [] }) !== JSON.stringify(expected.activeTeam)) throw changed();
  }
  if (kind === 'expedition' && expected.expedition) {
    const state = await tx.playerExpedition.findUnique({ where: { playerId }, select: { characterId: true, departedAt: true } });
    if (JSON.stringify({ characterId: state?.characterId ?? null, departedAt: state?.departedAt?.toISOString() ?? null }) !== JSON.stringify(expected.expedition)) throw changed();
  }
}
