import { randomInt } from 'node:crypto';

import type { RandomSource } from '../../domain/wheel/wheel.js';

export class NodeRandomSource implements RandomSource {
  public nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}
