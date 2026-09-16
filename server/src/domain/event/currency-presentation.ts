// The plural is frozen in each edition snapshot; these validated singulars
// are presentation data, never inferred by removing a suffix.
const singularByFestival = {
  'new-year': 'Éclat de Fortune',
  hearts: 'Cœur Étincelant',
  spring: 'Bourgeon Mystique',
  bells: 'Œuf Enchanté',
  flowers: 'Pétale Magique',
  summer: 'Coquillage Doré',
  stars: 'Étoile Tombée',
  adventurers: 'Relique d’Exploration',
  harvest: 'Jeton de Récolte',
  shadows: 'Bonbon Maudit',
  mists: 'Feuille Ancienne',
  christmas: 'Étoile de Noël',
} as const;

export function eventCurrencyUnit(festivalKey: string): string {
  const unit = singularByFestival[festivalKey as keyof typeof singularByFestival];
  if (!unit) throw new Error(`Unknown Festival currency unit: ${festivalKey}`);
  return unit;
}

export function eventCurrencyName(amount: number, unit: string, plural: string): string {
  return `${amount} ${amount === 1 ? unit : plural}`;
}
