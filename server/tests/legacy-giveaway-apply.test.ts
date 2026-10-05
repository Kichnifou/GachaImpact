import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { applyLegacyGiveaway } from '../src/application/migration/legacy-giveaway-apply.js';
import type { LegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';

const aliceId = '00000000-0000-4000-a000-000000000001';
const bobId = '00000000-0000-4000-a000-000000000002';
const sessionId = '00000000-0000-4000-a000-000000000003';

function fixture(giveaway: Record<string, unknown>) {
  const files: Record<string, string> = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
  files['giveaway.json'] = JSON.stringify({ status: 'closed', winner: 'alice', participants: [], messageCounts: {}, ...giveaway });
  const snapshot = parseStreamerbotSnapshot(files);
  const plan = { players: [
    { legacyUsername: 'alice', playerId: aliceId }, { legacyUsername: 'bob', playerId: bobId },
  ] } as LegacyGlobalPlan;
  const createSession = vi.fn(async (_args: { data: Record<string, unknown> }) => ({ id: sessionId }));
  const createWin = vi.fn(async (_args: { data: Record<string, unknown> }) => ({}));
  const tx = { giveawaySession: { create: createSession }, giveawayWin: { create: createWin },
    giveawayParticipant: { create: vi.fn(async () => ({})) },
    giveawayChatStat: { create: vi.fn(async () => ({})) } } as unknown as Prisma.TransactionClient;
  return { snapshot, plan, tx, createSession, createWin };
}

describe('legacy Giveaway optional reroll facts', () => {
  it('defers a quarantined previous winner without inventing an identity or another result', async () => {
    const { snapshot, plan, tx, createSession, createWin } = fixture({ previousWinner: 'bob' });
    plan.players = plan.players.filter(row => row.legacyUsername !== 'bob'); plan.identityQuarantined = ['bob'];
    await expect(applyLegacyGiveaway(tx, snapshot, plan, 'private-batch')).resolves.toMatchObject({ wins: 1 });
    expect(createSession.mock.calls[0]![0]).toMatchObject({ data: { winnerPlayerId: aliceId, previousWinnerPlayerId: null } });
    expect(createWin).toHaveBeenCalledOnce();
  });
  it('keeps the current winner without inventing reroll facts when fields are absent', async () => {
    const { snapshot, plan, tx, createSession, createWin } = fixture({});
    await expect(applyLegacyGiveaway(tx, snapshot, plan, 'private-batch')).resolves.toMatchObject({ sessions: 1, wins: 1, rewardsCreated: 0 });
    expect(createSession.mock.calls[0]![0]).toMatchObject({ data: {
      winnerPlayerId: aliceId, previousWinnerPlayerId: null, rerolledAt: null, rerollCount: null,
    } });
    expect(createWin).toHaveBeenCalledTimes(1);
    expect(createWin.mock.calls[0]![0]).toMatchObject({ data: { playerId: aliceId, drawIndex: 0, origin: 'LEGACY' } });
  });

  it('preserves the immediately previous winner and reroll instant without reconstructing the draw sequence', async () => {
    const { snapshot, plan, tx, createSession, createWin } = fixture({
      previousWinner: 'bob', rerolledAt: '2026-09-26 20:15:00',
    });
    await applyLegacyGiveaway(tx, snapshot, plan, 'private-batch');
    expect(createSession.mock.calls[0]![0]).toMatchObject({ data: {
      winnerPlayerId: aliceId, previousWinnerPlayerId: bobId,
      rerolledAt: new Date('2026-09-26T18:15:00.000Z'), rerollCount: null,
      legacyProvenance: { previousWinnerRole: 'IMMEDIATE_PREDECESSOR_ONLY' },
    } });
    expect(createWin).toHaveBeenCalledTimes(1);
    expect(createWin.mock.calls[0]![0]).toMatchObject({ data: { playerId: aliceId, drawIndex: 0 } });
  });

  it('blocks a previous winner outside the migrable population before writing', async () => {
    const { snapshot, plan, tx, createSession } = fixture({ previousWinner: 'excluded' });
    await expect(applyLegacyGiveaway(tx, snapshot, plan, 'private-batch')).rejects.toThrow('previousWinner is outside the migrable population');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('blocks an invalid present reroll instant before writing', async () => {
    const { snapshot, plan, tx, createSession } = fixture({ rerolledAt: '2026-02-30 20:15:00' });
    await expect(applyLegacyGiveaway(tx, snapshot, plan, 'private-batch')).rejects.toThrow('Invalid present Giveaway instant');
    expect(createSession).not.toHaveBeenCalled();
  });
});
