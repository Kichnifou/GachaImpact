import type { GachaCharacter } from '../../domain/gacha/gacha.js';
import type { CurrentBanner, PlayerGachaState } from './gacha-store.js';
/** Only explicitly consented scene fields can leave the server. */
export function sharedCharacter(c: GachaCharacter) {
    return { id: c.id, name: c.name, rarity: c.rarity, elementKey: c.elementKey, iconPath: c.iconPath, splashPath: c.splashPath, wishPath: c.wishPath, fullbodyPath: c.fullbodyPath };
}
export function sharedState(s: PlayerGachaState) {
    return { selectedBannerCharacterId: s.selectedBannerCharacterId, pity5: s.pity5, pity4: s.pity4, guaranteedFeatured5: s.guaranteedFeatured5, captureProgress: s.captureProgress };
}
export function sharedBanner(b: CurrentBanner) {
    return { id: b.id, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), featuredFiveStars: b.featuredFiveStars.map(sharedCharacter), featuredFourStars: b.featuredFourStars.map(sharedCharacter) };
}
