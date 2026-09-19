import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerGachaRoutes } from '../src/api/routes/gacha.js';
import { registerErrorHandler } from '../src/api/error-handler.js';
import { BusinessError } from '../src/application/errors.js';
import type { BannerVoteService } from '../src/application/gacha/banner-vote-service.js';

describe('banner vote HTTP contract', () => {
  it('requires identity, validates minimal payload and rejects client authority', async () => {
    const app = Fastify(); registerErrorHandler(app);
    const snapshot = { candidates: [], ownVote: null };
    const vote = vi.fn(async () => snapshot);
    await app.register(registerGachaRoutes, {
      authenticate: async request => { if (request.headers.authorization) request.authenticatedIdentity = { subject: 'fixture' }; },
      getCharacters: {} as never, getCurrentGacha: {} as never, setGachaTarget: {} as never,
      bannerVotes: { vote, getCurrent: async () => snapshot } as unknown as BannerVoteService,
    });
    try {
      expect((await app.inject({ url: '/api/v1/gacha/vote' })).statusCode).toBe(401);
      const headers = { authorization: 'Bearer fixture' };
      expect((await app.inject({ url: '/api/v1/gacha/vote', headers })).json()).toEqual(snapshot);
      const payload = { characterId: crypto.randomUUID(), bannerRotationId: crypto.randomUUID() };
      expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/vote', headers, payload: { ...payload, playerId: crypto.randomUUID(), voteCount: 99, sourceChannel: 'TWITCH' } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/vote', headers, payload })).statusCode).toBe(200);
      expect(vote).toHaveBeenCalledWith({ subject: 'fixture' }, payload.characterId, payload.bannerRotationId);
      vote.mockRejectedValueOnce(new BusinessError('BANNER_VOTE_USED', 'Déjà voté'));
      expect((await app.inject({ method: 'POST', url: '/api/v1/gacha/vote', headers, payload })).statusCode).toBe(409);
    } finally { await app.close(); }
  });
});
