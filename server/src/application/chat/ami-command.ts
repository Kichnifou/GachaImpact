import { AppError } from '../../api/errors.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import type { PlayerCommandContext } from './player-command-context.js';
import { playerReferenceName, samePlayerReference } from './player-reference.js';
import { friendshipTier, type FriendAction } from '../social/friendship-service.js';
import { friendshipPhrases } from '../social/friendship-phrases.js';

const levelText = (level: number) => `${Math.min(1000, level)} [${friendshipTier(level)}] ${level >= 1000 ? '💞' : level >= 300 ? '🌟' : level >= 100 ? '💖' : '💛'}`;
type Friend = Awaited<ReturnType<ChatCommandServices['socialService']['friends']>>['friends'][number];
const detail = (actor: string, target: string, friend: Friend) => `🤝 Amitié ${actor} ↔ ${target} | Statut : ami | Niveau d’amitié : ${levelText(friend.level)} | 💖💖✨ échangés : ${friend.totalHearts} | Cœur aujourd’hui : ${friend.heartSent ? 'déjà envoyé' : 'disponible'}`;

/** Chat presentation only: FriendshipService owns transitions, rewards and receipts. */
export async function amiCommand(identity: PlayerExecutionActor, args: readonly string[], commandMessageId: string,
  social: ChatCommandServices['socialService'], chat: PlayerCommandContext,
  findPlayer: (name: string) => Promise<{ id: string; displayName: string } | null>,
  compact: (values: readonly string[], limit?: number) => string, syntax: string): Promise<string> {
  const actor = await social.actor(identity), state = await social.friends(identity);
  const label = (id: string) => state.players.find(player => player.id === id)?.displayName ?? 'Joueur';
  const action = args[0]?.toLocaleLowerCase('fr-FR') ?? '';
  const warning = (text: string) => `⚠️ ${actor.displayName}, ${text}`;
  const boundedList = (values: readonly string[], budget: number) => {
    let limit = Math.min(8, values.length);
    while (limit > 0 && Array.from(compact(values, limit)).length > budget) limit--;
    return compact(values, limit);
  };
  if (!action) return `ℹ️ ${actor.displayName} | Amis : ${state.summary.activeFriends} | Cœurs disponibles : ${state.summary.available} | Demandes : ${state.requests.length} | Commandes : !ami pseudo · !ami demandes · !ami coeur pseudo · !ami coeur all`;
  if (action === 'demandes' && args.length === 1) {
    const requests = (direction: 'RECEIVED' | 'SENT') => {
      const entries = state.requests.filter(request => request.direction === direction).map(request => label(request.playerId));
      return entries.length ? boundedList(entries, 210) : 'aucune';
    };
    return `📨 Demandes d’ami | Reçues : ${requests('RECEIVED')} | Envoyées : ${requests('SENT')}`;
  }
  const heart = ['coeur', 'cœur', 'coeurs', 'cœurs'].includes(action);
  const mutations: Record<string, FriendAction> = { ajouter: 'ADD', accepter: 'ACCEPT', refuser: 'REFUSE', annuler: 'CANCEL', retirer: 'REMOVE' };
  const explicit = Object.hasOwn(mutations, action) ? mutations[action]! : undefined;
  const raw = heart || explicit || action === 'voir' ? args.slice(1).join(' ') : args.join(' ');
  if (!raw) return syntax;
  const all = heart && ['all', '@all'].includes(raw.toLocaleLowerCase('fr-FR'));
  const resolved = all ? null : samePlayerReference(actor.displayName, raw) ? actor : state.players.find(player => samePlayerReference(player.displayName, raw)) ?? await findPlayer(raw);
  const targetId = await chat.rememberCommandText(commandMessageId, 'targetId', all ? 'all' : resolved?.id ?? '');
  const targetName = resolved?.displayName ?? playerReferenceName(raw);
  if (!targetId) return warning(`le joueur ${targetName} est introuvable.`);
  if (targetId === actor.id) return warning(heart ? 'tu ne peux pas t’envoyer des cœurs cœurs paillettes à toi-même.' : 'tu ne peux pas devenir ami avec toi-même.');
  const friend = state.friends.find(entry => entry.playerId === targetId);
  const request = state.requests.find(entry => entry.playerId === targetId);
  const accepted = async () => {
    const current = await social.friends(identity);
    const relation = current.friends.find(entry => entry.playerId === targetId);
    if (!relation) throw new Error('Confirmed friendship is missing from its projection');
    return `🤝 ${actor.displayName} et ${targetName} sont maintenant amis ! Niveau d’amitié : ${levelText(relation.level)}`;
  };
  const wait = () => warning(`demande déjà envoyée à ${targetName}. ${targetName} doit faire !ami ${actor.displayName} pour accepter.`);
  try {
    if (heart) {
      // Preserve the original decision across a retry, even after the relation changes.
      const eligible = await chat.rememberCommandText(commandMessageId, 'action', all || friend ? 'SEND' : 'NOT_FRIEND');
      if (eligible === 'NOT_FRIEND') return warning(`tu n’es pas encore ami avec ${targetName}. Utilise : !ami ${targetName}`);
      const result = await social.friendship.sendHearts(actor.id, targetId, commandMessageId, chat.sourceChannel ?? 'INTERNAL_CHAT');
      if (result.sent > 0) {
        await chat.rememberCommandRefreshScopes(commandMessageId, ['social', 'resources', 'notifications']);
        if (all) return `💖💖✨ ${actor.displayName} envoie des cœurs cœurs paillettes à tous ses amis ! | ${result.sent} envoyé(s), ${result.alreadySent} déjà fait(s), ${result.unavailable} indisponible(s) | +💠${result.senderReward} Primos pour ${actor.displayName}`;
        const phrase = friendshipPhrases.find(value => result.message?.endsWith(` : ${value}`));
        if (!phrase || result.level === undefined) throw new Error('Confirmed heart is missing its authoritative phrase or level');
        return `💖💖✨ ${actor.displayName} envoie des cœurs cœurs paillettes à ${targetName} | ${phrase} | Niveau d’amitié : ${levelText(result.level)} | +💠5 Primos chacun`;
      }
      if (!all) return result.status === 'ALL_SENT' ? warning(`tu as déjà envoyé des cœurs cœurs paillettes à ${targetName} aujourd’hui.`) : warning(`impossible d’envoyer un cœur à ${targetName} pour le moment.`);
      return result.status === 'ALL_SENT' ? warning('tu as déjà envoyé des cœurs cœurs paillettes à tous tes amis aujourd’hui.')
        : result.status === 'NO_FRIENDS' ? warning('tu n’as aucun ami disponible à qui envoyer un cœur.')
        : warning('aucun cœur envoyé. Déjà fait aujourd’hui ou aucun ami disponible.');
    }
    if (action === 'voir') return friend ? detail(actor.displayName, targetName, friend)
      : request?.direction === 'RECEIVED' ? `📨 ${actor.displayName}, tu as reçu une demande d’ami de ${targetName}. Utilise !ami accepter ${targetName} ou simplement !ami ${targetName}.`
      : request ? `📨 ${actor.displayName}, ta demande d’ami à ${targetName} est en attente.`
      : `ℹ️ ${actor.displayName}, aucune relation d’amitié avec ${targetName}.`;
    const decision = explicit === 'ADD' ? friend ? 'ALREADY_FRIEND' : request?.direction === 'SENT' ? 'WAIT' : 'ADD'
      : explicit === 'ACCEPT' || explicit === 'REFUSE' ? request?.direction === 'RECEIVED' ? explicit : `NO_${explicit}`
      : explicit === 'CANCEL' ? request?.direction === 'SENT' ? 'CANCEL' : 'NO_CANCEL'
      : explicit === 'REMOVE' ? friend ? 'REMOVE' : 'NO_REMOVE'
      : friend ? 'VIEW' : request?.direction === 'SENT' ? 'WAIT' : request ? 'ACCEPT' : 'ADD';
    const intent = await chat.rememberCommandText(commandMessageId, 'action', decision);
    if (intent === 'VIEW') return friend ? detail(actor.displayName, targetName, friend) : warning(`cette interaction avec ${targetName} est indisponible.`);
    if (intent === 'WAIT') return wait();
    if (intent === 'ALREADY_FRIEND') return `ℹ️ ${actor.displayName}, tu es déjà ami avec ${targetName}.`;
    if (intent === 'NO_ACCEPT' || intent === 'NO_REFUSE') return warning(`aucune demande d’ami de ${targetName} à ${intent === 'NO_ACCEPT' ? 'accepter' : 'refuser'}.`);
    if (intent === 'NO_CANCEL') return warning(`aucune demande d’ami envoyée à ${targetName} à annuler.`);
    if (intent === 'NO_REMOVE') return warning(`tu n’es pas ami avec ${targetName}.`);
    if (!['ADD', 'ACCEPT', 'REFUSE', 'CANCEL', 'REMOVE'].includes(intent)) throw new Error('Invalid remembered friendship action');
    const result = await social.friendship.mutate(actor.id, targetId, intent as FriendAction, commandMessageId, chat.sourceChannel ?? 'INTERNAL_CHAT');
    await chat.rememberCommandRefreshScopes(commandMessageId, ['social', 'notifications']);
    if (result.state === 'ACTIVE' || result.state === 'ACCEPTED') return accepted();
    if (result.state === 'PENDING') return `✅ ${actor.displayName} envoie une demande d’ami à ${targetName} | ${targetName} peut accepter avec !ami ${actor.displayName}`;
    if (result.state === 'REFUSED') return `✅ Demande d’ami de ${targetName} refusée.`;
    if (result.state === 'CANCELLED') return `✅ Demande d’ami envoyée à ${targetName} annulée.`;
    if (result.state === 'ARCHIVED') return `✅ ${actor.displayName} et ${targetName} ne sont plus amis.`;
    throw new Error('Unexpected friendship transition result');
  } catch (error) {
    if (error instanceof AppError && error.code === 'SOCIAL_UNAVAILABLE' && !await chat.hasConfirmedCommandMutation(commandMessageId))
      return warning(heart ? `impossible d’envoyer un cœur à ${targetName} pour le moment.` : `cette interaction avec ${targetName} est indisponible.`);
    throw error;
  }
}
