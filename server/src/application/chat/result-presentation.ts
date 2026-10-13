import type { ResultCharacter, ResultPresentation } from '../../domain/chat/structured-result.js';
import { officialCharacterAsset } from '../character-catalog/catalog-asset-url.js';
import type { GachaPullResult } from '../gacha/gacha-store.js';
import type { PlayerTeam } from '../team/team-store.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { standalonePullSummary } from './gacha-command-result.js';

export type PresentationSink = (value: ResultPresentation, operationId?: string) => boolean | void;
export function resultCharacter(c: { id: string; name: string; iconPath?: string | null; rarity?: number | null; constellation?: number | null; elementKey?: string | null }, extra: Partial<ResultCharacter> = {}): ResultCharacter {
  return { id: c.id, name: c.name, portrait: officialCharacterAsset(c.iconPath ?? null), rarity: c.rarity === 4 || c.rarity === 5 ? c.rarity : null, constellation: c.constellation ?? null, ...(c.elementKey && isElementKey(c.elementKey) ? { elementKey: c.elementKey } : {}), ...extra };
}
export function pullPresentation(result: GachaPullResult): ResultPresentation {
  return { command: 'pull', title: `Invocation ×${result.operation.pullCount}`, compact: true, characters: result.results.flatMap(row => {
    const pity = row.rarity === 5 ? row.pity5AtPull : row.pity4AtPull;
    return row.character ? [resultCharacter(row.character, { constellation: row.constellationAfter, isNew: row.wasNewCharacter ?? false, ...(pity != null ? { pity } : {}), ...(row.bonusRewards.some(r => r.causeKey === 'gacha.c6-duplicate-refund') ? { label: 'Déjà C6 · remboursement inclus' } : {}) })] : [];
  }), facts: standalonePullSummary(result).facts };
}
export function teamPresentation(team: PlayerTeam): ResultPresentation {
  return { command: 'team', title: `${team.name ?? `Team ${team.position}`} · composition à la commande`, characters: team.slots.flatMap(slot => slot.character ? [resultCharacter(slot.character)] : []), facts: team.passives.map(p => `${p.displayName} : ${p.description}`) };
}
