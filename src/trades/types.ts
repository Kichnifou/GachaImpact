import type { ElementKey } from '../api/types'
export type TradePlayer = { id: string; displayName: string; elementKey: ElementKey; avatarAssetPath?: string | null }
export type TradeStock = { resourceKey: string; total: string; reserved: string; available: string }
export type TradeRequest = { id: string; sender: TradePlayer; recipient: TradePlayer; senderResourceKey: string; recipientResourceKey: string; originalAmount: string; currentAmount: string; createdAt: string; expiresAt: string }
export type TradeSnapshot = { stocks: TradeStock[]; received: TradeRequest[]; sent: TradeRequest[]; history: (TradeRequest & { amount: string; executedAt: string })[] }
export type TradePartners = { partners: (TradePlayer & { avatarAssetPath: string | null; maximum: string })[]; page: number; pageSize: number; total: number; totalPages: number }
export type TradeResult = { requestId: string; state: string; amount: string }
export type TradeActions = {
  snapshot(): Promise<TradeSnapshot>
  partners(q: string, page: number, signal?: AbortSignal): Promise<TradePartners>
  create(recipientPlayerId: string, amount: string, key: string): Promise<TradeResult>
  mutate(id: string, action: 'accept' | 'refuse' | 'cancel', key: string): Promise<TradeResult>
  all(action: 'accept' | 'refuse', key: string): Promise<{ results: TradeResult[] }>
}
