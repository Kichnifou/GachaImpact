export type CharacterPossession = Readonly<{
  copies: number;
  constellation: number;
  firstObtainedAt: Date;
}>;

export type PossessionAcquisition = CharacterPossession & Readonly<{
  wasNewCharacter: boolean;
  reachedC6: boolean;
  wasAlreadyC6: boolean;
}>;

export function acquireCharacter(current: CharacterPossession | null, obtainedAt: Date): PossessionAcquisition {
  if (!current) return { copies: 1, constellation: 0, firstObtainedAt: obtainedAt, wasNewCharacter: true, reachedC6: false, wasAlreadyC6: false };
  const copies = current.copies + 1;
  const constellation = Math.min(6, copies - 1);
  return {
    copies,
    constellation,
    firstObtainedAt: current.firstObtainedAt,
    wasNewCharacter: false,
    reachedC6: current.constellation < 6 && constellation === 6,
    wasAlreadyC6: current.constellation === 6,
  };
}
