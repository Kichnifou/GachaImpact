import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { TwitchFavorChatPresenceConsumer, isFavorEligibleTwitchChatMessage } from '../src/application/twitch/twitch-favor-chat-presence-consumer.js';

describe('Twitch Favor message classification', () => {
  it.each([['bonjour', true], [' bonjour ', true], ['!faveur', false], ['   !pull 1', false], [' \t\n', false], ['', false]])('classifies %j without storing text', (text, expected) => {
    expect(isFavorEligibleTwitchChatMessage(text as string)).toBe(expected);
  });
});

describe('Twitch Favor temporal identity boundary', () => {
  it.each(['missing-receipt', 'other-event', 'missing-identity', 'later-link', 'inactive-player', 'resolved', 'equal-link'])('handles %s through durable proof only', async mode => {
    const receivedAt = new Date('2026-09-29T12:00:00Z');
    const receipt = { eventType: mode === 'other-event' ? 'channel.subscribe' : 'channel.chat.message', twitchUserId: '42', receivedAt, state: 'RECEIVED', processedAt: null, externalReference: null };
    const identity = { linkedAt: new Date(+receivedAt + (mode === 'later-link' ? 1 : mode === 'equal-link' ? 0 : -1)), playerId: 'server-player', player: { status: mode === 'inactive-player' ? 'ARCHIVED' : 'ACTIVE' } };
    const db = { twitchEventReceipt: { findUnique: vi.fn().mockResolvedValue(mode === 'missing-receipt' ? null : receipt) }, twitchIdentity: { findUnique: vi.fn().mockResolvedValue(mode === 'missing-identity' ? null : identity) } };
    const claim = vi.spyOn(FavorService.prototype, 'claimToday').mockResolvedValue({ status: 'ALREADY_CLAIMED', businessDate: '2026-09-29', creditedPrimogems: '0', operationId: null });
    try {
      const result = await new TwitchFavorChatPresenceConsumer(db as unknown as PrismaClient, { now: () => receivedAt }).consume('durable-receipt');
      if (mode === 'resolved' || mode === 'equal-link') {
        expect(claim).toHaveBeenCalledExactlyOnceWith('server-player', 'TWITCH');
        expect(result.status).toBe('ALREADY_CLAIMED');
      } else { expect(claim).not.toHaveBeenCalled(); expect(result.status).toBe('IGNORED'); }
      expect(db.twitchEventReceipt.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'durable-receipt' } }));
    } finally { claim.mockRestore(); }
  });
});
