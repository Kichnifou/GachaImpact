import { describe, expect, it, vi } from 'vitest';
import { amiCommand } from '../src/application/chat/ami-command.js';
import { AppError } from '../src/api/errors.js';
import { friendshipPhrases } from '../src/application/social/friendship-phrases.js';
import type { ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';

function harness(relation: 'NONE' | 'FRIEND' | 'RECEIVED' | 'SENT' = 'NONE', level = 42) {
  const friend = { playerId: 'ceo', level, tier: '', totalHearts: '41', heartSent: false };
  const state = { friends: relation === 'FRIEND' ? [friend] : [], requests: relation === 'RECEIVED' || relation === 'SENT' ? [{ playerId: 'ceo', direction: relation }] : [], players: [{ id: 'ceo', displayName: 'Ceo' }], summary: { activeFriends: relation === 'FRIEND' ? 1 : 0, available: 1 } };
  const social = {
    actor: vi.fn(async () => ({ id: 'self', displayName: 'Kichnifou' })), friends: vi.fn(async () => state),
    friendship: {
      mutate: vi.fn(async (_actor: string, _target: string, action: string) => {
        if (action === 'ACCEPT' || action === 'ADD' && state.requests[0]?.direction === 'RECEIVED') { state.friends = [friend]; state.requests = []; return { state: 'ACCEPTED' }; }
        return { state: ({ ADD: 'PENDING', REFUSE: 'REFUSED', CANCEL: 'CANCELLED', REMOVE: 'ARCHIVED' } as Record<string, string>)[action] };
      }),
      sendHearts: vi.fn(async () => ({ sent: 1, alreadySent: 0, unavailable: 0, activeFriends: 1, senderReward: '5', status: 'SENT', level: 43, message: `Kichnifou envoie un cœur à Ceo : ${friendshipPhrases[0]}` })),
    },
  };
  const remembered = new Map<string, string>();
  const chat = { rememberCommandText: vi.fn(async (_id: string, field: string, value: string) => { if (!remembered.has(field)) remembered.set(field, value); return remembered.get(field)!; }), rememberCommandRefreshScopes: vi.fn(), hasConfirmedCommandMutation: vi.fn(async () => false) };
  const find = vi.fn(async (name: string) => name.replace(/^@/, '') === 'Ceo' ? { id: 'ceo', displayName: 'Ceo' } : null);
  const run = (input: string) => amiCommand({ subject: 'actor' }, input ? input.split(' ') : [], 'message', social as unknown as ChatCommandServices['socialService'], chat as unknown as GlobalChatService, find,
    (values, limit = 8) => `${values.slice(0, limit).join(' · ')}${values.length > limit ? `, et ${values.length - limit} autres` : ''}`, 'Syntaxe : !ami.');
  return { run, state, social, chat, friend, find };
}

describe('Ami.txt approved standalone contract', () => {
  it('uses the real actor and counters in the summary', async () => {
    expect(await harness('FRIEND').run('')).toBe('ℹ️ Kichnifou | Amis : 1 | Cœurs disponibles : 1 | Demandes : 0 | Commandes : !ami pseudo · !ami demandes · !ami coeur pseudo · !ami coeur all');
  });
  it.each(['NONE', 'RECEIVED', 'SENT', 'FRIEND'] as const)('bare target orchestration: %s', async relation => {
    const h = harness(relation); const result = await h.run('Ceo');
    if (relation === 'NONE' || relation === 'RECEIVED') expect(h.social.friendship.mutate).toHaveBeenCalledWith('self', 'ceo', relation === 'NONE' ? 'ADD' : 'ACCEPT', 'message', 'INTERNAL_CHAT');
    else expect(h.social.friendship.mutate).not.toHaveBeenCalled();
    expect(result).toBe(relation === 'NONE' ? '✅ Kichnifou envoie une demande d’ami à Ceo | Ceo peut accepter avec !ami Kichnifou'
      : relation === 'RECEIVED' ? '🤝 Kichnifou et Ceo sont maintenant amis ! Niveau d’amitié : 42 [Amitié Sincère] 💛'
      : relation === 'SENT' ? '⚠️ Kichnifou, demande déjà envoyée à Ceo. Ceo doit faire !ami Kichnifou pour accepter.'
      : '🤝 Amitié Kichnifou ↔ Ceo | Statut : ami | Niveau d’amitié : 42 [Amitié Sincère] 💛 | 💖💖✨ échangés : 41 | Cœur aujourd’hui : disponible');
  });
  it.each(['NONE', 'RECEIVED', 'SENT', 'FRIEND'] as const)('voir never mutates: %s', async relation => {
    const h = harness(relation); const result = await h.run('voir Ceo');
    expect(h.social.friendship.mutate).not.toHaveBeenCalled();
    expect(result).toBe(relation === 'NONE' ? 'ℹ️ Kichnifou, aucune relation d’amitié avec Ceo.'
      : relation === 'RECEIVED' ? '📨 Kichnifou, tu as reçu une demande d’ami de Ceo. Utilise !ami accepter Ceo ou simplement !ami Ceo.'
      : relation === 'SENT' ? '📨 Kichnifou, ta demande d’ami à Ceo est en attente.'
      : '🤝 Amitié Kichnifou ↔ Ceo | Statut : ami | Niveau d’amitié : 42 [Amitié Sincère] 💛 | 💖💖✨ échangés : 41 | Cœur aujourd’hui : disponible');
  });
  it.each([
    ['ajouter', 'NONE', '✅ Kichnifou envoie une demande d’ami à Ceo | Ceo peut accepter avec !ami Kichnifou'],
    ['ajouter', 'FRIEND', 'ℹ️ Kichnifou, tu es déjà ami avec Ceo.'],
    ['ajouter', 'SENT', '⚠️ Kichnifou, demande déjà envoyée à Ceo. Ceo doit faire !ami Kichnifou pour accepter.'],
    ['ajouter', 'RECEIVED', '🤝 Kichnifou et Ceo sont maintenant amis ! Niveau d’amitié : 42 [Amitié Sincère] 💛'],
    ['accepter', 'RECEIVED', '🤝 Kichnifou et Ceo sont maintenant amis ! Niveau d’amitié : 42 [Amitié Sincère] 💛'],
    ['accepter', 'NONE', '⚠️ Kichnifou, aucune demande d’ami de Ceo à accepter.'],
    ['refuser', 'RECEIVED', '✅ Demande d’ami de Ceo refusée.'],
    ['refuser', 'NONE', '⚠️ Kichnifou, aucune demande d’ami de Ceo à refuser.'],
    ['annuler', 'SENT', '✅ Demande d’ami envoyée à Ceo annulée.'],
    ['annuler', 'NONE', '⚠️ Kichnifou, aucune demande d’ami envoyée à Ceo à annuler.'],
    ['retirer', 'FRIEND', '✅ Kichnifou et Ceo ne sont plus amis.'],
    ['retirer', 'NONE', '⚠️ Kichnifou, tu n’es pas ami avec Ceo.'],
  ] as const)('%s / %s', async (action, relation, message) => { expect(await harness(relation).run(`${action} Ceo`)).toBe(message); });
  it.each([[1, 'Amitié Sincère', '💛'], [99, 'Amitié Sincère', '💛'], [100, 'Amitié Fusionnelle', '💖'], [300, 'Amitié Légendaire', '🌟'], [1000, 'Amitié Parfaite', '💞']] as const)('restored level %i is truthful', async (level, tier, emoji) => {
    expect(await harness('RECEIVED', level).run('accepter Ceo')).toContain(`${level} [${tier}] ${emoji}`);
  });
  it('has no liste subcommand: the token follows ordinary player lookup', async () => {
    const h = harness('FRIEND');
    expect(await h.run('liste')).toBe('⚠️ Kichnifou, le joueur liste est introuvable.');
    expect(h.find).toHaveBeenCalledWith('liste');
    expect(h.social.friendship.mutate).not.toHaveBeenCalled();
    expect(h.social.friendship.sendHearts).not.toHaveBeenCalled();
  });
  it.each(['NONE', 'RECEIVED', 'SENT'] as const)('separates requests: %s', async relation => {
    expect(await harness(relation).run('demandes')).toBe(`📨 Demandes d’ami | Reçues : ${relation === 'RECEIVED' ? 'Ceo' : 'aucune'} | Envoyées : ${relation === 'SENT' ? 'Ceo' : 'aucune'}`);
  });
  for (const alias of ['coeur', 'cœur', 'coeurs', 'cœurs']) {
    it.each(['Ceo', '@Ceo'])(`${alias} %s uses the existing phrase and reward`, async target => {
      const h = harness('FRIEND');
      expect(await h.run(`${alias} ${target}`)).toBe(`💖💖✨ Kichnifou envoie des cœurs cœurs paillettes à Ceo | ${friendshipPhrases[0]} | Niveau d’amitié : 43 [Amitié Sincère] 💛 | +💠5 Primos chacun`);
      expect(h.social.friendship.sendHearts).toHaveBeenCalledWith('self', 'ceo', 'message', 'INTERNAL_CHAT');
    });
    it.each(['all', '@all'])(`${alias} %s uses authoritative senderReward`, async target => {
      const h = harness('FRIEND'); h.social.friendship.sendHearts.mockResolvedValue({ sent: 2, alreadySent: 1, unavailable: 3, activeFriends: 6, senderReward: '17', status: 'SENT', level: 43, message: '' });
      expect(await h.run(`${alias} ${target}`)).toBe('💖💖✨ Kichnifou envoie des cœurs cœurs paillettes à tous ses amis ! | 2 envoyé(s), 1 déjà fait(s), 3 indisponible(s) | +💠17 Primos pour Kichnifou');
      expect(h.social.friendship.sendHearts).toHaveBeenCalledWith('self', 'all', 'message', 'INTERNAL_CHAT');
    });
  }
  it.each([
    ['ALL_SENT', 'coeur Ceo', '⚠️ Kichnifou, tu as déjà envoyé des cœurs cœurs paillettes à Ceo aujourd’hui.'],
    ['ALL_SENT', 'coeur all', '⚠️ Kichnifou, tu as déjà envoyé des cœurs cœurs paillettes à tous tes amis aujourd’hui.'],
    ['NO_FRIENDS', 'coeur all', '⚠️ Kichnifou, tu n’as aucun ami disponible à qui envoyer un cœur.'],
    ['UNAVAILABLE', 'coeur all', '⚠️ Kichnifou, aucun cœur envoyé. Déjà fait aujourd’hui ou aucun ami disponible.'],
    ['UNAVAILABLE', 'coeur Ceo', '⚠️ Kichnifou, impossible d’envoyer un cœur à Ceo pour le moment.'],
  ])('%s / %s', async (status, command, message) => {
    const h = harness('FRIEND'); h.social.friendship.sendHearts.mockResolvedValue({ sent: 0, alreadySent: 1, unavailable: 0, activeFriends: 1, senderReward: '0', status, level: 42, message: '' });
    expect(await h.run(command)).toBe(message);
  });
  it('handles missing targets, self and non-friends without mutating', async () => {
    const h = harness();
    expect(await h.run('Inconnu')).toBe('⚠️ Kichnifou, le joueur Inconnu est introuvable.');
    expect(await harness().run('Kichnifou')).toBe('⚠️ Kichnifou, tu ne peux pas devenir ami avec toi-même.');
    expect(await harness().run('coeur @Kichnifou')).toBe('⚠️ Kichnifou, tu ne peux pas t’envoyer des cœurs cœurs paillettes à toi-même.');
    expect(await harness().run('coeur Ceo')).toBe('⚠️ Kichnifou, tu n’es pas encore ami avec Ceo. Utilise : !ami Ceo');
    expect(h.social.friendship.mutate).not.toHaveBeenCalled();
    expect(await harness().run('voir @all')).toBe('⚠️ Kichnifou, le joueur all est introuvable.');
  });
  it.each(['Ceo', 'coeur Ceo'])('keeps unavailable errors private: %s', async command => {
    const h = harness(command.startsWith('coeur') ? 'FRIEND' : 'NONE');
    h.social.friendship.mutate.mockRejectedValue(new AppError('blocked by private player', 409, 'SOCIAL_UNAVAILABLE'));
    h.social.friendship.sendHearts.mockRejectedValue(new AppError('private presence', 409, 'SOCIAL_UNAVAILABLE'));
    expect(await h.run(command)).toBe(command.startsWith('coeur') ? '⚠️ Kichnifou, impossible d’envoyer un cœur à Ceo pour le moment.' : '⚠️ Kichnifou, cette interaction avec Ceo est indisponible.');
  });
  it.each(['NONE', 'RECEIVED'] as const)('retries the same action after projection changes: %s', async relation => {
    const h = harness(relation); const first = await h.run('Ceo');
    if (relation === 'NONE') h.state.requests = [{ playerId: 'ceo', direction: 'SENT' }];
    expect(await h.run('Ceo')).toBe(first);
    expect(h.social.friendship.mutate.mock.calls.map(call => call[2])).toEqual([relation === 'NONE' ? 'ADD' : 'ACCEPT', relation === 'NONE' ? 'ADD' : 'ACCEPT']);
  });
  it('does not mask idempotency conflicts or confirmed mutation failures', async () => {
    const h = harness(); h.social.friendship.mutate.mockRejectedValue(new AppError('conflict', 409, 'SOCIAL_IDEMPOTENCY_CONFLICT'));
    await expect(h.run('Ceo')).rejects.toThrow('conflict');
  });
});
