import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { elementKeys } from '../../domain/economy/resources.js';
import { BusinessError } from '../errors.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import type { PlayerCommandContext } from './player-command-context.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { chatResponseLimit, logicalChatParts } from './chat-list-result.js';
import { chatNumber } from './chat-command-format.js';
import { codeRewardParts, codeRewardText } from './code-reward-result.js';

const collectionEmojis: Readonly<Record<string, string>> = {
  lanterne_nouvel_an: '🎆', coeur_cristallin: '💖', bourgeon_eternel: '🌱', oeuf_enchante: '🥚',
  fleur_de_printemps: '🌸', coquillage_dore: '🏝️', etoile_filante: '⭐', boussole_antique: '🧭',
  gerbe_de_recolte: '🌾', citrouille_hantee: '🎃', feuille_ancienne: '🍁', flocon_enchante: '❄️',
};

export async function coffreCommand(identity: PlayerExecutionActor, services: ChatCommandServices): Promise<string | readonly string[]> {
  const [actor, inventory] = await Promise.all([services.socialService.actor(identity), services.getCurrentPlayerInventory.execute(identity)]);
  const items = inventory.items.filter(i => i.section === 'collection' && i.quantity > 0n)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) || a.externalKey.localeCompare(b.externalKey));
  if (!items.length) return `ℹ️ ${actor.displayName}, ton Coffre est vide. Les objets de Collection s’obtiennent avec !event collection.`;
  return logicalChatParts(`🏆 Coffre de ${actor.displayName} |`, items.map(item => ({ text: `${collectionEmojis[item.externalKey] ?? '❔'} ${item.displayName} (x${item.quantity})`, separator: ' | ' })), '🏆 Coffre suite |', 450);
}

export async function bankCommand(identity: PlayerExecutionActor, args: readonly string[], commandId: string,
  services: ChatCommandServices, chat: PlayerCommandContext, syntax: string): Promise<string> {
  const action = normalizePlayerSearch(args[0] ?? '');
  const deposit = ['deposer', 'depose'].includes(action), withdraw = ['retirer', 'retire', 'retiree'].includes(action);
  if (args.length && (args.length !== 2 || !deposit && !withdraw || !/^(?:[1-9]\d*|max)$/iu.test(args[1]!))) return syntax;
  const actor = await services.socialService.actor(identity);
  if (!args.length) {
    const bank = await services.getCurrentPlayerBank.execute(identity);
    return `🏦 Banque ${actor.displayName} : ${chatNumber(bank.bankMoras)} Moras | 💰 Portefeuille : ${chatNumber(bank.walletMoras)} | Intérêt estimé (3%) : +${chatNumber(bank.estimatedInterest)} | 📥 !banque deposer X | 📤 !banque retirer X`;
  }
  let amount: bigint | 'max' = args[1]!.toLowerCase() === 'max' ? 'max' : BigInt(args[1]!);
  if (amount === 'max' && chat.sourceChannel === 'TWITCH') {
    const bank = await services.getCurrentPlayerBank.execute(identity);
    amount = await chat.rememberCommandQuantity(commandId, deposit ? bank.walletMoras : bank.bankMoras);
    if (!amount) return `⚠️ ${actor.displayName}, tu n’as aucun Mora à ${deposit ? 'déposer' : 'retirer'}.`;
  }
  try {
    const result = await (deposit ? services.depositPlayerBankChat : services.withdrawPlayerBankChat).execute(identity, amount, commandId);
    return `✅ ${actor.displayName} ${deposit ? 'dépose' : 'retire'} ${chatNumber(result.resolvedAmount)} Moras ${deposit ? 'à la' : 'de la'} banque. Banque : ${chatNumber(result.bankMoras)} | Sur toi : ${chatNumber(result.walletMoras)}`;
  } catch (error) {
    if (error instanceof BusinessError && ['BANK_AMOUNT_INVALID', 'BANK_WALLET_INSUFFICIENT', 'BANK_BALANCE_INSUFFICIENT'].includes(error.code) && !await chat.hasConfirmedCommandMutation(commandId)) {
      if (amount === 'max' && error.code === 'BANK_AMOUNT_INVALID') return `⚠️ ${actor.displayName}, tu n’as aucun Mora à ${deposit ? 'déposer' : 'retirer'}.`;
      if (error.code === 'BANK_WALLET_INSUFFICIENT' || error.code === 'BANK_BALANCE_INSUFFICIENT') {
        const bank = await services.getCurrentPlayerBank.execute(identity);
        return deposit ? `⚠️ ${actor.displayName}, tu n’as pas assez de Moras. Portefeuille : ${chatNumber(bank.walletMoras)}.`
          : `⚠️ ${actor.displayName}, tu n’as pas assez de Moras en banque. Banque : ${chatNumber(bank.bankMoras)}.`;
      }
    }
    throw error;
  }
}

const numberText = (value: string) => BigInt(value).toLocaleString('fr-FR').replace(/[\u00a0\u202f]/gu, ' ');
export async function codeCommand(identity: PlayerExecutionActor, args: readonly string[], commandId: string,
  services: ChatCommandServices, chat: PlayerCommandContext, syntax: string): Promise<string | readonly string[]> {
  if (args.length > 1) return syntax;
  const codes = await services.giftCodeService.listForPlayer(identity);
  if (!args.length) {
    if (!codes.available.length) return `🎁 Aucun code cadeau disponible actuellement. Récupérés : ${codes.claimed.length}.`;
    const parts = logicalChatParts('🎁 Codes disponibles :', codes.available.map(code => ({ text: code.token, separator: ', ' })), '🎁 Codes suite :');
    const summary = ` | Récupérés : ${codes.claimed.length}.`, last = parts.at(-1)!;
    return Array.from(last + summary).length <= chatResponseLimit() ? [...parts.slice(0, -1), last + summary] : [...parts, `🎁 Récupérés : ${codes.claimed.length}.`];
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
    const result = await services.giftCodeService.claim(identity, editionId, commandId, chat.sourceChannel ?? 'INTERNAL_CHAT');
    if (result.operation.alreadyProcessed && !confirmed) return already();
    const claimed = result.claimed.find(entry => entry.editionId === editionId) ?? code;
    const actualRewards = claimed.rewardBreakdown?.direct ?? result.grantedRewards ?? claimed.rewards;
    const rewards = new Map(actualRewards.filter(reward => BigInt(reward.amount) > 0n).map(reward => [reward.resourceKey, reward.amount]));
    const texts: string[] = [];
    if (rewards.has('primogems')) texts.push(`${codeRewardText({ resourceKey: 'primogems', amount: rewards.get('primogems')!, displayName: '' })} (${numberText(result.resources.primogems)})`);
    if (rewards.has('moras')) texts.push(`${codeRewardText({ resourceKey: 'moras', amount: rewards.get('moras')!, displayName: '' })} (${numberText(result.resources.moras)})`);
    for (const element of elementKeys) {
      const amount = rewards.get(`particles_${element}`);
      if (amount) texts.push(`${codeRewardText({ resourceKey: `particles_${element}`, amount, displayName: '' })} (${numberText(result.resources.particles[element] ?? '0')})`);
    }
    for (const reward of actualRewards) {
      if (['masterless-stella-fortuna', 'event_points', 'event_currency'].includes(reward.resourceKey) && BigInt(reward.amount) > 0n) texts.push(codeRewardText(reward));
    }
    const milestones = (claimed.rewardBreakdown?.milestones ?? []).filter(reward => BigInt(reward.amount) > 0n).map(codeRewardText);
    const description = claimed.description?.trim();
    return codeRewardParts(`✅ ${actor.displayName} a utilisé ${claimed.token} !`, texts, milestones,
      [...(result.eventReward?.granted === false ? ['Gains Event non accordés : inscription au Festival actif requise.'] : []), ...(description ? [description] : [])]);
  } catch (error) {
    if (error instanceof BusinessError && !await chat.hasConfirmedCommandMutation(commandId)) {
      if (error.code === 'GIFT_CODE_ALREADY_CLAIMED') return already();
      if (['GIFT_CODE_NOT_FOUND', 'GIFT_CODE_UNAVAILABLE'].includes(error.code)) return '⚠️ Ce code cadeau n’est pas disponible.';
    }
    throw error;
  }
}
