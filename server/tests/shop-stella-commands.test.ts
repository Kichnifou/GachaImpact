import { describe, expect, it } from 'vitest';
import { actor, commandId, harness } from './helpers/chat-command-harness.js';
describe('Stella shop command', () => {
  it('buys exactly one Stella through the shared owner and reports its exact price', async () => {
    const h = harness();
    h.services.getCurrentPlayerShop.execute.mockResolvedValue({ items: [{ id: 'stella', externalKey: 'masterless-stella-fortuna', available: true }], resources: { moras: 50000000n } } as never);
    h.services.purchaseShopItemChat.execute.mockResolvedValue({ purchase: { quantity: 1n, displayName: 'Masterless Stella Fortuna', totalPrice: 50000000n, effect: { type: 'masterless_stella', amount: 1n } } } as never);
    expect(await h.send('!shop stella')).toContain('+1 Masterless Stella Fortuna');
    expect(h.services.purchaseShopItemChat.execute).toHaveBeenCalledWith(actor, 'stella', 1n, commandId);
  });
  it.each(['1', 'max'])('refuses a new retired primos %s intent even with a stale catalogue', async quantity => {
    const h = harness();
    expect(await h.send('!shop primos ' + quantity)).toContain('!shop stella');
    expect(h.services.purchaseShopItemChat.execute).not.toHaveBeenCalled();
  });
  it.each(['2', 'max'])('refuses Stella %s without preparing a mutation', async quantity => {
    const h = harness(); await h.send('!shop stella ' + quantity);
    expect(h.services.purchaseShopItemChat.execute).not.toHaveBeenCalled();
  });
});
