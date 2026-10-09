import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GiftCodeService } from '../src/application/gift-code/gift-code-service.js';
import { buildApp } from '../src/app.js';

describe('Gift code HTTP contracts', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
  async function setup() {
    const editionId = randomUUID(); const codeId = randomUUID();
    const playerResult = { available: [{ id: codeId, editionId, token: 'FESTIVALRECOLTES', title: 'Festival des Récoltes', description: 'Septembre', type: 'ANNUAL', editionKey: '2026', startsAt: new Date().toISOString(), endsAt: new Date().toISOString(), available: true, claimed: false, claimedAt: null, rewards: [{ resourceKey: 'primogems', displayName: 'Primogemmes', amount: '1600' }] }], claimed: [] };
    const adminResult = { actorPlayerId: randomUUID(), page: 1, pageSize: 20, total: 0, totalPages: 1, codes: [] };
    const mutationResult = { code: {} };
    const service = { listForPlayer: vi.fn(async () => playerResult), claim: vi.fn(async () => ({ ...playerResult, resources: {}, operation: { id: randomUUID(), alreadyProcessed: false } })), listAdmin: vi.fn(async () => adminResult), createDraft: vi.fn(async () => mutationResult), publish: vi.fn(async () => mutationResult), update: vi.fn(async () => mutationResult), claimants: vi.fn(async () => ({ code: {}, page: 1, pageSize: 20, total: 0, totalPages: 1, claimants: [] })) } as unknown as GiftCodeService;
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: { execute: vi.fn() } as never, giftCodeService: service }); apps.push(app); return { app, service, editionId, codeId };
  }
  it('protects player routes and validates idempotent claims', async () => {
    const { app, service, editionId } = await setup(); const headers = { authorization: 'Bearer token' }; const key = randomUUID();
    expect((await app.inject({ url: '/api/v1/me/gift-codes' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/me/gift-codes', headers })).json()).toMatchObject({ available: [{ token: 'FESTIVALRECOLTES' }] });
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/gift-codes/${editionId}/claim`, headers, payload: { idempotencyKey: key } })).statusCode).toBe(200);
    expect(service.claim).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), editionId, key);
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/gift-codes/${editionId}/claim`, headers, payload: { idempotencyKey: 'bad', extra: true } })).statusCode).toBe(400);
  });
  it('exposes the ADMIN management contract through authenticated routes', async () => {
    const { app, service, codeId } = await setup(); const headers = { authorization: 'Bearer token' }; const key = randomUUID();
    expect((await app.inject({ url: '/api/v1/moderation/gift-codes?page=2&search=festival&status=PUBLISHED&type=ANNUAL&availability=CURRENT&sort=claims&direction=asc', headers })).statusCode).toBe(200);
    expect(service.listAdmin).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), { page: 2, search: 'festival', status: 'PUBLISHED', type: 'ANNUAL', availability: 'CURRENT', sort: 'claims', direction: 'asc' });
    await app.inject({ method: 'POST', url: `/api/v1/moderation/gift-codes/${codeId}/publish`, headers, payload: { idempotencyKey: key } });
    expect(service.publish).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), codeId, key);
    const updateKey = randomUUID();
    const update = await app.inject({ method: 'PATCH', url: `/api/v1/moderation/gift-codes/${codeId}`, headers, payload: { token: 'CADEAU-EDIT', type: 'ONE_OFF', rewards: [{ resourceKey: 'moras', amount: '456' }], idempotencyKey: updateKey } });
    expect(update.statusCode).toBe(200);
    expect(service.update).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), codeId, expect.objectContaining({ token: 'CADEAU-EDIT', type: 'ONE_OFF', rewards: [{ resourceKey: 'moras', amount: 456n }], idempotencyKey: updateKey }));
    await app.inject({ url: `/api/v1/moderation/gift-codes/${codeId}/claimants?page=3&search=myno&editionKey=2026`, headers });
    expect(service.claimants).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), codeId, { page: 3, search: 'myno', editionKey: '2026' });
  });
  it('accepts all twelve configured reward keys with lossless quantities and rejects unrelated keys', async () => {
    const { app, service } = await setup(), headers = { authorization: 'Bearer token' };
    const rewards = [{ resourceKey: 'masterless-stella-fortuna', amount: '3' }, { resourceKey: 'event_points', amount: '80' }, { resourceKey: 'event_currency', amount: '9223372036854775807' }];
    const payload = { title: 'Private test', description: 'Private only', type: 'ONE_OFF', rewards, idempotencyKey: randomUUID() };
    const response = await app.inject({ method: 'POST', url: '/api/v1/moderation/gift-codes', headers, payload });
    expect(response.statusCode).toBe(200);
    expect(service.createDraft).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ rewards: rewards.map(reward => ({ ...reward, amount: BigInt(reward.amount) })) }));
    for (const invalid of [{ resourceKey: 'xp', amount: '1' }, { resourceKey: 'event_currency', amount: '1'.repeat(100) }, { resourceKey: 'event_points', amount: '-1' }]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/gift-codes', headers, payload: { ...payload, rewards: [invalid] } })).statusCode).toBe(400);
    }
  });
});
