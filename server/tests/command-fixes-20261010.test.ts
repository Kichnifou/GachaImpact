import { describe, expect, it, vi } from 'vitest';
import { harness, actor } from './helpers/chat-command-harness.js';
import { PlayerCommandResolver, type ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import type { PlayerCommandContext } from '../src/application/chat/player-command-context.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { eventPhrase } from '../src/application/chat/event-command-result.js';
import { twitchTeamSyntax } from '../src/application/chat/team-command.js';
import { commandIntentServices, CommandPrepared, type FrozenCommandIntent } from '../src/application/twitch/twitch-command-intent.js';

function setup() {
  const h = harness();
  const services = h.services as unknown as ChatCommandServices;
  const resolver = new PlayerCommandResolver(h.chat as unknown as PlayerCommandContext, services, 'TWITCH');
  const run = (text: string) => withPlayerCommandExecution({ source: 'TWITCH', now: new Date('2026-10-10T08:00:00Z'), responseBodyLimit: 424 }, () => resolver.resolve(actor, text, 'new-command'));
  return { ...h, services, run };
}
const joined = (result: string | readonly string[]) => typeof result === 'string' ? result : result.join(' ');
const bounded = (result: string | readonly string[]) => {
  const parts = typeof result === 'string' ? [result] : result;
  expect(parts.every(part => Array.from(part).length <= 424 && !/[\r\n]/u.test(part))).toBe(true);
};

describe('Ticket presentation', () => {
  it.each([50_000n, 12_345n])('reports the real %s Mora refund without changing price or wallet', async amount => {
    const h = setup();
    h.services.purchaseShopItemChat.execute = vi.fn(async () => ({ purchase: { quantity: 1n, displayName: 'Ticket', totalPrice: 150_000n, effect: { type: 'ticket_resource', amount, resourceKey: 'moras' } }, walletMorasAfter: 17n })) as never;
    const text = await h.run('!shop ticket');
    expect(joined(text)).toContain(`💰 remboursement +${amount.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/gu, ' ')} Moras`);
    expect(joined(text)).not.toContain('150 000 Moras'); expect(joined(text)).toContain('Reste 💰 17 Moras'); bounded(text);
    expect(h.services.purchaseShopItemChat.execute).toHaveBeenCalledWith(actor, 'ticket', 1n, 'new-command');
  });
  it.each(['primogems', 'particles_pyro'])('does not label a Ticket %s reward as a refund', async resourceKey => {
    const h = setup(); h.services.purchaseShopItemChat.execute = vi.fn(async () => ({ purchase: { quantity: 1n, displayName: 'Ticket', totalPrice: 150_000n, effect: { type: 'ticket_resource', amount: 123n, resourceKey } }, walletMorasAfter: 17n })) as never;
    expect(joined(await h.run('!shop ticket'))).not.toContain('Remboursement');
  });
});

describe('Legends exact resolution and privacy', () => {
  function legendSetup(name: string) {
    const h = setup(); h.services.getCharacters.execute = vi.fn(async () => [{ id: 'c6', name }]) as never;
    const base = { character: { name, elementKey: 'electro' }, stats: { strength: 3, intelligence: 7, beauty: 6, charisma: 5, popularity: 4 }, totals: { contests: '9', wins: '2' }, themes: { STRENGTH: { title: 'Titre thème', wins: '2', participations: '9' } } };
    h.services.socialService.legends = vi.fn(async () => ({ access: 'ALLOWED', data: { characters: [base.character], legends: [base] } })) as never;
    return h;
  }
  it.each(['skirk', 'Yae Miko'])('recognizes personal %s without mistaking it for a player', async name => {
    const h = legendSetup(name); const text = joined(await h.run(`!legende ${name}`));
    expect(h.services.socialService.legends).toHaveBeenCalledWith(actor, 'self', true);
    expect(text).toContain('💪 Force 3 · 🧠 Intelligence 7 · ✨ Beauté 6 · 👑 Charisme 5 · 🎭 Popularité 4');
    expect(text).toContain('Concours 9, victoires 2'); expect(text).toContain('Titre thème (2/9 victoires)');
  });
  it.each(['!legende', '!legendes', '!légende', '!légendes', '!leg'])('preserves list alias %s', async command => {
    const h = legendSetup('Skirk'); await h.run(command); expect(h.services.socialService.legends).toHaveBeenCalledWith(actor, 'self', false);
  });
  it.each(['moi Yae Miko', 'me Yae Miko', '@Autre Yae Miko', 'Autre Yae Miko', '@Autre', 'Autre'])('resolves explicit syntax %s', async args => {
    const h = legendSetup('Yae Miko'); await h.run(`!legende ${args}`);
    expect(h.services.socialService.legends).toHaveBeenCalledWith(actor, /Autre/u.test(args) ? 'other' : 'self', args.includes('Yae'));
  });
  it('requires clarification before any private read on a real identity/catalog collision', async () => {
    const h = legendSetup('Skirk'); h.services.socialService.directory = vi.fn(async () => ({ players: [{ id: 'other', displayName: 'Skirk' }], totalPages: 1 })) as never;
    expect(joined(await h.run('!legende Skirk'))).toContain('Nom ambigu'); expect(h.services.socialService.legends).not.toHaveBeenCalled();
    await h.run('!legende moi Skirk'); expect(h.services.socialService.legends).toHaveBeenLastCalledWith(actor, 'self', true);
    await h.run('!legende @Skirk'); expect(h.services.socialService.legends).toHaveBeenLastCalledWith(actor, 'other', false);
  });
  it('does not use partial character matches and refuses private third-party details', async () => {
    const h = legendSetup('Yae Miko'); expect(await h.run('!legende Yae')).toBe('Joueur introuvable.');
    h.services.socialService.legends = vi.fn(async () => ({ access: 'PRIVATE' })) as never;
    const text = joined(await h.run('!legende @Autre Yae Miko')); expect(text).toContain('privées'); expect(text).not.toMatch(/Force|Concours|Titre/u);
    expect(await h.run('!concours go')).toBe('🏆 Concours : prochainement disponible.');
  });
});

describe('Missions, Event and daily projections', () => {
  it('separates permanent rank summary from every unfinished accessible mission, including unstarted ones', async () => {
    const h = setup(); const summary = joined(await h.run('!mission'));
    expect(summary).toBe('🎯 Rangs : B [1/9] · A [0/9] · S [0/9] · Z verrouillé | !mission [rang] | !mission resume');
    const resume = await h.run('!mission resume'); bounded(resume);
    expect(joined(resume)).toContain('B · Mission B 2 1/9'); expect(joined(resume)).toContain('A · Mission A 1 0/20'); expect(joined(resume)).toContain('S · Mission S 9 0/30');
    expect(joined(resume)).not.toContain('Mission B 1 '); expect(joined(resume)).not.toContain('Z ·');
    expect(h.services.getDailyChallenge.execute).not.toHaveBeenCalled();
  });
  it('includes unlocked Z and has an honest all-complete response', async () => {
    const h = setup(); const base = await h.services.getCurrentPlayerMissions.execute(actor);
    const complete = Object.fromEntries(Object.entries(base.ranks).map(([rank, entries]) => [rank, entries.map(m => ({ ...m, status: 'COMPLETED' }))]));
    h.services.getCurrentPlayerMissions.execute = vi.fn(async () => ({ ...base, ranks: complete, z: { status: 'LOCKED' } })) as never;
    expect(joined(await h.run('!mission resume'))).toContain('Rien à poursuivre');
    h.services.getCurrentPlayerMissions.execute = vi.fn(async () => ({ ...base, ranks: complete, z: { status: 'ACTIVE', missions: [{ ...base.ranks.B[1], rank: 'Z', displayName: 'Objectif Z', progress: 2n }] } })) as never;
    expect(joined(await h.run('!mission resume'))).toContain('Z · Objectif Z 2/9');
  });
  it('formats the original Paris windows without changing the projection', async () => {
    const h = setup(); const view = await h.services.eventService.getCurrent(actor);
    view.gameA.windows = [{ startAt: '2026-10-10T07:10:00Z', endAt: '2026-10-10T08:10:00Z' }, { startAt: '2026-10-10T14:47:00Z', endAt: '2026-10-10T15:47:00Z' }, { startAt: '2026-10-10T17:45:00Z', endAt: '2026-10-10T18:45:00Z' }] as never;
    const before = structuredClone(view); const text = eventPhrase(view, 'gameAOutside', 'Moi');
    expect(text).toContain('09h10 à 10h10'); expect(text).toContain('16h47 à 17h47'); expect(text).toContain('19h45 à 20h45'); expect(view).toEqual(before);
  });
  it.each(['quoti', 'quotis', 'daily'])('shows authoritative expedition time and no Favor in %s', async alias => {
    const h = setup(); const state = await h.services.expeditionService.getState(actor);
    h.services.expeditionService.getState = vi.fn(async () => ({ ...state, operationalStatus: 'RUNNING', remainingSeconds: 26_220, startedOnCurrentBusinessDate: false })) as never;
    const text = await h.run(`!${alias}`); bounded(text); expect(joined(text)).toContain('Expédition ⏳ · Reste 7 h 17 min'); expect(joined(text)).not.toContain('Faveur');
    expect(h.services.socialService.favor).not.toHaveBeenCalled();
  });
  it('does not fabricate time in ready or idle states and preserves the separate Favor command', async () => {
    const h = setup(); const state = await h.services.expeditionService.getState(actor);
    for (const operationalStatus of ['READY', 'IDLE']) {
      h.services.expeditionService.getState = vi.fn(async () => ({ ...state, operationalStatus, remainingSeconds: 99 })) as never;
      expect(joined(await h.run('!quotis'))).not.toContain('Reste');
    }
    expect(joined(await h.run('!faveur'))).toContain('Faveur'); expect(h.services.socialService.favor).toHaveBeenCalled();
  });
});

describe('Twitch Team and combat output', () => {
  it.each(['help', 'nwe', 'create extra', 'new extra', '1 apply extra', 'add', 'rename sans guillemets', 'liste 0', 'save'])('returns the condensed Team help for %s without mutation', async args => {
    const h = setup(); expect(await h.run(`!team ${args}`)).toBe(twitchTeamSyntax); expect(h.services.activatePlayerTeam.execute).not.toHaveBeenCalled();
  });
  it('merges confirmation, composition and real passives into a single logical response', async () => {
    const h = setup(); const state = await h.services.getCurrentPlayerTeams.execute(actor);
    h.services.getCurrentPlayerTeams.execute = vi.fn(async () => ({ ...state, teams: state.teams.map(t => ({ ...t, id: 'team-1' })) }));
    const updated = await h.services.getCurrentPlayerTeams.execute(actor);
    h.services.activatePlayerTeam.execute = vi.fn(async () => updated);
    const text = await h.run('!team 1 apply'); expect(text).toHaveLength(1); bounded(text);
    expect(joined(text)).toContain('Team 1 activée | 🔥 A (C0) | 🧩 Passifs : 🔥 ×1,25 particules'); expect(joined(text)).not.toContain('Passifs actifs');
  });
  it.each([true, false])('prints four actual combat members in order with one label (won=%s)', async won => {
    const h = setup(); const base = await h.services.dailyCombatService.fight(actor, 'base', 'ACTIVE_TEAM', 'TWITCH');
    const characters = ['Cyno', 'Keqing', 'Yae Miko', 'Sangonomiya Kokomi'].map((name, index) => ({ id: String(index), name, elementKey: index < 3 ? 'electro' : 'hydro', constellation: [2, 6, 3, 0][index] }));
    h.services.dailyCombatService.fight = vi.fn(async () => ({ ...base, result: { ...base.result, won, mode: 'MANUAL', characters } })) as never;
    const output = await h.run('!combat go'); const text = joined(output); bounded(output);
    expect(text.match(/Team :/gu)).toHaveLength(1); expect(text).toContain('Team : ⚡ Cyno (C2) - ⚡ Keqing (C6) - ⚡ Yae Miko (C3) - 💧 Sangonomiya Kokomi (C0)');
    expect(h.services.dailyCombatService.fight).toHaveBeenCalledWith(actor, 'new-command', 'ACTIVE_TEAM', 'TWITCH');
    expect(text.includes('KO jusqu’à demain')).toBe(!won); expect(text.includes('Gain :')).toBe(won);
  });
  it('freezes the new available-selection mutation in the existing Twitch intent protocol', async () => {
    const h = setup(); Object.assign(h.services, { createNextPlayerTeam: { execute: vi.fn() } });
    const intent: FrozenCommandIntent = { now: '2026-10-10T08:00:00Z', reads: {}, memory: {} };
    const chat = { ...h.chat, rememberCommandText: vi.fn(async (_id: string, field: string, value: string) => intent.memory[field] ??= value) };
    const wrapped = commandIntentServices(h.services, actor, intent, 'PREPARE');
    await expect(new PlayerCommandResolver(chat as unknown as PlayerCommandContext, wrapped, 'TWITCH').resolve(actor, '!team create', 'new-key')).rejects.toBeInstanceOf(CommandPrepared);
    expect(intent.mutation?.path).toBe('createNextPlayerTeam.execute'); expect(JSON.stringify(intent.mutation?.args)).toContain('AVAILABLE');
    expect(h.services.createNextPlayerTeam.execute).not.toHaveBeenCalled();
  });
});
