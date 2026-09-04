import type { ElementKey } from '../../domain/economy/resources.js';

export type ElementChoiceResult = 'selected' | 'already-selected' | 'different-element' | 'inactive';

export interface PlayerElementStore {
  chooseElement(playerId: string, elementKey: ElementKey): Promise<ElementChoiceResult>;
}
