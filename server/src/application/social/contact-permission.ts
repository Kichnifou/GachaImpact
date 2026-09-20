import { Prisma } from '../../../generated/prisma/client.js';

// Social owns this policy. Event messages use the same block, friendship and
// private-message permission primitives; they do not create Event-only rules.
export const PRIVATE_MESSAGES_CATEGORY = 'PRIVATE_MESSAGES';

export function unblockedRecipient(senderPlayerId: string): Prisma.PlayerWhereInput {
  return {
    id: { not: senderPlayerId }, status: 'ACTIVE',
    blocksCreated: { none: { blockedPlayerId: senderPlayerId } },
    blocksReceived: { none: { blockerPlayerId: senderPlayerId } },
  };
}

export function eligibleContactRecipient(senderPlayerId: string): Prisma.PlayerWhereInput {
  const activeFriendship: Prisma.PlayerWhereInput[] = [
    { friendshipsAsA: { some: { playerBId: senderPlayerId, state: 'ACTIVE' } } },
    { friendshipsAsB: { some: { playerAId: senderPlayerId, state: 'ACTIVE' } } },
  ];
  return {
    ...unblockedRecipient(senderPlayerId),
    OR: [
      { privacySettings: { none: { categoryKey: PRIVATE_MESSAGES_CATEGORY } } },
      { privacySettings: { some: { categoryKey: PRIVATE_MESSAGES_CATEGORY, level: 'PUBLIC' } } },
      { AND: [
        { privacySettings: { some: { categoryKey: PRIVATE_MESSAGES_CATEGORY, level: 'FRIENDS' } } },
        { OR: activeFriendship },
      ] },
    ],
  };
}
