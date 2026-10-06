import type { ElementKey } from '../../domain/economy/resources.js';
import { resourceText, chatNumber } from './chat-command-format.js';
import { chatElementEmojis, chatElementNames } from './chat-list-result.js';

/** Transport-neutral presentation, using only rewards already returned by the owner. */
export function firstDailyMessageResult(playerName: string, element: ElementKey, result: Readonly<{ rewards: Readonly<{ primogems: bigint; mainElementParticles: bigint; moras: bigint }> }>): string {
  return `✅ Premier message du jour ${playerName} ! +${resourceText('primogems', result.rewards.primogems)} | +${chatNumber(result.rewards.mainElementParticles)} particules ${chatElementEmojis[element]} ${chatElementNames[element]} | +${resourceText('moras', result.rewards.moras)}`;
}
