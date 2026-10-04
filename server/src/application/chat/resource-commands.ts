import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { elementKeys } from '../../domain/economy/resources.js';
import { BusinessError } from '../errors.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import type { GlobalChatService } from './global-chat-service.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { chatElementEmojis, chatElementNames, logicalChatParts } from './chat-list-result.js';

const collectionEmojis: Readonly<Record<string, string>> = {
  lanterne_nouvel_an: '🎆', coeur_cristallin: '💖', bourgeon_eternel: '🌱', oeuf_enchante: '🥚',
  fleur_de_printemps: '🌸', coquillage_dore: '🏝️', etoile_filante: '⭐', boussole_antique: '🧭',
  gerbe_de_recolte: '🌾', citrouille_hantee: '🎃', feuille_ancienne: '🍁', flocon_enchante: '❄️',
};

export async function coffreCommand(identity: AuthenticatedIdentity, services: ChatCommandServices): Promise<string | readonly string[]> {
  const [actor, inventory] = await Promise.all([services.socialService.actor(identity), services.getCurrentPlayerInventory.execute(identity)]);
  const items = inventory.items.filter(i => i.section === 'collection' && i.quantity > 0n)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) || a.externalKey.localeCompare(b.externalKey));
  if (!items.length) return `ℹ️ ${actor.displayName}, ton Coffre est vide. Les objets de Collection s’obtiennent avec !event collection.`;
  return logicalChatParts(`🏆 Coffre de ${actor.displayName} |`, items.map(item => ({ text: `${collectionEmojis[item.externalKey] ?? '❔'} ${item.displayName} (x${item.quantity})`, separator: ' | ' })), '🏆 Coffre suite |', 450);
}

export async function bankCommand(identity: AuthenticatedIdentity, args: readonly string[], commandId: string,
  services: ChatCommandServices, chat: GlobalChatService, syntax: string): Promise<string> {
  const action = normalizePlayerSearch(args[0] ?? '');
  const deposit = ['deposer', 'depose'].includes(action), withdraw = ['retirer', 'retire', 'retiree'].includes(action);
  if (args.length && (args.length !== 2 || !deposit && !withdraw || !/^(?:[1-9]\d*|max)$/iu.test(args[1]!))) return syntax;
  const actor = await services.socialService.actor(identity);
  if (!args.length) {
    const bank = await services.getCurrentPlayerBank.execute(identity);
    return `🏦 Banque ${actor.displayName} : ${bank.bankMoras} Moras | 💰 Portefeuille : ${bank.walletMoras} | Intérêt estimé (3%) : +${bank.estimatedInterest} | 📥 !banque deposer X | 📤 !banque retirer X`;
  }
  const amount = args[1]!.toLowerCase() === 'max' ? 'max' : BigInt(args[1]!);
  try {
    const result = await (deposit ? services.depositPlayerBankChat : services.withdrawPlayerBankChat).execute(identity, amount, commandId);
    return `✅ ${actor.displayName} ${deposit ? 'dépose' : 'retire'} ${result.resolvedAmount} Moras ${deposit ? 'à la' : 'de la'} banque. Banque : ${result.bankMoras} | Sur toi : ${result.walletMoras}`;
  } catch (error) {
    if (error instanceof BusinessError && ['BANK_AMOUNT_INVALID', 'BANK_WALLET_INSUFFICIENT', 'BANK_BALANCE_INSUFFICIENT'].includes(error.code) && !await chat.hasConfirmedCommandMutation(commandId)) {
      if (amount === 'max' && error.code === 'BANK_AMOUNT_INVALID') return `⚠️ ${actor.displayName}, tu n’as aucun Mora à ${deposit ? 'déposer' : 'retirer'}.`;
      if (error.code === 'BANK_WALLET_INSUFFICIENT' || error.code === 'BANK_BALANCE_INSUFFICIENT') {
        const bank = await services.getCurrentPlayerBank.execute(identity);
        return deposit ? `⚠️ ${actor.displayName}, tu n’as pas assez de Moras. Portefeuille : ${bank.walletMoras}.`
          : `⚠️ ${actor.displayName}, tu n’as pas assez de Moras en banque. Banque : ${bank.bankMoras}.`;
      }
    }
    throw error;
  }
}

const numberText = (value: string) => BigInt(value).toLocaleString('fr-FR').replace(/[\u00a0\u202f]/gu, ' ');
export async function codeCommand(identity: AuthenticatedIdentity, args: readonly string[], commandId: string,
  services: ChatCommandServices, chat: GlobalChatService, syntax: string): Promise<string | readonly string[]> {
  if (args.length > 1) return syntax;
  const codes = await services.giftCodeService.listForPlayer(identity);
  if (!args.length) {
    if (!codes.available.length) return `🎁 Aucun code cadeau disponible actuellement. Récupérés : ${codes.claimed.length}.`;
    const parts = logicalChatParts('🎁 Codes disponibles :', codes.available.map(code => ({ text: code.token, separator: ', ' })), '🎁 Codes suite :');
    const summary = ` | Récupérés : ${codes.claimed.length}.`, last = parts.at(-1)!;
    return Array.from(last + summary).length <= 500 ? [...parts.slice(0, -1), last + summary] : [...parts, `🎁 Récupérés : ${codes.claimed.length}.`];
  }
  const actor = await services.socialService.actor(identity);
  const normalized = args[0]!.trim().toUpperCase().replace(/\s+/gu, '-');
  const all = [...codes.available, ...codes.claimed];
  const proposed = all.find(entry => entry.token.toUpperCase() === normalized);
  const editionId = await chat.rememberCommandText(commandId, 'targetId', proposed?.editionId ?? '');
  const code = all.find(entry => entry.editionId === editionId);
  if (!code) return '⚠️ Ce code cadeau n’est pas disponible.';
  const already = () => `⚠️ ${actor.displayName}, tu as déjà utilisé le code ${code.token}.`;
  const confirmed = await chat.hasConfirmedCommandMutation(commandId);
  if (code.available === false && !confirmed) return '⚠️ Ce code cadeau n’est pas disponible.';
  if (code.claimed && !confirmed) return already();
  try {
    const result = await services.giftCodeService.claim(identity, editionId, commandId, 'INTERNAL_CHAT');
    if (result.operation.alreadyProcessed && !confirmed) return already();
    const claimed = result.claimed.find(entry => entry.editionId === editionId) ?? code;
    const rewards = new Map(claimed.rewards.filter(reward => BigInt(reward.amount) > 0n).map(reward => [reward.resourceKey, reward.amount]));
    const texts: string[] = [];
    if (rewards.has('primogems')) texts.push(`+💠${numberText(rewards.get('primogems')!)} Primogemmes (${numberText(result.resources.primogems)})`);
    if (rewards.has('moras')) texts.push(`+🪙${numberText(rewards.get('moras')!)} Moras (${numberText(result.resources.moras)})`);
    for (const element of elementKeys) {
      const amount = rewards.get(`particles_${element}`);
      if (amount) texts.push(`+${numberText(amount)} particules ${chatElementEmojis[element]} ${chatElementNames[element]} (${numberText(result.resources.particles[element] ?? '0')})`);
    }
    const description = claimed.description?.trim();
    return `✅ ${actor.displayName} a utilisé ${claimed.token} ! ${texts.join(' | ')}${description ? ` | ${description}` : ''}`;
  } catch (error) {
    if (error instanceof BusinessError && !await chat.hasConfirmedCommandMutation(commandId)) {
      if (error.code === 'GIFT_CODE_ALREADY_CLAIMED') return already();
      if (['GIFT_CODE_NOT_FOUND', 'GIFT_CODE_UNAVAILABLE'].includes(error.code)) return '⚠️ Ce code cadeau n’est pas disponible.';
    }
    throw error;
  }
}
