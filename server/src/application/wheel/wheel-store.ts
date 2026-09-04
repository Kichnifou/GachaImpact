import type { WheelReward, WheelSpinResult } from '../../domain/wheel/wheel.js';

export type WheelStoreInput = Readonly<{
  playerId: string;
  businessDate: string;
  spunAt: Date;
  sourceChannel: 'UI';
  roll: () => WheelReward;
}>;

export interface WheelStore {
  spin(input: WheelStoreInput): Promise<WheelSpinResult>;
  findByDate(
    playerId: string,
    businessDate: string,
  ): Promise<Omit<WheelSpinResult, 'alreadySpun'> | null>;
}
