import type { CombatAttemptMode } from '../../../generated/prisma/client.js';
import type { ElementKey } from '../../domain/economy/resources.js';
import type { CombatPreview } from '../../domain/combat/daily-combat.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import type { PlayerResourceBalances } from '../player/player-resource-store.js';

export type DailyCombatCharacter = Readonly<{
  id: string;
  externalKey: string;
  name: string;
  rarity: 4 | 5;
  elementKey: ElementKey;
  weaponType: string | null;
  region: string | null;
  iconPath: string | null;
  splashPath: string | null;
  wishPath: string | null;
  fullbodyPath: string | null;
  displayOrder: number | null;
  constellation: number;
  copies: number;
  firstObtainedAt: Date;
  favorite: boolean;
  combatStats: Readonly<{ fights: bigint; wins: bigint; losses: bigint; winRatePercent: number }>;
}>;

export type DailyCombatView = Readonly<{
  businessDate: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  encounter: Readonly<{ id: string; enemies: readonly Readonly<{
    position: 1 | 2 | 3 | 4;
    character: Omit<DailyCombatCharacter, 'constellation' | 'copies' | 'firstObtainedAt' | 'favorite' | 'combatStats'>;
    weakAgainstElements: readonly ElementKey[];
    resistantAgainstElements: readonly ElementKey[];
  }>[] }>;
  loadout: Readonly<{ nextAttemptMode: CombatAttemptMode; slots: readonly Readonly<{ position: 1 | 2 | 3 | 4; character: DailyCombatCharacter | null; ko: boolean }>[] }>;
  availableCharacters: readonly DailyCombatCharacter[];
  koCharacterIds: readonly string[];
  availableCharacterCount: number;
  preview: CombatPreview | null;
  canFight: boolean;
  reward: Readonly<{ primogems: bigint; moras: bigint }>;
  lastAttempt: Readonly<{ id: string; mode: CombatAttemptMode; won: boolean; chanceHalfPoints: number; createdAt: Date }> | null;
  playerStats: Readonly<{ totalFights: bigint; totalWins: bigint; totalLosses: bigint; totalManualWins: bigint }>;
}>;

export type DailyCombatContext = Readonly<{ playerId: string; playerElementKey: ElementKey; businessDate: string; now: Date }>;

export interface DailyCombatStore {
  getView(context: DailyCombatContext): Promise<DailyCombatView>;
  setSlot(context: DailyCombatContext & Readonly<{ position: number; characterId: string }>): Promise<DailyCombatView>;
  removeSlot(context: DailyCombatContext & Readonly<{ position: number }>): Promise<DailyCombatView>;
  copyActiveTeam(context: DailyCombatContext): Promise<DailyCombatView>;
  autoSelect(context: DailyCombatContext): Promise<DailyCombatView>;
  clearLoadout(context: DailyCombatContext): Promise<DailyCombatView>;
  fight(context: DailyCombatContext & Readonly<{ idempotencyKey: string }>): Promise<Readonly<{
    operation: Readonly<{ id: string; alreadyProcessed: boolean }>;
    result: Readonly<{ won: boolean; mode: CombatAttemptMode; chanceHalfPoints: number }>;
    view: DailyCombatView;
    resources: PlayerResourceBalances;
  }>>;
}

export type DailyCombatRandoms = Readonly<{ encounter: RandomSource; fight: RandomSource }>;
