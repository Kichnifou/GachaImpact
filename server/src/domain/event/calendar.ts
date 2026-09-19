import type { RandomSource } from '../wheel/wheel.js';

export type CalendarClaim = Readonly<{ calendarDay: number; rewardAmount: number }>;

export function calendarReward(day: number, random: RandomSource): number {
  if (!Number.isInteger(day) || day < 1 || day > 25) throw new Error('Invalid calendar day.');
  if (day === 25) return 50;
  const roll = random.nextInt(5);
  if (!Number.isInteger(roll) || roll < 0 || roll >= 5) throw new Error('Invalid calendar random value.');
  return roll + 1;
}

export function projectCalendar(festivalKey: string, businessDate: string, joined: boolean, claims: readonly CalendarClaim[]) {
  if (festivalKey !== 'christmas' || businessDate.slice(5, 7) !== '12') return null;
  const day = Number(businessDate.slice(8, 10));
  const rewards = new Map(claims.map((claim) => [claim.calendarDay, claim.rewardAmount]));
  return {
    startsOn: `${businessDate.slice(0, 4)}-12-01`,
    endsOn: `${businessDate.slice(0, 4)}-12-25`,
    currentDay: day <= 25 ? day : null,
    recap: day > 25,
    canClaimToday: joined && day <= 25 && !rewards.has(day),
    days: Array.from({ length: 25 }, (_, index) => {
      const calendarDay = index + 1;
      const reward = rewards.get(calendarDay);
      const state: 'OPENED' | 'AVAILABLE' | 'MISSED' | 'FUTURE' = reward !== undefined ? 'OPENED' : calendarDay < day ? 'MISSED' : calendarDay === day ? 'AVAILABLE' : 'FUTURE';
      return { day: calendarDay, state, reward: reward ?? (calendarDay === 25 ? 50 : null) };
    }),
  };
}
