import { isElementKey, type ElementKey } from '../../domain/economy/resources.js';

export type LegacyElement = { kind: 'ABSENT_ELEMENT'; elementKey: null } | { kind: 'VALID_ELEMENT'; elementKey: ElementKey };
/** Missing data is not a misspelled element. No unobserved legacy sentinel is invented. */
export function parseLegacyElement(value: unknown): LegacyElement {
  if (value === undefined || value === null || value === '') return { kind: 'ABSENT_ELEMENT', elementKey: null };
  if (typeof value === 'string' && isElementKey(value.toLowerCase())) return { kind: 'VALID_ELEMENT', elementKey: value.toLowerCase() as ElementKey };
  throw new Error('LEGACY_ELEMENT_INVALID');
}
