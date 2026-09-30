import type { ElementKey } from './types'

export type AdminMutationDto = Readonly<{ operationId: string; alreadyProcessed: boolean }>
export type AdminPage<T> = Readonly<{ page: number; pageSize: number; total: number; totalPages: number; entries: readonly T[] }>
export type AdminCharacter = Readonly<{ id: string; externalKey: string; name: string; rarity: 4 | 5; elementKey: ElementKey;
  weaponType: string | null; region: string | null; classKey: string | null; iconPath: string | null; splashPath: string | null;
  wishPath: string | null; fullbodyPath: string | null; displayOrder: number | null; isActive: boolean; createdAt: string; updatedAt: string }>
export type AdminCharacterFields = Readonly<{ name: string; rarity: 4 | 5; elementKey: ElementKey; weaponType?: string | null;
  region?: string | null; classKey?: string | null; displayOrder?: number | null; isActive?: boolean }>
export type AdminPossession = Readonly<{ playerId: string; characterId: string; constellation: number; copies: number;
  firstObtainedAt: string; favorite: boolean; character: Pick<AdminCharacter, 'name' | 'rarity' | 'elementKey' | 'externalKey' | 'isActive'> }>
export type AdminFeatured = Readonly<{ characterId: string; rarity: number; slot: number; selectionSource: string;
  character: { name: string; isActive: boolean; rarity: number } }>
export type AdminRotation = Readonly<{ id: string; startsAt: string; endsAt: string; status: string;
  generationVoteSnapshot: unknown; legacyProvenance: unknown; featuredCharacters: readonly AdminFeatured[] }>
export type AdminBannerOverview = Readonly<{ active: AdminRotation | null; next: AdminRotation | null;
  currentWeek: { startsAt: string; endsAt: string };
  voteCycle: { candidates: readonly { id: string; name: string; voteCount: number }[]; totalVotes: number };
  diagnostics: { validComposition: boolean; withinWindow: boolean; inactiveFeatured: readonly string[] } }>
export type AdminEventConfig = Readonly<{ emoji: string; currency: { label: string; emoji: string }; collection: { key: string; label: string } }>
export type AdminEvent = Readonly<{ id: string; externalKey: string; displayName: string; calendarMonth: number; currencyKey: string;
  config: AdminEventConfig; isActive: boolean; editions: readonly { id: string; year: number; startsAt: string; endsAt: string;
    status: string; _count: { participants: number } }[] }>
export type AdminChatReport = Readonly<{ id: string; messageId: string; reporterPlayerId: string; reportedPlayerId: string;
  messageSnapshot: unknown; contextSnapshot?: unknown; createdAt: string; reporter: { displayName: string };
  reported: { displayName: string }; message: { deletionState: string } }>
export type AdminAudit = Readonly<{ id: string; actorPlayerId: string; actorName: string; targetPlayerId: string;
  targetName: string; domain: string; action: string; operationId: string; createdAt: string; before: unknown; after: unknown }>
