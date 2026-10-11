import type { CurrentGachaDto, GachaCharacterDto, GachaPullDto } from '../api/types';
import type { SharedCharacter, SharedSession } from '../api/shared-invocations-types';
import type { InvocationSequenceState } from './invocation-sequence';
import { bestPullRarity } from './pull-result-presentation';
const character = (c: SharedCharacter): GachaCharacterDto => ({ ...c, externalKey: c.id, weaponType: null, region: null, classKey: null, releaseDate: null });
/** UI adapter only. Absent private counters stay neutral and are never rendered in the shared scene. */
export function sharedGachaView(session: SharedSession): CurrentGachaDto {
    const gacha = session.snapshot.gacha;
    return { banner: { ...gacha.banner, featuredFiveStars: gacha.banner.featuredFiveStars.map(character), featuredFourStars: gacha.banner.featuredFourStars.map(character) }, playerState: { ...gacha.playerState, fiftyFiftyLostStreak: 0, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' } };
}
export function sharedSequenceView(session: SharedSession): InvocationSequenceState {
    const p = session.snapshot.presentation;
    if (p.phase === 'idle' || !p.pull)
        return { phase: 'idle' };
    const pull: GachaPullDto = { operation: { ...p.pull.operation, primogemCost: '0', alreadyProcessed: true }, results: p.pull.results.map(r => ({ ...r, character: r.character ? character(r.character) : null, copiesAfter: null, passiveEffects: [] })), playerState: sharedGachaView(session).playerState };
    const base = { count: p.pull.operation.pullCount, idempotencyKey: p.pull.operation.id, pull, bestRarity: bestPullRarity(pull.results) };
    return p.phase === 'reveal' ? { ...base, phase: 'reveal', resultIndex: p.index } : { ...base, phase: p.phase };
}
