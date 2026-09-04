import type { PlayerResourceBalances } from '../../application/player/player-resource-store.js';
import type { WheelSpinResult } from '../../domain/wheel/wheel.js';

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
