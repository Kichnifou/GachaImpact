import type { GachaPullResult } from '../gacha/gacha-store.js';
import type { StellaUseResult } from '../box/box-store.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { chatElementEmojis, chatLength, chatResponseLimit, logicalChatParts } from './chat-list-result.js';
import { commandSource } from '../player/player-command-execution.js';
import { chatElementNames } from './chat-list-result.js';
import { chatNumber } from './chat-command-format.js';

export const c6StatNames = { strength: 'Force', intelligence: 'Intelligence', beauty: 'Beauté', charisma: 'Charisme', popularity: 'Popularité' } as const;
export const characterLabel = (character: { name: string; elementKey: string }) => `${isElementKey(character.elementKey) ? chatElementEmojis[character.elementKey] + ' ' : ''}${character.name}`;

/** Presentation uses the recorded transaction, including each gain and triggered passive. */
export function pullChatResult(actorName: string, result: GachaPullResult): readonly string[] {
  return result.results.flatMap(row => {
    const prefixes: string[] = [];
    if (row.pity5AtPull === 74) prefixes.push('⚠️ Tu entres en soft pity...');
    if (row.pity5AtPull === 80) prefixes.push('💀 Outch la hard...');
    if (row.rarity === 5) {
      if (row.pity5AtPull != null && row.pity5AtPull >= 2 && row.pity5AtPull <= 35) prefixes.push('🔥 WOW EARLY !!');
      if (row.backToBack) prefixes.push('💥 INCROYABLE BACK-TO-BACK !!!');
      if (row.captureTriggered) prefixes.push('✨ CAPTURE DE BRILLANCE !');
    }
    const render = (compact: boolean) => {
      const number = (amount: bigint | number) => compact ? amount.toString() : chatNumber(amount);
      const marker = result.operation.pullCount > 1 ? `[${row.index}/${result.operation.pullCount}] ` : '';
      const total = (key: string) => {
        const amount = row.resourceTotalsAfter?.[key as keyof NonNullable<typeof row.resourceTotalsAfter>];
        return amount === undefined ? '' : ` (${number(BigInt(amount))})`;
      };
      const compactGain = (key: string, amount: bigint, withTotal = false) => {
        const element = key.replace(/^particles_/u, '');
        return `+${number(amount)} ${key === 'primogems' ? 'primos' : key === 'moras' ? '💰 moras' : isElementKey(element) ? chatElementEmojis[element] : key === 'xp' ? 'XP' : key}${withTotal ? total(key) : ''}`;
      };
      const refund = row.bonusRewards.find(reward => reward.causeKey === 'gacha.c6-duplicate-refund');
      const principal = row.character
        ? `🎉 ${marker}${actorName} obtient ${'⭐'.repeat(row.rarity ?? 0)} ${characterLabel(row.character)} ! ${refund ? (compact ? 'C6 : ' : 'Déjà C6 : remboursement ') + compactGain(refund.resourceKey, refund.amount, true) : row.wasNewCharacter ? 'Nouveau personnage : C0' : 'Doublon : passe C' + row.constellationAfter}.`
        : `✅ ${marker}${actorName} obtient +${number(row.resourceAmount ?? 0n)} ${row.resourceKey === 'moras' ? '💰 moras' : isElementKey(row.resourceKey?.replace(/^particles_/u, '') ?? '') ? 'particules ' + chatElementEmojis[row.resourceKey!.replace(/^particles_/u, '') as keyof typeof chatElementEmojis] + ' ' + chatElementNames[row.resourceKey!.replace(/^particles_/u, '') as keyof typeof chatElementNames] : 'primos'}${total(row.resourceKey ?? '')}.`;
      const suffix: string[] = [];
      if (row.rarity === 5) {
        const facts: string[] = [];
        if (row.pity5AtPull != null) {
          facts.push(`pity ${row.pity5AtPull}/90`);
        }
        if (!row.captureTriggered) {
          if (row.guaranteeConsumed) facts.push('🎯 Garantie');
          else if (row.wasFiftyFifty) facts.push(`50/50 ${row.wonFiftyFifty ? 'gagné' : 'perdu'}`);
        }
        if (facts.length) suffix.push(facts.join(' · '));
      }
      if (row.c6Progression && !(compact && row.c6Progression.type === 'maxed')) suffix.push(row.c6Progression.type === 'stat'
        ? `🌟 ${row.character?.name ?? 'Personnage'}${compact ? '' : ' progresse'} : +1 ${c6StatNames[row.c6Progression.stat]} (${row.c6Progression.valueAfter}/20).`
        : '🌟 Stats au maximum');
      const levelGains: string[] = [];
      for (const reward of row.bonusRewards) {
        if (reward === refund || reward.causeKey.startsWith('team.passive.')) continue;
        if (reward.causeKey === 'gacha.c6-maxed-compensation') suffix.push(`${compact ? '🌟 Stats max' : 'Compensation'} : ${compactGain(reward.resourceKey, reward.amount, true)}`);
        else levelGains.push(compactGain(reward.resourceKey, reward.amount));
      }
      if (levelGains.length) suffix.push('Niveau : ' + levelGains.join(', '));
      for (const effect of row.passiveEffects) {
        const emoji = chatElementEmojis[effect.elementKey];
        switch (effect.type) {
          // Constant effects remain in the engine/receipt; the final gain already includes them.
          case 'five_star_chance_bonus':
          case 'secondary_reward_multiplier': break;
          case 'xp': suffix.push(`${emoji} +${number(effect.amount)} XP${effect.levelsReached.length ? ' · niveaux ' + effect.levelsReached.join(', ') : ''}${effect.overflowRewardsGranted ? ' · bonus niv.100 ×' + effect.overflowRewardsGranted : ''}`); break;
          case 'pity5': suffix.push(`${emoji} +${effect.amount} pity 5★`); break;
          case 'primogem_recovery': suffix.push(`${emoji} ${compactGain('primogems', effect.amount, true)}`); break;
          case 'resource_bundle': {
            // Group equal recorded particle gains without changing or inventing amounts.
            const particles = new Map<string, string[]>();
            const gains: string[] = [];
            for (const reward of effect.rewards) {
              const element = reward.resourceKey.replace(/^particles_/u, '');
              if (isElementKey(element)) {
                const key = number(reward.amount);
                particles.set(key, [...(particles.get(key) ?? []), chatElementEmojis[element]]);
              } else gains.push(compactGain(reward.resourceKey, reward.amount));
            }
            for (const [amount, emojis] of particles) gains.push(`+${amount} ${emojis.join('')} chacun`);
            suffix.push(`${emoji} ${gains.join(', ')}`); break;
          }
        }
      }
      return { text: [...prefixes, [principal, ...suffix].join(compact ? '|' : ' | ')].join(' '), atoms: [...prefixes, principal, ...suffix] };
    };
    const message = render(false);
    if (commandSource('INTERNAL_CHAT') === 'TWITCH') return chatLength(message.text) <= chatResponseLimit() ? [message.text]
      : logicalChatParts('', message.atoms.map(text => ({ text, separator: ' | ' })), `🎲 ${result.operation.pullCount > 1 ? `[${row.index}/${result.operation.pullCount}] ` : ''}Invocation (suite) :`);
    // Compact only numeric typography and labels, keeping player/character names intact.
    return chatLength(message.text) <= 500 ? [message.text] : [render(true).text];
  });
}

export function stellaChatResult(actorName: string, result: StellaUseResult): string {
  const progression = result.c6Progression;
  return `✅ ${actorName} utilise une Stella sur ${characterLabel(result.character)} : C${result.character.constellation}${progression ? progression.type === 'stat' ? ` · C6 +1 ${c6StatNames[progression.stat]} (${progression.valueAfter}/20)` : ' · 🌟 Statistiques C6 débloquées (1/20 chacune)' : ''} · Stella restantes : ${chatNumber(result.stellaRemaining)}.`;
}
