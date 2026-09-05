import type { PlayerResourceBalances } from '../../application/player/player-resource-store.js';
import type { WheelSpinResult, WheelTodayState } from '../../domain/wheel/wheel.js';
import type { DailyRewardClaimResult, DailyRewardTodayState } from '../../domain/daily-reward/daily-reward.js';

/** Bigint-backed amounts cross the JSON boundary as lossless base-10 strings. */
export function toPlayerResourcesDto(balances: PlayerResourceBalances) {
  return {
    primogems: balances.primogems.toString(),
    moras: balances.moras.toString(),
    particles: {
      pyro: balances.particles_pyro.toString(),
      hydro: balances.particles_hydro.toString(),
      cryo: balances.particles_cryo.toString(),
      electro: balances.particles_electro.toString(),
      anemo: balances.particles_anemo.toString(),
      geo: balances.particles_geo.toString(),
      dendro: balances.particles_dendro.toString(),
    },
  };
}

export function toWheelSpinDto(result: WheelSpinResult) {
  return {
    businessDate: result.businessDate,
    resultType: result.resultType,
    resourceKey: result.resourceKey,
    amount: result.amount?.toString() ?? null,
    alreadySpun: result.alreadySpun,
  };
}

export function toWheelTodayDto(state: WheelTodayState) {
  return {
    spun: state.spun,
    businessDate: state.businessDate,
    result: state.result
      ? {
          resultType: state.result.resultType,
          resourceKey: state.result.resourceKey,
          amount: state.result.amount?.toString() ?? null,
        }
      : null,
  };
}

export function toDailyRewardTodayDto(state: DailyRewardTodayState) {
  return { claimed: state.claimed, businessDate: state.businessDate, rewards: {
    primogems: state.rewards.primogems.toString(), mainElementParticles: state.rewards.mainElementParticles.toString(), moras: state.rewards.moras.toString(),
  } };
}

export function toDailyRewardClaimDto(result: DailyRewardClaimResult) {
  return { ...toDailyRewardTodayDto(result), alreadyClaimed: result.alreadyClaimed };
}
