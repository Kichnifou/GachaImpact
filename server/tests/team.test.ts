import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import { BusinessError } from '../src/application/errors.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import {
  ActivatePlayerTeam,
  ClearPlayerTeam,
  CreateNextPlayerTeam,
  DeleteExtraPlayerTeam,
  GetCurrentPlayerTeams,
  RemovePlayerTeamSlot,
  RenamePlayerTeam,
  ReorderPlayerTeams,
  ReorderPlayerTeamSlots,
  SetPlayerTeamSlot,
} from '../src/application/team/team-services.js';
import type { PlayerTeams, TeamStore } from '../src/application/team/team-store.js';
import {
  applyExactMultiplier,
  deriveActiveTeamGachaEffects,
  deriveTeamPassives,
  listTeamPassiveDefinitions,
  TEAM_GACHA_PASSIVE_PARAMETERS,
} from '../src/domain/team/team-passives.js';

const playerId = crypto.randomUUID();
const teamId = crypto.randomUUID();
const otherTeamId = crypto.randomUUID();
const characterId = crypto.randomUUID();
const character = {
  id: characterId, externalKey: 'legacy:20', name: 'Furina', rarity: 5 as const,
  elementKey: 'hydro' as const, classKey: 'support', weaponType: 'sword', region: 'fontaine',
  iconPath: '/furina.png', splashPath: null, wishPath: null, fullbodyPath: null, constellation: 1,
};

function snapshot(activeId: string = teamId): PlayerTeams {
  return {
    teams: [
      { id: teamId, position: 1, name: 'Équipe 1', active: activeId === teamId, slots: [{ position: 1, character }, { position: 2, character: null }, { position: 3, character: null }, { position: 4, character: null }], passives: deriveTeamPassives(['hydro']) },
      { id: otherTeamId, position: 2, name: null, active: activeId === otherTeamId, slots: [{ position: 1, character: null }, { position: 2, character: null }, { position: 3, character: null }, { position: 4, character: null }], passives: [] },
    ],
    availableCharacters: [character],
    passiveReference: listTeamPassiveDefinitions(),
  };
}

class FakeTeamStore implements TeamStore {
  public readonly calls: string[] = [];
  public getOrProvision = vi.fn(async () => snapshot());
  public activate = vi.fn(async (_playerId: string, requestedTeamId: string) => { this.calls.push('activate'); return snapshot(requestedTeamId); });
  public rename = vi.fn(async () => { this.calls.push('rename'); return snapshot(); });
  public createNext = vi.fn(async () => { this.calls.push('create'); return snapshot(); });
  public deleteExtra = vi.fn(async () => { this.calls.push('delete'); return snapshot(); });
  public reorderTeams = vi.fn(async () => { this.calls.push('reorder-teams'); return snapshot(); });
  public setSlot = vi.fn(async () => { this.calls.push('set'); return snapshot(); });
  public reorderSlots = vi.fn(async () => { this.calls.push('reorder-slots'); return snapshot(); });
  public removeSlot = vi.fn(async () => { this.calls.push('remove'); return snapshot(); });
  public clear = vi.fn(async () => { this.calls.push('clear'); return snapshot(); });
}

describe('Team passives', () => {
  it('applies exact integer multipliers with deterministic floor rounding', () => {
    expect(applyExactMultiplier(21n, { numerator: 5, denominator: 4 })).toBe(26n);
    expect(applyExactMultiplier(21n, { numerator: 3, denominator: 2 })).toBe(31n);
  });
  it('derives every element in canonical order and caps each stack at two', () => {
    const passives = deriveTeamPassives(['hydro', 'pyro', 'hydro', 'hydro', 'dendro']);
    expect(passives.map(({ elementKey, stacks }) => [elementKey, stacks])).toEqual([
      ['pyro', 1], ['hydro', 2], ['dendro', 1],
    ]);
    expect(passives[1]?.description).toBe(passives[1]?.levelTwo);
    expect(deriveTeamPassives([])).toEqual([]);
    expect(listTeamPassiveDefinitions()).toHaveLength(7);
  });

  it('uses the short player-facing Primos label in passive descriptions', () => {
    const references = listTeamPassiveDefinitions();
    const anemo = references.find(({ elementKey }) => elementKey === 'anemo');
    const dendro = references.find(({ elementKey }) => elementKey === 'dendro');

    expect(anemo).toMatchObject({ levelOne: expect.stringContaining('80 Primos'), levelTwo: expect.stringContaining('80 Primos') });
    expect(dendro).toMatchObject({ levelOne: expect.stringContaining('40 Primos'), levelTwo: expect.stringContaining('40 Primos') });
    expect(references.flatMap(({ levelOne, levelTwo }) => [levelOne, levelTwo]).join(' ')).not.toContain('Primogemmes');
  });

  it('supports partial and multi-element Teams without inventing extra stacks', () => {
    expect(deriveTeamPassives(['cryo'])).toEqual([expect.objectContaining({ elementKey: 'cryo', stacks: 1 })]);
    expect(deriveTeamPassives(['electro', 'electro', 'geo', 'anemo']).map(({ elementKey, stacks }) => [elementKey, stacks]))
      .toEqual([['electro', 2], ['anemo', 1], ['geo', 1]]);
  });

  it('exposes neutral machine-readable Gacha effects without executing RNG', () => {
    const random = vi.spyOn(Math, 'random');

    expect(deriveActiveTeamGachaEffects([])).toEqual({
      secondaryParticleMultiplier: { numerator: 1, denominator: 1 },
      fiveStarChanceBonusBasisPoints: 0,
      xpReward: null,
      pity5Reward: null,
      primogemRecovery: null,
      secondaryMoraMultiplier: { numerator: 1, denominator: 1 },
      dendroBundle: null,
    });
    expect(random).not.toHaveBeenCalled();
  });

  it('maps one stack of every element to the exact future Gacha parameters', () => {
    expect(deriveActiveTeamGachaEffects(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'])).toEqual({
      secondaryParticleMultiplier: { numerator: 5, denominator: 4 },
      fiveStarChanceBonusBasisPoints: 30,
      xpReward: { oneIn: 20, amount: 1 },
      pity5Reward: { oneIn: 30, amount: 2 },
      primogemRecovery: { oneIn: 12, amount: 80 },
      secondaryMoraMultiplier: { numerator: 5, denominator: 4 },
      dendroBundle: { oneIn: 25, primogems: 40, moras: 1_000, particlesPerElement: 5 },
    });
  });

  it('maps two stacks of every element to the exact future Gacha parameters', () => {
    const elements = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const;

    expect(deriveActiveTeamGachaEffects([...elements, ...elements])).toEqual({
      secondaryParticleMultiplier: { numerator: 3, denominator: 2 },
      fiveStarChanceBonusBasisPoints: 60,
      xpReward: { oneIn: 10, amount: 1 },
      pity5Reward: { oneIn: 20, amount: 2 },
      primogemRecovery: { oneIn: 8, amount: 80 },
      secondaryMoraMultiplier: { numerator: 3, denominator: 2 },
      dendroBundle: { oneIn: 15, primogems: 40, moras: 1_000, particlesPerElement: 5 },
    });
  });

  it('combines elements independently, caps stacks at two and leaves the input untouched', () => {
    const elements = Object.freeze(['pyro', 'pyro', 'pyro', 'hydro', 'geo'] as const);
    const before = [...elements];

    expect(deriveActiveTeamGachaEffects(elements)).toEqual({
      secondaryParticleMultiplier: { numerator: 3, denominator: 2 },
      fiveStarChanceBonusBasisPoints: 30,
      xpReward: null,
      pity5Reward: null,
      primogemRecovery: null,
      secondaryMoraMultiplier: { numerator: 5, denominator: 4 },
      dendroBundle: null,
    });
    expect(elements).toEqual(before);
    expect(TEAM_GACHA_PASSIVE_PARAMETERS.dendro).toEqual({
      bundleOneIn: [25, 15],
      primogems: 40,
      moras: 1_000,
      particlesPerElement: 5,
    });
  });
});

describe('Team HTTP contracts', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function setup() {
    const store = new FakeTeamStore();
    const playerStore = { findByIdentity: async () => ({ id: playerId, displayName: 'Test', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() };
    const currentPlayer = new GetCurrentPlayer(playerStore);
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) },
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
      getCurrentPlayerTeams: new GetCurrentPlayerTeams(currentPlayer, store),
      activatePlayerTeam: new ActivatePlayerTeam(currentPlayer, store),
      renamePlayerTeam: new RenamePlayerTeam(currentPlayer, store),
      createNextPlayerTeam: new CreateNextPlayerTeam(currentPlayer, store),
      deleteExtraPlayerTeam: new DeleteExtraPlayerTeam(currentPlayer, store),
      reorderPlayerTeams: new ReorderPlayerTeams(currentPlayer, store),
      setPlayerTeamSlot: new SetPlayerTeamSlot(currentPlayer, store),
      reorderPlayerTeamSlots: new ReorderPlayerTeamSlots(currentPlayer, store),
      removePlayerTeamSlot: new RemovePlayerTeamSlot(currentPlayer, store),
      clearPlayerTeam: new ClearPlayerTeam(currentPlayer, store),
    });
    apps.push(app);
    return { app, store };
  }

  it('protects all Team endpoints', async () => {
    const { app } = await setup();
    const urls = [
      ['GET', '/api/v1/me/teams'],
      ['PATCH', `/api/v1/me/teams/${teamId}/active`],
      ['PATCH', `/api/v1/me/teams/${teamId}/name`],
      ['POST', '/api/v1/me/teams'],
      ['PUT', '/api/v1/me/teams/order'],
      ['DELETE', `/api/v1/me/teams/${otherTeamId}`],
      ['PUT', `/api/v1/me/teams/${teamId}/slots/1`],
      ['PUT', `/api/v1/me/teams/${teamId}/slots/order`],
      ['DELETE', `/api/v1/me/teams/${teamId}/slots/1`],
      ['DELETE', `/api/v1/me/teams/${teamId}/slots`],
    ] as const;
    for (const [method, url] of urls) expect((await app.inject({ method, url })).statusCode).toBe(401);
  });

  it('reads and mutates only the authenticated Player Team through the shared services', async () => {
    const { app, store } = await setup();
    const headers = { authorization: 'Bearer token' };
    const read = await app.inject({ url: '/api/v1/me/teams', headers });
    expect(read.statusCode).toBe(200);
    expect(read.json().teams).toHaveLength(2);
    expect(read.json().teams[0]).toMatchObject({ position: 1, active: true });
    expect(read.json().teams[0].slots[0]).toMatchObject({ position: 1, character: { name: 'Furina', constellation: 1 } });
    expect(read.json().passiveReference).toHaveLength(7);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/teams/${otherTeamId}/active`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/teams/${teamId}/name`, headers, payload: { name: 'Équipe étoilée' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/teams', headers, payload: { expectedPosition: 11 } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/teams/order', headers, payload: { teamIds: [teamId, otherTeamId, ...Array.from({ length: 8 }, () => crypto.randomUUID())] } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: `/api/v1/me/teams/${teamId}/slots/2`, headers, payload: { characterId } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: `/api/v1/me/teams/${teamId}/slots/order`, headers, payload: { characterIds: [characterId, null, null, null] } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/me/teams/${teamId}/slots/2`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/me/teams/${teamId}/slots`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/me/teams/${otherTeamId}`, headers })).statusCode).toBe(200);
    expect(store.calls).toEqual(['activate', 'rename', 'create', 'reorder-teams', 'set', 'reorder-slots', 'remove', 'clear', 'delete']);
    expect(store.setSlot).toHaveBeenCalledWith(playerId, teamId, 2, characterId);
  });

  it('normalizes optional Team names and rejects names longer than twenty characters', async () => {
    const { app, store } = await setup();
    const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/teams/${teamId}/name`, headers, payload: { name: '  Équipe des étoiles  ' } })).statusCode).toBe(200);
    expect(store.rename).toHaveBeenLastCalledWith(playerId, teamId, 'Équipe des étoiles');
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/teams/${teamId}/name`, headers, payload: { name: '   ' } })).statusCode).toBe(200);
    expect(store.rename).toHaveBeenLastCalledWith(playerId, teamId, null);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/me/teams/${teamId}/name`, headers, payload: { name: '123456789012345678901' } })).statusCode).toBe(422);
  });

  it('rejects invalid identifiers, slots and duplicate business failures explicitly', async () => {
    const { app, store } = await setup();
    const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'PUT', url: `/api/v1/me/teams/${teamId}/slots/5`, headers, payload: { characterId } })).statusCode).toBe(422);
    expect((await app.inject({ method: 'PUT', url: `/api/v1/me/teams/not-a-uuid/slots/1`, headers, payload: { characterId } })).statusCode).toBe(400);
    store.setSlot.mockRejectedValueOnce(new BusinessError('TEAM_CHARACTER_DUPLICATE', 'Déjà présent.'));
    const duplicate = await app.inject({ method: 'PUT', url: `/api/v1/me/teams/${teamId}/slots/1`, headers, payload: { characterId } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: 'TEAM_CHARACTER_DUPLICATE' } });
  });
});
