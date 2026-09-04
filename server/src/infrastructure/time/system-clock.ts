import type { Clock } from '../../domain/time/business-date.js';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
