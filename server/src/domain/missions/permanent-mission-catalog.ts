export const permanentMissionRanks = ['B', 'A', 'S', 'Z'] as const;
export type PermanentMissionRankKey = typeof permanentMissionRanks[number];

export const permanentMissionMetrics = [
  'COUNTED_MESSAGES', 'PULLS', 'DISTINCT_CHARACTERS_4', 'DISTINCT_CHARACTERS_5',
  'MORAS_EARNED', 'MAIN_ELEMENT_PARTICLES_EARNED', 'EXPEDITIONS_COMPLETED',
  'COMBAT_WINS', 'FRIEND_HEARTS_SENT', 'C6_CHARACTERS', 'PERFECT_FRIENDSHIP',
  'PLAYER_LEVEL', 'MANUAL_COMBAT_WINS',
] as const;
export type PermanentMissionMetricKey = typeof permanentMissionMetrics[number];

export type PermanentMissionCatalogEntry = Readonly<{
  id: string;
  externalKey: string;
  metric: PermanentMissionMetricKey;
  rank: PermanentMissionRankKey;
  displayName: string;
  description: string;
  progressLabel: string;
  target: bigint;
  rewardPrimogems: bigint;
  displayOrder: number;
  isSecret: boolean;
}>;

const rankRewards = { B: 160n, A: 1_600n, S: 16_000n } as const;
const rankOrder = ['B', 'A', 'S'] as const;

const chains = [
  { prefix: 'messages', metric: 'COUNTED_MESSAGES', names: ['Bavard du jour', 'Voix infatigable', 'Légende du chat'], targets: [50n, 200n, 1_000n], descriptions: ['Envoyer 50 messages comptabilisés', 'Envoyer 200 messages comptabilisés', 'Envoyer 1 000 messages comptabilisés'], progressLabel: 'messages comptabilisés' },
  { prefix: 'pulls', metric: 'PULLS', names: ['Petit invocateur', 'Grand invocateur', 'Archonte des vœux'], targets: [50n, 200n, 1_000n], descriptions: ['Effectuer 50 Invocations', 'Effectuer 200 Invocations', 'Effectuer 1 000 Invocations'], progressLabel: 'Invocations effectuées' },
  { prefix: 'characters4', metric: 'DISTINCT_CHARACTERS_4', names: ['Collectionneur débutant', 'Collectionneur confirmé', 'Maître de la collection 4★'], targets: [3n, 10n, 30n], descriptions: ['Obtenir 3 personnages 4★ distincts', 'Obtenir 10 personnages 4★ distincts', 'Obtenir 30 personnages 4★ distincts'], progressLabel: 'personnages 4★ distincts' },
  { prefix: 'characters5', metric: 'DISTINCT_CHARACTERS_5', names: ['Première étoile', 'Chasseur d’étoiles', 'Constellation divine'], targets: [1n, 5n, 20n], descriptions: ['Obtenir 1 personnage 5★ distinct', 'Obtenir 5 personnages 5★ distincts', 'Obtenir 20 personnages 5★ distincts'], progressLabel: 'personnages 5★ distincts' },
  { prefix: 'moras', metric: 'MORAS_EARNED', names: ['Porte-monnaie rempli', 'Fortune croissante', 'Millionnaire'], targets: [50_000n, 200_000n, 1_000_000n], descriptions: ['Gagner 50 000 Moras', 'Gagner 200 000 Moras', 'Gagner 1 000 000 Moras'], progressLabel: 'Moras gagnées' },
  { prefix: 'main_particles', metric: 'MAIN_ELEMENT_PARTICLES_EARNED', names: ['Étincelle élémentaire', 'Maîtrise élémentaire', 'Archonte élémentaire'], targets: [500n, 2_000n, 10_000n], descriptions: ['Générer 500 particules de son élément personnel', 'Générer 2 000 particules de son élément personnel', 'Générer 10 000 particules de son élément personnel'], progressLabel: 'particules principales générées' },
  { prefix: 'expeditions', metric: 'EXPEDITIONS_COMPLETED', names: ['Voyageur', 'Aventurier', 'Explorateur légendaire'], targets: [3n, 10n, 30n], descriptions: ['Récupérer 3 expéditions', 'Récupérer 10 expéditions', 'Récupérer 30 expéditions'], progressLabel: 'expéditions récupérées' },
  { prefix: 'combat_wins', metric: 'COMBAT_WINS', names: ['Combattant novice', 'Guerrier confirmé', 'Héros du royaume'], targets: [5n, 20n, 100n], descriptions: ['Gagner 5 combats', 'Gagner 20 combats', 'Gagner 100 combats'], progressLabel: 'combats gagnés' },
  { prefix: 'friend_hearts', metric: 'FRIEND_HEARTS_SENT', names: ['Cœur généreux', 'Ami fidèle', 'Lien éternel'], targets: [10n, 40n, 200n], descriptions: ['Envoyer 10 cœurs validés', 'Envoyer 40 cœurs validés', 'Envoyer 200 cœurs validés'], progressLabel: 'cœurs envoyés' },
] as const;

const permanentEntries = rankOrder.flatMap((rank, rankIndex) => chains.map((chain, chainIndex): PermanentMissionCatalogEntry => ({
  id: `91000000-0000-4000-8000-${String(rankIndex * chains.length + chainIndex + 1).padStart(12, '0')}`,
  externalKey: `${chain.prefix}_${rank.toLowerCase()}`,
  metric: chain.metric,
  rank,
  displayName: chain.names[rankIndex]!,
  description: chain.descriptions[rankIndex]!,
  progressLabel: chain.progressLabel,
  target: chain.targets[rankIndex]!,
  rewardPrimogems: rankRewards[rank],
  displayOrder: chainIndex + 1,
  isSecret: false,
})));

const zEntries: readonly PermanentMissionCatalogEntry[] = [
  { id: '91000000-0000-4000-8000-000000000028', externalKey: 'c6_5_characters_z', metric: 'C6_CHARACTERS', rank: 'Z', displayName: 'Couronne des constellations', description: 'Posséder 5 personnages C6', progressLabel: 'personnages C6', target: 5n, rewardPrimogems: 160_000n, displayOrder: 1, isSecret: true },
  { id: '91000000-0000-4000-8000-000000000029', externalKey: 'perfect_friendship_z', metric: 'PERFECT_FRIENDSHIP', rank: 'Z', displayName: 'Amitié parfaite', description: 'Avoir au moins une relation au niveau 1000', progressLabel: 'amitiés parfaites', target: 1n, rewardPrimogems: 160_000n, displayOrder: 2, isSecret: true },
  { id: '91000000-0000-4000-8000-000000000030', externalKey: 'level_100_z', metric: 'PLAYER_LEVEL', rank: 'Z', displayName: 'Sommet de l’aventure', description: 'Atteindre le niveau Player 100', progressLabel: 'niveau Player', target: 100n, rewardPrimogems: 160_000n, displayOrder: 3, isSecret: true },
  { id: '91000000-0000-4000-8000-000000000031', externalKey: 'manual_combat_wins_z', metric: 'MANUAL_COMBAT_WINS', rank: 'Z', displayName: 'Maître du combat', description: 'Gagner 50 combats en mode manuel', progressLabel: 'victoires manuelles', target: 50n, rewardPrimogems: 160_000n, displayOrder: 4, isSecret: true },
];

export const permanentMissionCatalog = [...permanentEntries, ...zEntries] as const;
export const PERMANENT_MISSION_DEFINITION_COUNT = 31;
export const PERMANENT_MISSION_CHAIN_COUNT = 9;
export const PERMANENT_MISSION_BAS_COUNT = 27;
export const PERMANENT_MISSION_Z_COUNT = 4;
