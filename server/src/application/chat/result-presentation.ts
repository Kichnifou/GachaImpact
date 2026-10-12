import type { ResultCharacter, ResultPresentation } from '../../domain/chat/structured-result.js';
import { officialCharacterAsset } from '../character-catalog/catalog-asset-url.js';
import type { GachaPullResult } from '../gacha/gacha-store.js';
import type { PlayerTeam } from '../team/team-store.js';

export type PresentationSink = (value: ResultPresentation, operationId?: string) => void;
export function resultCharacter(c: { id: string; name: string; iconPath?: string | null; rarity?: number | null; constellation?: number | null }, extra: Partial<ResultCharacter> = {}): ResultCharacter {
  return { id: c.id, name: c.name, portrait: officialCharacterAsset(c.iconPath ?? null), rarity: c.rarity === 4 || c.rarity === 5 ? c.rarity : null, constellation: c.constellation ?? null, ...extra };
}
export function pullPresentation(result: GachaPullResult): ResultPresentation {
  const state = result.playerState;
  return { command: 'pull', title: `Invocation ×${result.operation.pullCount}`, characters: result.results.flatMap(row => row.character ? [resultCharacter(row.character, { constellation: row.constellationAfter, isNew: row.wasNewCharacter ?? false, label: `Résultat ${row.index}` })] : []),
    facts: [`Coût : ${result.operation.primogemCost} Primos`, ...(state ? [`Pity 5★ ${state.pity5}/90 · 4★ ${state.pity4}/10`, `Garantie 5★ : ${state.guaranteedFeatured5 ? 'oui' : 'non'} · Capture ${state.captureProgress}/3`] : [])] };
}
export function teamPresentation(team: PlayerTeam): ResultPresentation {
  return { command: 'team', title: `${team.name ?? `Team ${team.position}`} · composition à la commande`, characters: team.slots.flatMap(slot => slot.character ? [resultCharacter(slot.character)] : []), facts: team.passives.map(p => `${p.displayName} : ${p.description}`) };
}
