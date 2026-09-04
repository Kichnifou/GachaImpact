import { describe, expect, it, vi } from 'vitest';

import { BusinessError } from '../src/application/errors.js';
import { ChoosePlayerElement } from '../src/application/player/choose-player-element.js';
import type {
  CurrentPlayerResult,
  CurrentPlayerStore,
  ProvisionCurrentPlayerInput,
} from '../src/application/player/current-player-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetCurrentPlayerResources } from '../src/application/player/get-current-player-resources.js';
import type {
  ElementChoiceResult,
  PlayerElementStore,
} from '../src/application/player/player-element-store.js';
import type { PlayerResourceStore } from '../src/application/player/player-resource-store.js';
import { SpinDailyWheel } from '../src/application/wheel/spin-daily-wheel.js';
import { GetTodayWheelState } from '../src/application/wheel/get-today-wheel-state.js';
import type { WheelStore, WheelStoreInput } from '../src/application/wheel/wheel-store.js';
import {
  toPlayerResourcesDto,
  toWheelSpinDto,
  toWheelTodayDto,
} from '../src/api/serializers/gameplay.js';
import { resourceKeys, type ResourceKey } from '../src/domain/economy/resources.js';
import type { Clock } from '../src/domain/time/business-date.js';
import type { RandomSource, WheelSpinResult } from '../src/domain/wheel/wheel.js';
import type { CurrentPlayer } from '../src/domain/player/current-player.js';

const identity = { subject: 'subject-1' } as const;

class FakeCurrentPlayerStore implements CurrentPlayerStore {
  public constructor(public player: CurrentPlayer | null) {}

  public async findByIdentity() {
    return this.player;
  }

  public async provision(_input: ProvisionCurrentPlayerInput): Promise<CurrentPlayerResult> {
    throw new Error('Not used by these tests.');
  }
}

class FakeElementStore implements PlayerElementStore {
  public result: ElementChoiceResult = 'selected';
  public readonly chooseElement = vi.fn(async () => this.result);
}

class FakeResourceStore implements PlayerResourceStore {
  public constructor(private readonly balances: ReadonlyMap<ResourceKey, bigint>) {}

  public async getBalances() {
    return this.balances;
  }
}

class MutableClock implements Clock {
  public constructor(public value: Date) {}

  public now() {
    return this.value;
  }
}

class SequenceRandom implements RandomSource {
  public readonly nextInt = vi.fn(() => 92);
}

class MemoryWheelStore implements WheelStore {
  private readonly states = new Map<string, Omit<WheelSpinResult, 'alreadySpun'>>();
  public spinCalls = 0;
  public findCalls = 0;

  public async spin(input: WheelStoreInput): Promise<WheelSpinResult> {
    this.spinCalls += 1;
    const existing = this.states.get(input.businessDate);

    if (existing) {
      return { ...existing, alreadySpun: true };
    }

    const reward = input.roll();
    const result = { businessDate: input.businessDate, ...reward };
    this.states.set(input.businessDate, result);
    return { ...result, alreadySpun: false };
  }

  public async findByDate(_playerId: string, businessDate: string) {
    this.findCalls += 1;
    return this.states.get(businessDate) ?? null;
  }

  public get stateCount() {
    return this.states.size;
  }
}

function createPlayer(elementKey: string | null = null): CurrentPlayer {
  return {
    id: 'player-1',
    displayName: 'Test Player',
    elementKey,
    status: 'ACTIVE',
  };
}

describe('permanent element choice', () => {
  it('accepts the first valid choice', async () => {
    const elementStore = new FakeElementStore();
    const service = new ChoosePlayerElement(
      new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer())),
      elementStore,
    );

    await expect(service.execute(identity, 'hydro')).resolves.toEqual({
      elementKey: 'hydro',
      alreadySelected: false,
    });
    expect(elementStore.chooseElement).toHaveBeenCalledWith('player-1', 'hydro');
  });

  it('rejects an invalid or inactive element', async () => {
    const elementStore = new FakeElementStore();
    const service = new ChoosePlayerElement(
      new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer())),
      elementStore,
    );

    await expect(service.execute(identity, 'light')).rejects.toMatchObject({
      code: 'ELEMENT_NOT_AVAILABLE',
    });

    elementStore.result = 'inactive';
    await expect(service.execute(identity, 'hydro')).rejects.toMatchObject({
      code: 'ELEMENT_NOT_AVAILABLE',
    });
  });

  it('returns an idempotent response for the same element', async () => {
    const elementStore = new FakeElementStore();
    elementStore.result = 'already-selected';
    const service = new ChoosePlayerElement(
      new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer('hydro'))),
      elementStore,
    );

    await expect(service.execute(identity, 'hydro')).resolves.toEqual({
      elementKey: 'hydro',
      alreadySelected: true,
    });
  });

  it('refuses a different choice after the permanent element is set', async () => {
    const elementStore = new FakeElementStore();
    elementStore.result = 'different-element';
    const service = new ChoosePlayerElement(
      new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer('hydro'))),
      elementStore,
    );

    await expect(service.execute(identity, 'pyro')).rejects.toMatchObject({
      code: 'ELEMENT_ALREADY_CHOSEN',
    });
  });
});

describe('Player resources', () => {
  it('returns a complete DTO and serializes bigint amounts losslessly', async () => {
    const hugeAmount = 9_007_199_254_740_993n;
    const balances = new Map(resourceKeys.map((key) => [key, hugeAmount] as const));
    const service = new GetCurrentPlayerResources(
      new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer('hydro'))),
      new FakeResourceStore(balances),
    );
    const dto = toPlayerResourcesDto(await service.execute(identity));

    expect(dto).toMatchObject({
      primogems: hugeAmount.toString(),
      moras: hugeAmount.toString(),
      particles: { pyro: hugeAmount.toString(), dendro: hugeAmount.toString() },
    });
    expect(() => JSON.stringify(dto)).not.toThrow();
  });
});

describe('daily Wheel service', () => {
  it('reads unused and persisted daily states without spinning or changing rewards', async () => {
    const clock = new MutableClock(new Date('2026-09-04T21:59:00Z'));
    const random = new SequenceRandom();
    const store = new MemoryWheelStore();
    const getCurrentPlayer = new GetCurrentPlayer(
      new FakeCurrentPlayerStore(createPlayer('hydro')),
    );
    const getToday = new GetTodayWheelState(getCurrentPlayer, store, clock);
    const spin = new SpinDailyWheel(getCurrentPlayer, store, clock, random);

    const unused = await getToday.execute(identity);

    expect(unused).toEqual({
      spun: false,
      businessDate: '2026-09-04',
      result: null,
    });
    expect(store.spinCalls).toBe(0);
    expect(store.stateCount).toBe(0);
    expect(random.nextInt).not.toHaveBeenCalled();

    await spin.execute(identity);
    const stateCountAfterSpin = store.stateCount;
    const persisted = await getToday.execute(identity);

    expect(persisted).toEqual({
      spun: true,
      businessDate: '2026-09-04',
      result: {
        resultType: 'primogems',
        resourceKey: 'primogems',
        amount: 1_600n,
      },
    });
    expect(toWheelTodayDto(persisted).result?.amount).toBe('1600');
    expect(store.spinCalls).toBe(1);
    expect(store.stateCount).toBe(stateCountAfterSpin);

    clock.value = new Date('2026-09-04T22:00:00Z');
    await expect(getToday.execute(identity)).resolves.toEqual({
      spun: false,
      businessDate: '2026-09-05',
      result: null,
    });
    expect(store.spinCalls).toBe(1);
    expect(random.nextInt).toHaveBeenCalledTimes(1);
  });

  it('requires a permanent element', async () => {
    const service = new SpinDailyWheel(
      new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer())),
      new MemoryWheelStore(),
      new MutableClock(new Date('2026-09-04T10:00:00Z')),
      new SequenceRandom(),
    );

    await expect(service.execute(identity)).rejects.toBeInstanceOf(BusinessError);
    await expect(service.execute(identity)).rejects.toMatchObject({
      code: 'PLAYER_ELEMENT_REQUIRED',
    });
  });

  it('spins once, returns the persisted result, and spins again after the day changes', async () => {
    const clock = new MutableClock(new Date('2026-09-04T21:59:00Z'));
    const random = new SequenceRandom();
    const service = new SpinDailyWheel(
      new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer('hydro'))),
      new MemoryWheelStore(),
      clock,
      random,
    );

    const first = await service.execute(identity);
    const repeated = await service.execute(identity);

    expect(first).toMatchObject({
      businessDate: '2026-09-04',
      resultType: 'primogems',
      amount: 1_600n,
      alreadySpun: false,
    });
    expect(repeated).toEqual({ ...first, alreadySpun: true });
    expect(random.nextInt).toHaveBeenCalledTimes(1);
    expect(toWheelSpinDto(first).amount).toBe('1600');

    clock.value = new Date('2026-09-04T22:00:00Z');
    await expect(service.execute(identity)).resolves.toMatchObject({
      businessDate: '2026-09-05',
      alreadySpun: false,
    });
    expect(random.nextInt).toHaveBeenCalledTimes(2);
  });

  it.each([
    [0, 'nothing', null, null],
    [2, 'particles', 'particles_pyro', 500n],
    [72, 'moras', 'moras', 50_000n],
    [92, 'primogems', 'primogems', 1_600n],
  ] as const)(
    'returns the persisted category selected by roll %i',
    async (roll, resultType, resourceKey, amount) => {
      const service = new SpinDailyWheel(
        new GetCurrentPlayer(new FakeCurrentPlayerStore(createPlayer('hydro'))),
        new MemoryWheelStore(),
        new MutableClock(new Date('2026-09-04T10:00:00Z')),
        { nextInt: () => roll },
      );

      await expect(service.execute(identity)).resolves.toMatchObject({
        resultType,
        resourceKey,
        amount,
      });
    },
  );
});
