import type { WheelReward, WheelSpinResult, WheelTodayState } from '../../domain/wheel/wheel.js';

export type WheelStoreInput = Readonly<{
  playerId: string;
  businessDate: string;
  spunAt: Date;
  sourceChannel: 'UI' | 'INTERNAL_CHAT' | 'TWITCH';
  idempotencyKey?: string;
  roll: () => WheelReward;
}>;

export interface WheelStore {
  getDailyState(playerId: string, businessDate: string): Promise<WheelTodayState>;
  spin(input: WheelStoreInput): Promise<WheelSpinResult>;
  findByDate(
    playerId: string,
    businessDate: string,
  ): Promise<Omit<WheelSpinResult, 'alreadySpun'> | null>;
}
