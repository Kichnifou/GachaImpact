import type { BankTransferDto, PlayerResourcesDto } from '../api/types'

export function applyBankWalletToResources(resources: PlayerResourcesDto, bank: Pick<BankTransferDto, 'walletMoras'>): PlayerResourcesDto {
  return { ...resources, moras: bank.walletMoras }
}

export function formatBankCountdown(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')} h ${String(minutes).padStart(2, '0')} min`
}
