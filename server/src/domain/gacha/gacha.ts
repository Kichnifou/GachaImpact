import type { RandomSource } from '../wheel/wheel.js';

export type GachaCharacter = Readonly<{
  id: string; externalKey: string; name: string; rarity: 4 | 5; elementKey: string;
  weaponType: string | null; region: string | null; classKey: string | null;
  iconPath: string | null; splashPath: string | null; wishPath: string | null; fullbodyPath: string | null;
}>;

export type FeaturedSelection = Readonly<{
  character: GachaCharacter;
  slot: number;
  selectionSource: 'RANDOM' | 'COMMUNITY_VOTE' | 'RANDOM_FALLBACK';
}>;

export type BannerVoteWeight = Readonly<{ characterId: string; votes: number }>;
export type ClosedVoteSnapshot = Readonly<{
  state: 'CLOSED';
  sourceRotationId: string;
  capturedAt: string;
  candidates: readonly Readonly<{ characterId: string; characterName: string; voteCount: number }>[];
}>;
export type GenerationVoteSnapshot = Readonly<{
  sourceRotationId: string;
  capturedAt: string;
  candidates: readonly Readonly<{ characterId: string; characterName: string; voteCount: number }>[];
  selectedCharacterId: string;
  selectedCharacterName: string;
  selectionSource: 'COMMUNITY_VOTE' | 'RANDOM_FALLBACK';
}>;

export function closeBannerVoteSnapshot(
  sourceRotationId: string,
  capturedAt: Date,
  catalog: readonly GachaCharacter[],
  previousCharacterIds: ReadonlySet<string>,
  votes: readonly BannerVoteWeight[],
): ClosedVoteSnapshot {
  const voteCounts = new Map(votes.map(vote => [vote.characterId, vote.votes]));
  return {
    state: 'CLOSED', sourceRotationId, capturedAt: capturedAt.toISOString(),
    candidates: catalog.filter(character => character.rarity === 5 && !previousCharacterIds.has(character.id))
      .map(character => ({ characterId: character.id, characterName: character.name, voteCount: voteCounts.get(character.id) ?? 0 }))
      .sort((a, b) => a.characterId.localeCompare(b.characterId)),
  };
}

export function readClosedVoteSnapshot(value: unknown, sourceRotationId: string): ClosedVoteSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Object.hasOwn(record, 'closedVoteSnapshot')) return null;
  const closed = record.closedVoteSnapshot;
  if (!closed || typeof closed !== 'object' || Array.isArray(closed)) throw new Error('Invalid closed banner vote snapshot.');
  const row = closed as Record<string, unknown>;
  if (row.state !== 'CLOSED' || row.sourceRotationId !== sourceRotationId || typeof row.capturedAt !== 'string' ||
    !Number.isFinite(Date.parse(row.capturedAt)) || !Array.isArray(row.candidates) ||
    row.candidates.some(candidate => !candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
      typeof candidate.characterId !== 'string' || typeof candidate.characterName !== 'string' ||
      !Number.isSafeInteger(candidate.voteCount) || candidate.voteCount < 0) ||
    new Set(row.candidates.map(candidate => candidate.characterId)).size !== row.candidates.length) {
    throw new Error('Invalid closed banner vote snapshot.');
  }
  return closed as ClosedVoteSnapshot;
}

export function generationVoteSnapshot(
  closed: ClosedVoteSnapshot,
  selections: readonly FeaturedSelection[],
): GenerationVoteSnapshot {
  const chosen = selections.find(selection => selection.character.rarity === 5 && selection.slot === 4);
  if (!chosen || chosen.selectionSource === 'RANDOM') throw new Error('The generated banner has no community slot.');
  const candidate = closed.candidates.find(row => row.characterId === chosen.character.id);
  if (!candidate) throw new Error('The community slot is absent from the closed vote snapshot.');
  return {
    sourceRotationId: closed.sourceRotationId,
    capturedAt: closed.capturedAt,
    candidates: closed.candidates,
    selectedCharacterId: chosen.character.id,
    selectedCharacterName: candidate.characterName,
    selectionSource: chosen.selectionSource,
  };
}

export function selectBannerFeatured(
  catalog: readonly GachaCharacter[],
  previousCharacterIds: ReadonlySet<string>,
  votes: readonly BannerVoteWeight[],
  random: RandomSource,
): readonly FeaturedSelection[] {
  const eligible = catalog.filter((character) => !previousCharacterIds.has(character.id));
  const fiveStars = eligible.filter((character) => character.rarity === 5);
  const fourStars = eligible.filter((character) => character.rarity === 4);
  if (fiveStars.length < 4 || fourStars.length < 6) {
    throw new Error('The active catalog cannot produce a valid weekly banner.');
  }

  const randomFive = takeRandom(fiveStars, 3, random);
  const remainingFive = fiveStars.filter(({ id }) => !randomFive.some((item) => item.id === id));
  const weightedVotes = votes.filter(({ characterId, votes: count }) =>
    count > 0 && remainingFive.some(({ id }) => id === characterId));
  const totalVotes = weightedVotes.reduce((total, vote) => total + vote.votes, 0);
  let community: GachaCharacter;
  let source: FeaturedSelection['selectionSource'];
  if (totalVotes > 0) {
    let roll = random.nextInt(totalVotes);
    const winner = weightedVotes.find(({ votes: count }) => (roll -= count) < 0);
    community = remainingFive.find(({ id }) => id === winner?.characterId) ?? remainingFive[0]!;
    source = 'COMMUNITY_VOTE';
  } else {
    community = takeRandom(remainingFive, 1, random)[0]!;
    source = 'RANDOM_FALLBACK';
  }

  return [
    ...randomFive.map((character, index) => ({ character, slot: index + 1, selectionSource: 'RANDOM' as const })),
    { character: community, slot: 4, selectionSource: source },
    ...takeRandom(fourStars, 6, random).map((character, index) => ({ character, slot: index + 1, selectionSource: 'RANDOM' as const })),
  ];
}

function takeRandom<T>(values: readonly T[], count: number, random: RandomSource): T[] {
  const pool = [...values];
  const result: T[] = [];
  while (result.length < count) result.push(pool.splice(random.nextInt(pool.length), 1)[0]!);
  return result;
}

const parisParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
});

export function getParisWeekWindow(instant: Date): Readonly<{ startsAt: Date; endsAt: Date }> {
  const parts = Object.fromEntries(parisParts.formatToParts(instant).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  const weekdays: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  date.setUTCDate(date.getUTCDate() - (weekdays[parts.weekday!] ?? 0));
  const startsAt = parisMidnightUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  date.setUTCDate(date.getUTCDate() + 7);
  return { startsAt, endsAt: parisMidnightUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) };
}

function parisMidnightUtc(year: number, month: number, day: number): Date {
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(noon));
  const offsetHours = localHour - 12;
  return new Date(Date.UTC(year, month - 1, day, -offsetHours));
}
