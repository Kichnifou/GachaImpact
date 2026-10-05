import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import { chatNumber } from './chat-command-format.js';

/** Presentation only: each price and bundle remains owned by its current service. */
export async function shopChatSummary(identity: PlayerExecutionActor, services: ChatCommandServices): Promise<string> {
  const [shop, challenge] = await Promise.all([services.getCurrentPlayerShop.execute(identity), services.getDailyChallenge.execute(identity)]);
  const primos = shop.items.find(item => item.externalKey === 'primogem-bundle');
  const ticket = shop.items.find(item => item.externalKey === 'reward-ticket');
  const price = (item: typeof primos) => item ? `[💰 ${chatNumber(item.priceAmount)}]${item.available ? '' : ' · indisponible'}` : 'indisponible';
  return `🛒 Shop : 📜 Mission [💰 ${chatNumber(challenge.purchaseCost)}] | 💠 ${primos?.rewardPerUnit ? chatNumber(primos.rewardPerUnit.amount) : '—'} Primos ${price(primos)} | 🎟️ Ticket ${price(ticket)} | Achat : !shop article`;
}
