import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/game-api'
import { BankTransferIntentCoordinator } from './bank-transfer-intent-coordinator'

const playerId = 'player-a'

describe('BankTransferIntentCoordinator', () => {
  it('reuses the same key after an ambiguous network error and clears it after a successful retry', async () => {
    const coordinator = new BankTransferIntentCoordinator(() => 'key-a')
    const request = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réponse perdue', null))
      .mockResolvedValueOnce({ operation: { alreadyProcessed: true } })

    await expect(coordinator.execute(playerId, 'deposit', '100', request)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(coordinator.getIntent(playerId)).toMatchObject({ direction: 'deposit', amountIntent: '100', idempotencyKey: 'key-a' })

    await expect(coordinator.execute(playerId, 'deposit', '100', request)).resolves.toMatchObject({ operation: { alreadyProcessed: true } })
    expect(request.mock.calls).toEqual([['key-a'], ['key-a']])
    expect(coordinator.getIntent(playerId)).toBeNull()
  })

  it('blocks a different amount, direction or MAX while an ambiguous intent remains', async () => {
    const coordinator = new BankTransferIntentCoordinator(() => 'key-a')
    const request = vi.fn().mockRejectedValue(new ApiError('INTERNAL_ERROR', 'État inconnu', 500))
    await expect(coordinator.execute(playerId, 'deposit', '100', request)).rejects.toMatchObject({ code: 'INTERNAL_ERROR' })

    for (const [direction, amount] of [['deposit', '200'], ['withdraw', '100'], ['deposit', 'max']] as const) {
      await expect(coordinator.execute(playerId, direction, amount, request)).rejects.toMatchObject({ code: 'BANK_TRANSFER_INTENT_CONFLICT' })
    }
    expect(request).toHaveBeenCalledTimes(1)
    expect(coordinator.getIntent(playerId)?.idempotencyKey).toBe('key-a')
  })

  it('clears a deterministic error so the next operation receives a new key', async () => {
    const keys = ['key-a', 'key-b']
    const coordinator = new BankTransferIntentCoordinator(() => keys.shift()!)
    await expect(coordinator.execute(playerId, 'deposit', '100', async () => {
      throw new ApiError('BANK_WALLET_INSUFFICIENT', 'Solde insuffisant', 409)
    })).rejects.toMatchObject({ code: 'BANK_WALLET_INSUFFICIENT' })
    expect(coordinator.getIntent(playerId)).toBeNull()

    const request = vi.fn(async () => 'ok')
    await expect(coordinator.execute(playerId, 'deposit', '200', request)).resolves.toBe('ok')
    expect(request).toHaveBeenCalledWith('key-b')
  })

  it('keeps a MAX intent stable across consumer remounts and isolates it by player', async () => {
    const keys = ['key-a', 'key-b']
    const coordinator = new BankTransferIntentCoordinator(() => keys.shift()!)
    await expect(coordinator.execute(playerId, 'withdraw', 'max', async () => {
      throw new ApiError('NETWORK_ERROR', 'Réponse perdue', null)
    })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    const remountedConsumer = vi.fn(async () => 'retried')
    await expect(coordinator.execute(playerId, 'withdraw', 'max', remountedConsumer)).resolves.toBe('retried')
    expect(remountedConsumer).toHaveBeenCalledWith('key-a')

    const otherPlayerRequest = vi.fn(async () => 'other')
    await coordinator.execute('player-b', 'deposit', '10', otherPlayerRequest)
    expect(otherPlayerRequest).toHaveBeenCalledWith('key-b')
  })

  it('allows only one active request per player', async () => {
    let finish!: () => void
    const coordinator = new BankTransferIntentCoordinator(() => 'key-a')
    const first = coordinator.execute(playerId, 'deposit', '100', () => new Promise<void>((resolve) => { finish = resolve }))

    await expect(coordinator.execute(playerId, 'deposit', '100', async () => undefined)).rejects.toMatchObject({ code: 'BANK_TRANSFER_IN_PROGRESS' })
    finish()
    await first
  })
})
