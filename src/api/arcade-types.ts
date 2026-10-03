import type { PlayerProgressionDto, PlayerResourcesDto } from './types'
export const arcadeGames = ['MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE'] as const
export const arcadeDifficulties = ['EASY', 'MEDIUM', 'HARD'] as const
export type ArcadeGame = typeof arcadeGames[number]
export type ArcadeDifficulty = typeof arcadeDifficulties[number]
export type ArcadeSide = 'PLAYER' | 'AI'
export type ArcadeOutcome = 'WIN' | 'DRAW' | 'LOSS'
export type ArcadeFace = { id: string; name: string; elementKey: string; assetPaths: (string | null)[] }
export type ArcadeMemoryCard = { position: number; status: 'HIDDEN' | 'BLOCKED' } | { position: number; status: 'VISIBLE' | 'MATCHED'; owner: ArcadeSide | null; face: ArcadeFace }
export type ArcadeBoard = { kind: 'MEMORY'; turn: ArcadeSide; phase: 'PICK' | 'REVEAL'; playerPairs: number; aiPairs: number; remainingPairs: number; columns: number; totalPairs: number; cards: ArcadeMemoryCard[]; outcome: ArcadeOutcome | null }
  | { kind: 'CONNECT_FOUR' | 'TIC_TAC_TOE'; turn: ArcadeSide; cells: (ArcadeSide | null)[]; winningCells: number[]; lastMove: number | null; outcome: ArcadeOutcome | null }
export type ArcadeParticipant = { id: string; displayName: string }
export type ArcadeSession = { mode: 'SOLO' | 'MULTIPLAYER'; viewerSide: ArcadeSide; participants: { PLAYER: ArcadeParticipant; AI: ArcadeParticipant } | null; opponent: ArcadeParticipant | null; id: string; game: ArcadeGame; difficulty: ArcadeDifficulty; status: 'ACTIVE' | 'FINISHED' | 'ABANDONED'; version: number; rulesVersion: number; scoringVersion: number;
  firstSide: ArcadeSide; createdAt: string; nextActionAt: string; board: ArcadeBoard; banter: { id: string; text: string };
  result: null | { outcome: ArcadeOutcome; performancePoints: number; scoreAwarded: number; xpAwarded: number; businessDate: string; finishedAt: string; operationId: string } }
export type ArcadeRecord = { game: ArcadeGame; difficulty: ArcadeDifficulty; score: string; played: string; wins: string; draws: string; losses: string; best: { points: number; pairs: number | null; totalPairs: number | null; outcome: ArcadeOutcome } }
export type ArcadeSummary = { scores: Record<ArcadeGame, string>; totalScore: string; businessDate: string; records: ArcadeRecord[]; daily: { game: ArcadeGame; used: boolean; xpAwarded: number }[] }
export type ArcadeOverview = ArcadeSummary & { sessions: ArcadeSession[]; invitation: ArcadeInvitation | null; serverNow: string }
export type ArcadeAward = { operationId: string; progression: PlayerProgressionDto; resources: PlayerResourcesDto; rewards: { resourceKey: string; amount: string }[]; levelsReached: number[]; overflowRewardsGranted: number }
export type ArcadeMutation = ArcadeSummary & { session: ArcadeSession; operationId: string; alreadyProcessed: boolean; award: ArcadeAward | null }
export type ArcadeStart = { game: ArcadeGame; difficulty: ArcadeDifficulty; expectedVersion: 0; previousSessionId: string | null; idempotencyKey: string }
export type ArcadeAction = { expectedVersion: number; idempotencyKey: string } & ({ kind: 'MOVE'; position: number } | { kind: 'ADVANCE' | 'QUIT' })
export type ArcadeRankingQuery = { kind: 'GLOBAL' | 'SCORE'; game: ArcadeGame | 'TOTAL'; difficulty: ArcadeDifficulty; page?: number }
export type ArcadeRanking = ArcadeRankingQuery & { page: number; pageSize: number; total: number; totalPages: number; selfPage: number | null; selfStatus: 'RANKED' | 'NOT_PUBLIC' | 'NOT_ELIGIBLE';
  entries: { playerId: string; displayName: string; elementKey: string; avatarAssetPath: string | null; value: string; rank: number; position: number; pairs: number | null; totalPairs: number | null; isSelf: boolean }[] }

export type ArcadeInvitation = { id: string; direction: 'INCOMING' | 'OUTGOING'; host: ArcadeParticipant; guest: ArcadeParticipant; game: ArcadeGame; difficulty: ArcadeDifficulty; status: 'PENDING' | 'STARTED' | 'REFUSED' | 'CANCELLED' | 'EXPIRED' | 'INVALIDATED'; hostReady: boolean; guestReady: boolean; expiresAt: string; sessionId: string | null }
export type ArcadeInvite = { opponentPlayerId: string; game: ArcadeGame; difficulty: ArcadeDifficulty; friendsOnly: boolean; replaySessionId?: string; idempotencyKey: string }
export type ArcadeInviteAction = { kind: 'READY' | 'CANCEL' | 'REFUSE'; idempotencyKey: string }
export type ArcadeInvitationMutation = { invitation: ArcadeInvitation; operationId: string; alreadyProcessed: boolean; unavailable?: boolean }
