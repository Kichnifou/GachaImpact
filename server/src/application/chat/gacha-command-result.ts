import type { GachaPullResult } from '../gacha/gacha-store.js';
import type { StellaUseResult } from '../box/box-store.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { chatElementEmojis } from './chat-list-result.js';
import { chatNumber, entryParts, resourceText } from './chat-command-format.js';

export const c6StatNames = { strength: 'Force', intelligence: 'Intelligence', beauty: 'Beauté', charisma: 'Charisme', popularity: 'Popularité' } as const;
export const characterLabel = (character: { name: string; elementKey: string }) => `${isElementKey(character.elementKey) ? chatElementEmojis[character.elementKey] + ' ' : ''}${character.name}`;

/** Presentation uses the recorded transaction, including each gain and triggered passive. */
export function pullChatResult(actorName: string, result: GachaPullResult): readonly string[] {
  const count = result.operation.pullCount;
  const entries: string[] = [];
  for (const row of result.results) {
    const marker = `[${row.index}/${count}]`;
    const outcome: string[] = [row.character ? `${'⭐'.repeat(row.rarity ?? 0)} ${characterLabel(row.character)} — ${row.wasNewCharacter ? 'Nouveau' : 'Doublon'} C${row.constellationAfter}`
      : resourceText(row.resourceKey ?? '', row.resourceAmount ?? 0n)];
    if (row.rarity === 5) {
      if (row.pity5AtPull !== null && row.pity5AtPull !== undefined) {
        outcome.push(`pity ${row.pity5AtPull}/90`);
        if (row.pity5AtPull >= 2 && row.pity5AtPull <= 35) outcome.push('Early');
        if (row.pity5AtPull >= 80) outcome.push('Hard');
      }
      if (row.backToBack) outcome.push('B2B');
      if (row.captureTriggered) outcome.push('✨ Capture');
      else if (row.guaranteeConsumed) outcome.push('🎯 Garantie');
      else if (row.wasFiftyFifty) outcome.push(`50/50 ${row.wonFiftyFifty ? 'gagné' : 'perdu'}`);
    }
    entries.push(`${marker} ${outcome.join(' · ')}`);
    if (row.c6Progression) entries.push(`${marker} C6 : ${row.c6Progression.type === 'stat' ? `+1 ${c6StatNames[row.c6Progression.stat]} (${row.c6Progression.valueAfter}/20)` : 'statistiques au maximum'}`);
    for (const reward of row.bonusRewards) {
      if (reward.causeKey.startsWith('team.passive.')) continue; // These gains are displayed with their recorded passive below.
      const label = reward.causeKey === 'gacha.c6-duplicate-refund' ? 'Remboursement C6' : reward.causeKey === 'gacha.c6-maxed-compensation' ? 'Compensation C6' : 'Bonus de niveau';
      entries.push(`${marker} ${label} : +${resourceText(reward.resourceKey, reward.amount)}`);
    }
    for (const effect of row.passiveEffects) {
      const label = `${marker} 🧩 ${chatElementEmojis[effect.elementKey]}`;
      switch (effect.type) {
        case 'five_star_chance_bonus': entries.push(`${label} Hydro : chance 5★ +${effect.basisPoints / 100}%`); break;
        case 'secondary_reward_multiplier': entries.push(`${label} gain multiplié ×${effect.numerator / effect.denominator} (montant inclus)`); break;
        case 'xp': entries.push(`${label} Cryo : +${chatNumber(effect.amount)} XP${effect.levelsReached.length ? ` · niveaux ${effect.levelsReached.join(', ')}` : ''}${effect.overflowRewardsGranted ? ` · ${effect.overflowRewardsGranted} récompense(s) après niveau 100` : ''}`); break;
        case 'pity5': entries.push(`${label} Electro : +${effect.amount} pity 5★`); break;
        case 'primogem_recovery': entries.push(`${label} Anemo : +${resourceText('primogems', effect.amount)}`); break;
        case 'resource_bundle': for (const reward of effect.rewards) entries.push(`${label} Dendro : +${resourceText(reward.resourceKey, reward.amount)}`); break;
      }
    }
  }
  return entryParts(`✅ ${actorName}, Invocation ×${count} — coût ${resourceText('primogems', result.operation.primogemCost)} :`, entries, '🎲 Invocation suite :');
}

export function stellaChatResult(actorName: string, result: StellaUseResult): string {
  const progression = result.c6Progression;
  return `✅ ${actorName} utilise une Stella sur ${characterLabel(result.character)} : C${result.character.constellation}${progression ? progression.type === 'stat' ? ` · C6 +1 ${c6StatNames[progression.stat]} (${progression.valueAfter}/20)` : ' · 🌟 Statistiques C6 débloquées (1/20 chacune)' : ''} · Stella restantes : ${chatNumber(result.stellaRemaining)}.`;
}
