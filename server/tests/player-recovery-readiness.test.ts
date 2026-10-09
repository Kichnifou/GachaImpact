import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../src/api/errors.js';
import { EventService } from '../src/application/event/event-service.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import {
  assertPlayerDomainReady, isPlayerDomainReady, optionalRecoveryDomain, parsePlayerRecovery,
  recoveryAllowsDomain, recoveryDomains, recoveryUnavailable,
} from '../src/application/player/player-recovery-readiness.js';
import { resolvePlayerCommand, type PlayerCommandServices } from '../src/application/chat/player-command-core.js';
import { harness, commandId } from './helpers/chat-command-harness.js';

const marker = () => ({ version: 1, operationId: randomUUID(), importId: randomUUID(),
  snapshotHash: 'a'.repeat(64), populationHash: 'b'.repeat(64), backupHash: 'c'.repeat(64), restrictedDomains: [...recoveryDomains] });
const actor = verifiedPlayerActor({ id: randomUUID(), displayName: 'Recovery fixture', elementKey: 'hydro', status: 'ACTIVE' });
const getPlayer = new GetCurrentPlayer({ findByIdentity: vi.fn(), provision: vi.fn() });

describe('recovery readiness contract', () => {
  it('keeps null markers compatible and opens only explicitly restored domains', () => {
    for (const domain of recoveryDomains) expect(recoveryAllowsDomain(null, domain)).toBe(true);
    const state = { ...marker(), restrictedDomains: ['BOSS'] };
    expect(parsePlayerRecovery(state)).toEqual(state);
    expect(recoveryAllowsDomain(state, 'EVENT')).toBe(true);
    expect(recoveryAllowsDomain(state, 'BOSS')).toBe(false);
  });
  it.each([undefined, {}, { version: 2 }, { ...marker(), restrictedDomains: ['OTHER'] },
    { ...marker(), restrictedDomains: ['EVENT', 'EVENT'] }, { ...marker(), backupHash: '' }, { ...marker(), extra: true }])(
    'fails closed for malformed persisted state %j', value => {
      expect(() => parsePlayerRecovery(value)).toThrow(expect.objectContaining({ code: 'PLAYER_RECOVERY_STATE_INVALID' }));
      for (const domain of recoveryDomains) expect(recoveryAllowsDomain(value, domain)).toBe(false);
    });
  it('does not swallow database failures in automatic paths', async () => {
    const failure = new Error('database unavailable');
    const db = { player: { findUnique: vi.fn().mockRejectedValue(failure) } } as unknown as PrismaClient;
    await expect(isPlayerDomainReady(db, randomUUID(), 'EVENT')).rejects.toBe(failure);
    await expect(assertPlayerDomainReady(db, randomUUID(), 'EVENT')).rejects.toBe(failure);
    await expect(optionalRecoveryDomain(Promise.reject(failure))).rejects.toBe(failure);
    await expect(optionalRecoveryDomain(Promise.reject(new AppError('Autre erreur', 409, 'OTHER')))).rejects.toMatchObject({ code: 'OTHER' });
  });
});

describe('restricted services refuse before RNG, reservations or business writes', () => {
  it('guards every Event entry, including GET, daily bonus and message consultation', async () => {
    const nextInt = vi.fn(() => 0), transaction = vi.fn();
    const db = { player: { findUnique: vi.fn().mockResolvedValue({ legacyRecovery: marker() }) }, $transaction: transaction } as unknown as PrismaClient;
    const service = new EventService(getPlayer, db, { now: () => new Date('2026-10-09T10:00:00Z') }, { nextInt });
    const calls = [() => service.getCurrent(actor), () => service.getRanking(actor), () => service.join(actor, randomUUID()),
      () => service.attemptGameA(actor, randomUUID()), () => service.attemptGameB(actor, '00000', randomUUID()),
      () => service.searchGameCRecipients(actor, { q: '', sort: 'name', direction: 'asc', page: 1 }),
      () => service.sendGameC(actor, randomUUID(), 'Bonjour', randomUUID()), () => service.consultGameCMessages(actor),
      () => service.claimCalendar(actor, randomUUID()), () => service.claimDailyBonus(actor, randomUUID()),
      () => service.convertShop(actor, 'PRIMOGEMS', 1, randomUUID()), () => service.purchaseCollection(actor, randomUUID())];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE' });
    expect(nextInt).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
  });
  it('guards Boss consultation, formation and attack before creating a current Boss', async () => {
    const nextInt = vi.fn(() => 0), transaction = vi.fn();
    const db = { player: { findUnique: vi.fn().mockResolvedValue({ legacyRecovery: marker() }) }, $transaction: transaction } as unknown as PrismaClient;
    const service = new MonthlyBossService(getPlayer, db, { now: () => new Date('2026-10-09T10:00:00Z') }, { nextInt });
    const calls = [() => service.getCurrent(actor), () => service.getCurrentForChat(actor),
      () => service.setSlot(actor, 1, randomUUID()), () => service.removeSlot(actor, 1), () => service.copyActiveTeam(actor),
      () => service.clearLoadout(actor), () => service.attack(actor, randomUUID(), randomUUID()),
      () => service.attackWithActiveTeam(actor, randomUUID())];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: 'PLAYER_DOMAIN_TEMPORARILY_UNAVAILABLE' });
    expect(nextInt).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
  });
  it('refuses unavailable Game C recipients before preparing the edition or daily RNG', async () => {
    const nextInt = vi.fn(() => 0), transaction = vi.fn(), findFirst = vi.fn();
    const db = { player: { findUnique: vi.fn().mockResolvedValue({ legacyRecovery: null }), findFirst }, $transaction: transaction } as unknown as PrismaClient;
    const service = new EventService(getPlayer, db, { now: () => new Date('2026-10-09T10:00:00Z') }, { nextInt });
    const editionResolver = vi.spyOn(service, 'resolveCurrentEdition');
    for (const recipient of [null, { legacyRecovery: marker() }, { legacyRecovery: {} }]) {
      findFirst.mockResolvedValue(recipient);
      await expect(service.sendGameC(actor, randomUUID(), 'Bonjour', randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_C_CONTACT_UNAVAILABLE' });
    }
    expect(editionResolver).not.toHaveBeenCalled(); expect(nextInt).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
  });
  it('keeps quotis useful without presenting closed domains as completed', async () => {
    const fixture = harness();
    fixture.services.eventService.getCurrent.mockRejectedValue(recoveryUnavailable('EVENT'));
    fixture.services.monthlyBossService.getCurrentForChat.mockRejectedValue(recoveryUnavailable('BOSS'));
    const output = await resolvePlayerCommand(actor, 'quotis', [], '!quotis', commandId, fixture.services as unknown as PlayerCommandServices);
    const text = typeof output === 'string' ? output : output.join(' ');
    expect(text).toContain('Boss : temporairement indisponible');
    expect(text).toContain('Event : temporairement indisponible');
    expect(text).toContain('Expédition'); expect(text).toContain('Roue');
    expect(text).not.toMatch(/Boss ✅|Event ✅|legacy/iu);
  });
});
