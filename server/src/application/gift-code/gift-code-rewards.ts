import { resourceKeys, type ResourceKey } from '../../domain/economy/resources.js';

// Code reward keys are not ResourceDefinitions: Event and Stella keep their owners.
export const giftCodeRewardKeys = [...resourceKeys, 'masterless-stella-fortuna', 'event_points', 'event_currency'] as const;
export type GiftCodeRewardKey = ResourceKey | 'masterless-stella-fortuna' | 'event_points' | 'event_currency';
export type GrantedCodeReward = Readonly<{ resourceKey: string; displayName: string; amount: string }>;
export const extraCodeRewardNames = {
  'masterless-stella-fortuna': 'Masterless Stella Fortuna',
  event_points: 'Points Event',
  event_currency: 'Monnaie de l’édition Event en cours',
} as const;
