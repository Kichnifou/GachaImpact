import { describe, expect, it } from 'vitest';
import { botIdentity, contestBasePoints, contestLiveRanks, contestTitle, contestTitleFloor, selectBotAction, selectBotStat, selectContestTheme, selectRiskPoints, selectSupportPoints, shuffledTurnOrder } from '../src/domain/contest/contest.js';

const random = (values: number[]) => ({ nextInt: (max: number) => (values.shift() ?? 0) % max });

describe('contest domain', () => {
  it('maps the five stat brackets to one through five base points', () => {
    expect([1, 4, 5, 9, 10, 14, 15, 19, 20].map(contestBasePoints)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect(contestBasePoints(20)).toBe(5);
  });

  it('keeps title floors monotonic at 1, 3, 7 and 15 wins', () => {
    expect([0, 1, 2, 3, 6, 7, 14, 15].map(contestTitleFloor)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
    expect(contestTitle('STRENGTH', 1)).toBe('Titan de Bronze');
    expect(contestTitle('INTELLIGENCE', 2)).toBe('Sage d’Argent');
    expect(contestTitle('CHARISMA', 3)).toBe('Icône d’Or');
    expect(contestTitle('POPULARITY', 4)).toBe('Idôle de Platine');
  });

  it('projects stable live ranks by score, turn order and slot', () => {
    const participants = [
      { slot: 1, score: 12, turnOrder: 4 },
      { slot: 2, score: 30, turnOrder: 3 },
      { slot: 3, score: 30, turnOrder: 1 },
      { slot: 4, score: 5, turnOrder: 2 },
    ];
    expect(Object.fromEntries(contestLiveRanks(participants))).toEqual({ 1: 3, 2: 2, 3: 1, 4: 4 });
  });

  it('draws risk points uniformly from zero, base and double base', () => {
    expect([selectRiskPoints(3, random([0])), selectRiskPoints(3, random([1])), selectRiskPoints(3, random([2]))]).toEqual([0, 3, 6]);
    expect([selectSupportPoints(random([0])), selectSupportPoints(random([1])), selectSupportPoints(random([2]))]).toEqual([1, 2, 3]);
  });

  it('maps every equiprobable daily-theme bucket and permits consecutive repeats', () => {
    expect([0, 1, 2, 3, 4].map((roll) => selectContestTheme(random([roll])))).toEqual(['STRENGTH', 'INTELLIGENCE', 'BEAUTY', 'CHARISMA', 'POPULARITY']);
    expect([selectContestTheme(random([2])), selectContestTheme(random([2]))]).toEqual(['BEAUTY', 'BEAUTY']);
  });

  it('creates bounded bots and preserves a deterministic shuffle', () => {
    expect(selectBotStat([1, 1], random([0]))).toBe(1);
    expect(selectBotStat([20, 20], random([4]))).toBe(20);
    expect(shuffledTurnOrder([1, 2, 3, 4], random([0, 0, 0]))).toEqual([2, 3, 4, 1]);
    expect(botIdentity(2, random([0, 0]))).toEqual({ name: 'Astra \u00b7 Bot 2', avatarKey: 'bot-1' });
  });

  it('makes a guaranteed basic win and otherwise adapts bot risk', () => {
    expect(selectBotAction({ score: 48, leadingScore: 48, basePoints: 2 }, random([0]))).toBe('BASIC');
    expect(selectBotAction({ score: 5, leadingScore: 25, basePoints: 2 }, random([69]))).toBe('RISK');
    expect(selectBotAction({ score: 10, leadingScore: 20, basePoints: 2 }, random([39]))).toBe('RISK');
    expect(selectBotAction({ score: 20, leadingScore: 20, basePoints: 2 }, random([19]))).toBe('RISK');
    expect(selectBotAction({ score: 20, leadingScore: 20, basePoints: 2 }, random([20]))).toBe('BASIC');
  });
});
