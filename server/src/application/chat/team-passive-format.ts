import type { PlayerTeam } from '../team/team-store.js';
import { chatElementEmojis } from './chat-list-result.js';
import { deriveActiveTeamGachaEffects } from '../../domain/team/team-passives.js';

export function compactPassive(passive: PlayerTeam['passives'][number]): string {
  const element = passive.elementKey;
  const effects = deriveActiveTeamGachaEffects(Array.from({ length: passive.stacks }, () => element));
  const multiplier = (value: { numerator: number; denominator: number }) => (value.numerator / value.denominator).toLocaleString('fr-FR');
  const emoji = chatElementEmojis[element];
  switch (element) {
    case 'pyro': return `${emoji} ×${multiplier(effects.secondaryParticleMultiplier)} particules`;
    case 'hydro': return `${emoji} +${effects.fiveStarChanceBonusBasisPoints / 100}% chance 5★`;
    case 'cryo': return `${emoji} 1/${effects.xpReward!.oneIn} : +${effects.xpReward!.amount} XP`;
    case 'electro': return `${emoji} 1/${effects.pity5Reward!.oneIn} : +${effects.pity5Reward!.amount} pity 5★`;
    case 'anemo': return `${emoji} 1/${effects.primogemRecovery!.oneIn} : +${effects.primogemRecovery!.amount} primos`;
    case 'geo': return `${emoji} ×${multiplier(effects.secondaryMoraMultiplier)} moras`;
    case 'dendro': { const bundle = effects.dendroBundle!; return `${emoji} 1/${bundle.oneIn} : +${bundle.primogems} primos, +${bundle.moras} moras, +${bundle.particlesPerElement} particules/élément`; }
  }
}
