import { describe, expect, it } from 'vitest';
import { eventCurrencyName, eventCurrencyUnit } from '../src/domain/event/currency-presentation.js';

describe('Event currency presentation', () => {
  it('has the twelve validated singulars without grammatical inference', () => {
    expect(Object.fromEntries([
      'new-year', 'hearts', 'spring', 'bells', 'flowers', 'summer', 'stars', 'adventurers', 'harvest', 'shadows', 'mists', 'christmas',
    ].map((key) => [key, eventCurrencyUnit(key)]))).toEqual({
      'new-year': 'Éclat de Fortune', hearts: 'Cœur Étincelant', spring: 'Bourgeon Mystique', bells: 'Œuf Enchanté',
      flowers: 'Pétale Magique', summer: 'Coquillage Doré', stars: 'Étoile Tombée', adventurers: 'Relique d’Exploration',
      harvest: 'Jeton de Récolte', shadows: 'Bonbon Maudit', mists: 'Feuille Ancienne', christmas: 'Étoile de Noël',
    });
    expect(eventCurrencyName(1, eventCurrencyUnit('harvest'), 'Jetons de Récolte')).toBe('1 Jeton de Récolte');
    expect(eventCurrencyName(2, eventCurrencyUnit('harvest'), 'Jetons de Récolte')).toBe('2 Jetons de Récolte');
  });
});
