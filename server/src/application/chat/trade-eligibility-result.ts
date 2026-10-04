import type { TradeEligibility } from '../trades/trade-service.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { chatElementEmojis, chatElementNames } from './chat-list-result.js';

export function tradeEligibilityText(view: TradeEligibility): string {
  if (view.reason === 'NOT_FOUND') return 'Joueur introuvable.';
  if (view.reason === 'UNAVAILABLE' || !view.player) return '⚠️ Ce joueur n’est pas disponible pour un échange.';
  const name = view.player.displayName;
  if (view.reason === 'PENDING') return `⚠️ Un échange est déjà en attente avec ${name}.`;
  const prefix = `⚠️ Échange impossible avec ${name} :`;
  if (view.reason === 'SAME_ELEMENT') return `${prefix} vous avez le même élément.`;
  const element = view.resourceKey?.replace(/^particles_/u, '') ?? '';
  const label = isElementKey(element) ? `${chatElementEmojis[element]} ${chatElementNames[element]}` : '';
  return `${prefix} ${view.reason === 'ACTOR_EMPTY' ? 'tu n’as' : name + ' n’a'} aucune particule ${label} disponible à échanger.`;
}
