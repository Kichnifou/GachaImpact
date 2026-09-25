import type { PrismaClient } from '../../../generated/prisma/client.js';
import { derivePlayerLevel } from '../../domain/player/player-progression.js';
import { elementKeys } from '../../domain/economy/resources.js';
import { privacyDefaults, type PrivacyCategory } from '../social/privacy-service.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { fiveStarRate } from '../statistics/general-statistics-projection.js';

export type RankingCategory = 'PROGRESSION' | 'GACHA' | 'RESSOURCES' | 'COLLECTION' | 'ACTIVITE';
type Source = 'progression' | 'gacha' | 'economy' | 'combat' | 'expedition' | 'social' | 'balances' | 'bank' | 'box';
type ValueKey = 'xp' | 'level' | 'messages' | 'messagesXp' | 'pulls' | 'rate5' | 'stars5' | 'stars4' | 'pity5' | 'won5050' | 'lost5050' |
  'primos' | 'moras' | 'particles' | 'pyro' | 'hydro' | 'cryo' | 'electro' | 'anemo' | 'geo' | 'dendro' |
  'primosEarned' | 'primosSpent' | 'morasEarned' | 'morasSpent' | 'box' | 'c6' | 'c6-5' | 'c6-4' | 'copies' | 'combat' | 'combatManual' | 'expeditions' | 'hearts';
type Ratio = { numerator: bigint; denominator: bigint };
type Values = Record<ValueKey, bigint | Ratio | null>;
export type RankingDefinition = Readonly<{ id: ValueKey; label: string; category: RankingCategory; aliases: readonly string[]; source: Source; format: 'INTEGER' | 'PERCENT' | 'PITY5'; privacy: readonly PrivacyCategory[]; eligibility: string }>;
const define = (id: ValueKey, label: string, category: RankingCategory, source: Source, privacy: readonly PrivacyCategory[], aliases: string[] = [], format: 'INTEGER' | 'PERCENT' | 'PITY5' = 'INTEGER', eligibility = 'positive'): RankingDefinition =>
  ({ id, label, category, source, privacy, aliases: [...new Set([...aliases, id.toLowerCase()])], format, eligibility });
const general = ['GENERAL_STATISTICS'] as const;
const currency = ['CURRENCY_BALANCES'] as const;
export const rankingRegistry: readonly RankingDefinition[] = [
  define('xp', 'XP', 'PROGRESSION', 'progression', general, ['xp']), define('level', 'Niveau', 'PROGRESSION', 'progression', [], ['niveau', 'level', 'lvl']),
  define('messages', 'Messages', 'PROGRESSION', 'progression', general, ['msg']), define('messagesXp', 'Messages XP', 'PROGRESSION', 'progression', general, ['messages-xp', 'counted']),
  define('pulls', 'Pulls', 'GACHA', 'gacha', general), define('rate5', 'Taux de 5★', 'GACHA', 'gacha', general, ['taux5', 'luck'], 'PERCENT', 'pulls>=100'),
  define('stars5', '5★ obtenus', 'GACHA', 'gacha', general, ['5stars', '5']), define('stars4', '4★ obtenus', 'GACHA', 'gacha', general, ['4stars', '4']),
  define('pity5', 'Pity 5★', 'GACHA', 'gacha', ['PITY_GUARANTEE'], ['pity'], 'PITY5'), define('won5050', '50/50 gagnés', 'GACHA', 'gacha', general, ['5050', '50/50']),
  define('lost5050', '50/50 perdus', 'GACHA', 'gacha', general, ['lose5050', 'lost5050']),
  define('primos', 'Primogemmes', 'RESSOURCES', 'balances', currency), define('moras', 'Patrimoine Moras', 'RESSOURCES', 'bank', ['CURRENCY_BALANCES', 'BANK']),
  define('particles', 'Particules totales', 'RESSOURCES', 'balances', currency, ['particules']),
  ...elementKeys.map(key => define(key, `Particules ${key}`, 'RESSOURCES', 'balances', currency)),
  define('primosEarned', 'Primogemmes gagnées', 'RESSOURCES', 'economy', general, ['primos-earned']),
  define('primosSpent', 'Primogemmes dépensées', 'RESSOURCES', 'economy', general, ['primos-spent']),
  define('morasEarned', 'Moras gagnées', 'RESSOURCES', 'economy', general, ['moras-earned']),
  define('morasSpent', 'Moras dépensées', 'RESSOURCES', 'economy', general, ['moras-spent']),
  define('box', 'Personnages possédés', 'COLLECTION', 'box', ['BOX']), define('c6-5', 'C6 5★', 'COLLECTION', 'box', ['BOX']),
  define('c6-4', 'C6 4★', 'COLLECTION', 'box', ['BOX']), define('c6', 'C6 total', 'COLLECTION', 'box', ['BOX']), define('copies', 'Copies', 'COLLECTION', 'box', ['BOX']),
  define('combat', 'Victoires Combat', 'ACTIVITE', 'combat', general), define('combatManual', 'Victoires Combat manuel', 'ACTIVITE', 'combat', general, ['combat-manuel']),
  define('expeditions', 'Expéditions terminées', 'ACTIVITE', 'expedition', general), define('hearts', 'Cœurs envoyés', 'ACTIVITE', 'social', general, ['coeurs']),
];
export const rankingCategories: readonly RankingCategory[] = ['PROGRESSION', 'GACHA', 'RESSOURCES', 'COLLECTION', 'ACTIVITE'];
export const findRanking = (token: string) => rankingRegistry.find(metric => metric.aliases.includes(token.toLocaleLowerCase('fr-FR')));
type Entry = { playerId: string; displayName: string; elementKey: string; rank: number; value: string; isSelf: boolean };
type Ranked = { playerId: string; displayName: string; elementKey: string; score: bigint | Ratio; rank: number };
const compare = (a: bigint | Ratio, b: bigint | Ratio) => {
  const left = typeof a === 'bigint' ? { numerator: a, denominator: 1n } : a;
  const right = typeof b === 'bigint' ? { numerator: b, denominator: 1n } : b;
  const delta = left.numerator * right.denominator - right.numerator * left.denominator;
  return delta > 0n ? 1 : delta < 0n ? -1 : 0;
};
const display = (metric: RankingDefinition, score: bigint | Ratio) => typeof score === 'bigint'
  ? metric.format === 'PITY5' ? `${score}/90` : score.toString()
  : `${fiveStarRate(score.numerator, score.denominator)} %`;

export class RankingService {
  constructor(private readonly database: PrismaClient) {}

  private async ranked(metric: RankingDefinition): Promise<Ranked[]> {
    const players = await this.database.player.findMany({
      where: { status: 'ACTIVE', elementKey: { not: null } },
      select: {
        id: true, displayName: true, elementKey: true,
        privacySettings: metric.privacy.length ? { where: { categoryKey: { in: [...metric.privacy] } }, select: { categoryKey: true, level: true } } : undefined,
        progression: metric.source === 'progression' ? { select: { xp: true, totalMessages: true, countedMessages: true } } : undefined,
        gachaState: metric.source === 'gacha' ? { select: { totalPulls: true, totalFiveStars: true, totalFourStars: true, pity5: true, fiftyFiftyWon: true, fiftyFiftyLost: true } } : undefined,
        economyStats: metric.source === 'economy' ? { select: { totalPrimosEarned: true, totalPrimosSpent: true, totalMorasEarned: true, totalMorasSpent: true } } : undefined,
        combatStats: metric.source === 'combat' ? { select: { totalWins: true, totalManualWins: true } } : undefined,
        expedition: metric.source === 'expedition' ? { select: { totalCompleted: true } } : undefined,
        socialStats: metric.source === 'social' ? { select: { totalFriendHeartsSent: true } } : undefined,
        resourceBalances: metric.source === 'balances' || metric.source === 'bank' ? { where: { resourceKey: { in: metric.id === 'moras' ? ['moras'] : metric.id === 'primos' ? ['primogems'] : metric.id === 'particles' ? elementKeys.map(key => `particles_${key}`) : [`particles_${metric.id}`] } }, select: { resourceKey: true, amount: true } } : undefined,
        bankAccount: metric.source === 'bank' ? { select: { balance: true } } : undefined,
        characters: metric.source === 'box' ? { where: { character: { isActive: true } }, select: { constellation: true, copies: true, character: { select: { rarity: true } } } } : undefined,
      },
    });
    const eligible: Ranked[] = [];
    for (const player of players) {
      const overrides = new Map((player.privacySettings ?? []).map(setting => [setting.categoryKey, setting.level]));
      if (!metric.privacy.every(category => (overrides.get(category) ?? privacyDefaults[category]) === 'PUBLIC')) continue;
      const balances = new Map((player.resourceBalances ?? []).map(balance => [balance.resourceKey, balance.amount]));
      const balance = (key: string) => balances.get(key) ?? null;
      const walletMoras = balance('moras');
      const particles = elementKeys.map(key => balance(`particles_${key}`));
      const values: Values = {
        xp: player.progression?.xp ?? null, level: player.progression ? BigInt(derivePlayerLevel(player.progression.xp)) : null,
        messages: player.progression?.totalMessages ?? null, messagesXp: player.progression?.countedMessages ?? null,
        pulls: player.gachaState?.totalPulls ?? null,
        rate5: player.gachaState && player.gachaState.totalPulls >= 100n ? { numerator: player.gachaState.totalFiveStars, denominator: player.gachaState.totalPulls } : null,
        stars5: player.gachaState?.totalFiveStars ?? null, stars4: player.gachaState?.totalFourStars ?? null,
        pity5: player.gachaState ? BigInt(player.gachaState.pity5) : null, won5050: player.gachaState?.fiftyFiftyWon ?? null, lost5050: player.gachaState?.fiftyFiftyLost ?? null,
        primos: balance('primogems'), moras: walletMoras === null ? null : walletMoras + (player.bankAccount?.balance ?? 0n),
        particles: particles.every(value => value !== null) ? particles.reduce<bigint>((sum, value) => sum + value!, 0n) : null,
        pyro: particles[0] ?? null, hydro: particles[1] ?? null, cryo: particles[2] ?? null, electro: particles[3] ?? null, anemo: particles[4] ?? null, geo: particles[5] ?? null, dendro: particles[6] ?? null,
        primosEarned: player.economyStats?.totalPrimosEarned ?? null, primosSpent: player.economyStats?.totalPrimosSpent ?? null,
        morasEarned: player.economyStats?.totalMorasEarned ?? null, morasSpent: player.economyStats?.totalMorasSpent ?? null,
        box: BigInt(player.characters?.length ?? 0), c6: BigInt(player.characters?.filter(character => character.constellation >= 6).length ?? 0),
        'c6-5': BigInt(player.characters?.filter(character => character.constellation >= 6 && (character as typeof character & { character: { rarity: number } }).character.rarity === 5).length ?? 0),
        'c6-4': BigInt(player.characters?.filter(character => character.constellation >= 6 && (character as typeof character & { character: { rarity: number } }).character.rarity === 4).length ?? 0),
        copies: player.characters?.reduce((sum, character) => sum + BigInt(character.copies), 0n) ?? 0n,
        combat: player.combatStats?.totalWins ?? null, combatManual: player.combatStats?.totalManualWins ?? null,
        expeditions: player.expedition?.totalCompleted ?? null, hearts: player.socialStats?.totalFriendHeartsSent ?? null,
      };
      const score = values[metric.id];
      if (score === null || compare(score, 0n) <= 0) continue;
      eligible.push({ playerId: player.id, displayName: player.displayName, elementKey: player.elementKey!, score, rank: 0 });
    }
    eligible.sort((a, b) => compare(b.score, a.score) || normalizePlayerSearch(a.displayName).localeCompare(normalizePlayerSearch(b.displayName), 'fr') || a.playerId.localeCompare(b.playerId));
    eligible.forEach((row, index) => { row.rank = index && compare(row.score, eligible[index - 1]!.score) === 0 ? eligible[index - 1]!.rank : index + 1; });
    return eligible;
  }

  async list(metricId: string, viewerId: string, page = 1, pageSize = 5) {
    const metric = rankingRegistry.find(entry => entry.id === metricId);
    if (!metric) return null;
    const ranked = await this.ranked(metric);
    const totalPages = Math.max(1, Math.ceil(ranked.length / pageSize));
    const toEntry = (row: Ranked): Entry => ({ playerId: row.playerId, displayName: row.displayName, elementKey: row.elementKey, rank: row.rank, value: display(metric, row.score), isSelf: row.playerId === viewerId });
    const self = ranked.find(row => row.playerId === viewerId);
    let selfStatus: 'RANKED' | 'NOT_PUBLIC' | 'NOT_ELIGIBLE' = self ? 'RANKED' : 'NOT_ELIGIBLE';
    if (!self && metric.privacy.length) {
      const viewer = await this.database.player.findUnique({ where: { id: viewerId }, select: { status: true, elementKey: true, privacySettings: { select: { categoryKey: true, level: true } } } });
      if (viewer?.status === 'ACTIVE' && viewer.elementKey) {
        const overrides = new Map(viewer.privacySettings.map(setting => [setting.categoryKey, setting.level]));
        if (!metric.privacy.every(category => (overrides.get(category) ?? privacyDefaults[category]) === 'PUBLIC')) selfStatus = 'NOT_PUBLIC';
      }
    }
    return { metric, page, pageSize, total: ranked.length, totalPages, entries: ranked.slice((page - 1) * pageSize, page * pageSize).map(toEntry), self: self ? toEntry(self) : null, selfStatus };
  }

  async chatTop(metric: RankingDefinition, viewerId: string) {
    const page = await this.list(metric.id, viewerId, 1, 5);
    if (!page) return 'Métrique inconnue. Utilise !top.';
    const lines = page.entries.map(entry => `#${entry.rank} ${entry.displayName} — ${entry.value}`);
    if (page.self && !page.entries.some(entry => entry.isSelf)) lines.push(`Vous : #${page.self.rank} — ${page.self.value}`);
    return `${metric.label} : ${lines.join(' · ') || 'aucune donnée publique positive'}.`;
  }

  async personal(viewerId: string) {
    const player = await this.database.player.findUnique({ where: { id: viewerId }, select: {
      displayName: true, progression: { select: { xp: true } },
      gachaState: { select: { totalPulls: true, totalFiveStars: true, pity5: true } },
      resourceBalances: { where: { resourceKey: { in: ['primogems', 'moras'] } }, select: { resourceKey: true, amount: true } },
      characters: { where: { character: { isActive: true } }, select: { constellation: true } },
    } });
    if (!player) return 'Joueur introuvable.';
    const balance = (key: string) => player.resourceBalances.find(row => row.resourceKey === key)?.amount.toString() ?? 'indisponible';
    const gacha = player.gachaState;
    const rate = fiveStarRate(gacha?.totalFiveStars ?? null, gacha?.totalPulls ?? null);
    return `Top personnel — ${player.displayName} : niveau ${player.progression ? derivePlayerLevel(player.progression.xp) : 'indisponible'} · XP ${player.progression?.xp ?? 'indisponible'} · Pulls ${gacha?.totalPulls ?? 'indisponible'} · 5★ ${gacha?.totalFiveStars ?? 'indisponible'} · Taux 5★ ${rate ? `${rate} %` : 'indisponible'} · Pity 5★ ${gacha ? `${gacha.pity5}/90` : 'indisponible'} · Primos ${balance('primogems')} · Moras ${balance('moras')} · Box ${player.characters.length} · C6 ${player.characters.filter(row => row.constellation >= 6).length}.`;
  }
}
