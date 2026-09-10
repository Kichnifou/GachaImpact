import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/game-api'
import { ShopPurchaseIntentCoordinator } from './shop-purchase-intent-coordinator'

describe('ShopPurchaseIntentCoordinator', () => {
  it('reuses the key after an ambiguous failure and clears it after success', async () => { const coordinator = new ShopPurchaseIntentCoordinator(() => 'key'); const request = vi.fn().mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'network', null)).mockResolvedValueOnce('ok'); await expect(coordinator.execute('p', 'i', '2', request)).rejects.toThrow(); await expect(coordinator.execute('p', 'i', '2', request)).resolves.toBe('ok'); expect(request).toHaveBeenNthCalledWith(1, 'key'); expect(request).toHaveBeenNthCalledWith(2, 'key'); expect(coordinator.getIntent('p')).toBeNull() });
  it('blocks an incompatible retry and clears all state on logout', async () => { const coordinator = new ShopPurchaseIntentCoordinator(() => 'key'); await expect(coordinator.execute('p', 'i', '1', async () => { throw new ApiError('NETWORK_ERROR', 'network', null) })).rejects.toThrow(); await expect(coordinator.execute('p', 'other', '1', async () => null)).rejects.toMatchObject({ code: 'SHOP_PURCHASE_INTENT_CONFLICT' }); coordinator.clear(); expect(coordinator.getIntent('p')).toBeNull() });
})
