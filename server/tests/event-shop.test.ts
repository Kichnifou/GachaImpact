import { describe, expect, it } from 'vitest';
import { collectionItemExternalKey, EVENT_COLLECTION_COST, EVENT_SHOP_RATES, eventShopQuantity } from '../src/domain/event/shop.js';

describe('Event Shop rules', () => {
  it('keeps fixed rates and the annual Collection cost', () => {
    expect(EVENT_SHOP_RATES).toEqual({ PRIMOGEMS: 160n, MORAS: 20_000n });
    expect(EVENT_COLLECTION_COST).toBe(80n);
  });
  it('maps frozen Event presentation keys to all twelve durable Collection items', () => {
    const keys = ['new-year-lantern', 'crystal-heart', 'eternal-bud', 'enchanted-egg', 'spring-flower', 'golden-shell', 'shooting-star', 'antique-compass', 'harvest-sheaf', 'haunted-pumpkin', 'ancient-leaf', 'enchanted-snowflake'];
    expect(new Set(keys.map(collectionItemExternalKey)).size).toBe(12);
    expect(collectionItemExternalKey('harvest-sheaf')).toBe('gerbe_de_recolte');
    expect(() => collectionItemExternalKey('unknown')).toThrow();
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid quantity %s', (value) => {
    expect(() => eventShopQuantity(value)).toThrow();
  });
  it('accepts a positive exact integer', () => {
    expect(eventShopQuantity(7)).toBe(7n);
  });
});
