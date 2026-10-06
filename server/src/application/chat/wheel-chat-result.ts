import type { WheelReward } from '../../domain/wheel/wheel.js';
import { chatNumber, resourceText } from './chat-command-format.js';

export function wheelChatResult(playerName: string, reward: WheelReward): string {
  const opening = `🎡 La roue tourne pour ${playerName} et…`;
  if (reward.resultType === 'nothing') return `${opening} rien du tout 😭 La roue a choisi le chaos aujourd’hui.`;
  if (reward.resourceKey === 'moras') return `${opening} +💰${chatNumber(reward.amount!)} moras ! Le pactole commence à tomber.`;
  if (reward.resourceKey === 'primogems') return `${opening} JACKPOT 💠 +${chatNumber(reward.amount!)} primos ! La roue bénit officiellement ce moment ✨`;
  return `${opening} +${resourceText(reward.resourceKey!, reward.amount!)} ! Une belle énergie élémentaire apparaît.`;
}
