import type { WheelReward, WheelSpinResult } from '../../domain/wheel/wheel.js';

export type WheelStoreInput = Readonly<{
  playerId: string;
  businessDate: string;
  spunAt: Date;
  sourceChannel: 'UI' | 'INTERNAL_CHAT';
  idempotencyKey?: string;
  roll: () => WheelReward;
}>;

export interface WheelStore {
  spin(input: WheelStoreInput): Promise<WheelSpinResult>;
  findByDate(
    playerId: string,
    businessDate: string,
  ): Promise<Omit<WheelSpinResult, 'alreadySpun'> | null>;
}
