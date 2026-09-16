import type { RandomSource } from '../wheel/wheel.js';

export const EVENT_GAME_B_CODES = Object.freeze(Array.from({ length: 32 }, (_, index) => index.toString(2).padStart(5, '0')));
export const EVENT_GAME_B_MAX_ATTEMPTS = 3;

export function generateEventGameBSolution(random: RandomSource): string {
  return EVENT_GAME_B_CODES[random.nextInt(EVENT_GAME_B_CODES.length)]!;
}

export function isEventGameBCode(value: string): boolean {
  return /^[01]{5}$/.test(value);
}

export function parseEventGameBTestedCodes(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((code) => typeof code !== 'string' || !isEventGameBCode(code)) || new Set(value).size !== value.length) throw new Error('Invalid Event Game B tested codes.');
  return value;
}
