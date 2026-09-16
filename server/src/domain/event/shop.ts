export const EVENT_SHOP_RATES = { PRIMOGEMS: 160n, MORAS: 20_000n } as const;
export const EVENT_COLLECTION_COST = 80n;

export type EventShopTarget = keyof typeof EVENT_SHOP_RATES;

// Edition snapshots use presentation keys; Collection uses the durable ItemDefinition catalog.
const collectionItemKeys: Record<string, string> = {
  'new-year-lantern': 'lanterne_nouvel_an',
  'crystal-heart': 'coeur_cristallin',
  'eternal-bud': 'bourgeon_eternel',
  'enchanted-egg': 'oeuf_enchante',
  'spring-flower': 'fleur_de_printemps',
  'golden-shell': 'coquillage_dore',
  'shooting-star': 'etoile_filante',
  'antique-compass': 'boussole_antique',
  'harvest-sheaf': 'gerbe_de_recolte',
  'haunted-pumpkin': 'citrouille_hantee',
  'ancient-leaf': 'feuille_ancienne',
  'enchanted-snowflake': 'flocon_enchante',
};

export function collectionItemExternalKey(snapshotKey: string): string {
  const key = collectionItemKeys[snapshotKey];
  if (!key) throw new Error(`Unknown Event Collection item ${snapshotKey}.`);
  return key;
}

export function eventShopQuantity(value: number): bigint {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError('Event Shop quantity must be a positive safe integer.');
  return BigInt(value);
}
