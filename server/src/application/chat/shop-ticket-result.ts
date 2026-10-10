import type { ShopPurchaseResult } from '../shop/shop-store.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { chatNumber, entryParts } from './chat-command-format.js';
import { chatElementEmojis, chatElementNames } from './chat-list-result.js';

export function shopTicketResult(player: string, result: ShopPurchaseResult): readonly string[] {
  const effect = result.purchase.effect;
  const reaction = effect.type === 'ticket_pity5' ? '✨'
    : effect.type === 'ticket_main_element_particles' ? '🔥'
    : effect.type === 'ticket_other_element_particles' ? '🔮'
    : effect.resourceKey === 'moras' ? '🪙' : effect.resourceKey === 'primogems' ? '💥' : '🎉';
  let reward: string;
  if (effect.type === 'ticket_pity5') reward = `+${effect.grantedAmount} pity 5★ (${effect.pity5After}/90)`;
  else {
    const element = effect.resourceKey.replace(/^particles_/u, '');
    reward = effect.resourceKey === 'moras' ? `💰 remboursement +${chatNumber(effect.amount)} Moras`
      : isElementKey(element) ? `+${chatNumber(effect.amount)} particule${effect.amount === 1n ? '' : 's'} ${chatElementEmojis[element]} ${chatElementNames[element]}`
      : `💠 +${chatNumber(effect.amount)} Primogemme${effect.amount === 1n ? '' : 's'}`;
    if (effect.resourceKey !== 'moras' && result.rewardResourceBalanceAfter !== undefined) reward += ` (${chatNumber(result.rewardResourceBalanceAfter)})`;
  }
  return entryParts(`✅ ${reaction} ${player} utilise 🎟️ Ticket et remporte...`, [reward,
    ...(result.walletMorasAfter !== undefined ? [`Reste 💰 ${chatNumber(result.walletMorasAfter)} Moras`] : [])], '🎟️ Ticket (suite) :');
}
