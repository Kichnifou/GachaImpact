import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';

const verified = new WeakMap<object, CurrentPlayer>();
declare const serverActor: unique symbol;
export type VerifiedPlayerActor = Readonly<{ [serverActor]: true }>;
export type PlayerExecutionActor = AuthenticatedIdentity | VerifiedPlayerActor;

/** Internal transports only: construct after resolving and authorizing an immutable identity. */
export function verifiedPlayerActor(player: CurrentPlayer): VerifiedPlayerActor {
  const actor = Object.freeze({}) as VerifiedPlayerActor;
  verified.set(actor, Object.freeze({ ...player }));
  return actor;
}

export function playerFromServerActor(actor: PlayerExecutionActor): CurrentPlayer | undefined {
  return verified.get(actor);
}
