import { useCallback, useEffect, useRef, useState } from 'react'

import type { BankTransferDto, PlayerBankDto } from '../api/types'
import { currencyAssetPaths } from '../utils/gameAssets'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import GameAssetIcon from '../components/GameAssetIcon'
import { formatBankCountdown } from '../bank/bank-presentation'

type BankScreenProps = {
  onLoad: () => Promise<PlayerBankDto>
  onDeposit: (amount: string, idempotencyKey: string) => Promise<BankTransferDto>
  onWithdraw: (amount: string, idempotencyKey: string) => Promise<BankTransferDto>
}

type Direction = 'deposit' | 'withdraw'

function BankScreen({ onLoad, onDeposit, onWithdraw }: BankScreenProps) {
  const [bank, setBank] = useState<PlayerBankDto | null>(null)
  const [amounts, setAmounts] = useState<Record<Direction, string>>({ deposit: '', withdraw: '' })
  const [pending, setPending] = useState<Direction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [transferPulse, setTransferPulse] = useState<Direction | null>(null)
  const expiredReset = useRef<string | null>(null)
  const latestLoad = useRef(0)
  const mounted = useRef(false)

  const load = useCallback(async () => {
    const loadId = ++latestLoad.current
    const next = await onLoad()
    if (mounted.current && loadId === latestLoad.current) {
      setBank(next)
      if (expiredReset.current !== next.nextInterestAt) expiredReset.current = null
    }
    return next
  }, [onLoad])

  useEffect(() => {
    mounted.current = true
    void load().catch((reason) => { if (mounted.current) setError(apiErrorMessage(reason)) })
    return () => { mounted.current = false; latestLoad.current += 1 }
  }, [load])

  useEffect(() => {
    if (!bank) return
    const update = () => {
      const remaining = Math.max(0, new Date(bank.nextInterestAt).getTime() - Date.now())
      setRemainingMs(remaining)
      if (remaining === 0 && expiredReset.current !== bank.nextInterestAt) {
        expiredReset.current = bank.nextInterestAt
        void load().catch((reason) => { expiredReset.current = null; setError(apiErrorMessage(reason)) })
      }
    }
    update()
    const timer = window.setInterval(update, 1_000)
    return () => window.clearInterval(timer)
  }, [bank, load])

  const submit = async (direction: Direction, requestedAmount?: 'max') => {
    if (!bank || pending) return
    const amount = requestedAmount ?? amounts[direction].trim()
    const available = direction === 'deposit' ? BigInt(bank.walletMoras) : BigInt(bank.bankMoras)
    if (amount !== 'max') {
      if (!/^[1-9]\d*$/.test(amount)) { setError('Saisissez un montant entier strictement positif.'); return }
      if (BigInt(amount) > available) { setError(direction === 'deposit' ? 'Votre portefeuille ne contient pas assez de Moras.' : 'Votre Banque ne contient pas assez de Moras.'); return }
    } else if (available === 0n) {
      setError(direction === 'deposit' ? 'Votre portefeuille est vide.' : 'Votre Banque est vide.'); return
    }
    setPending(direction)
    setError(null)
    try {
      const result = await (direction === 'deposit' ? onDeposit : onWithdraw)(amount, crypto.randomUUID())
      latestLoad.current += 1
      setBank(result)
      setAmounts((current) => ({ ...current, [direction]: '' }))
      setTransferPulse(direction)
      window.setTimeout(() => setTransferPulse(null), 900)
    } catch (reason) {
      setError(apiErrorMessage(reason))
    } finally {
      setPending(null)
    }
  }

  if (!bank) {
    return <div className="screen-content bank-screen"><section className="panel bank-loading" role={error ? 'alert' : 'status'}>{error ?? 'Ouverture de votre Banque…'}</section></div>
  }

  return (
    <div className={`screen-content bank-screen${transferPulse ? ` transfer-${transferPulse}` : ''}`}>
      <header className="bank-hero panel">
        <div><span className="eyebrow">Trésorerie astrale</span><h1>Banque</h1><p>Placez vos Moras à l’abri et faites fructifier votre épargne chaque jour.</p></div>
        <div className="bank-rate"><strong>{bank.interestRatePercent} %</strong><span>par jour</span></div>
      </header>

      <section className="bank-balances" aria-label="Soldes Banque">
        <BalanceCard label="Portefeuille" value={bank.walletMoras} detail="Disponible pour vos dépenses" className="wallet" />
        <BalanceCard label="Banque" value={bank.bankMoras} detail={`Prochain gain estimé : +${formatResourceAmount(bank.estimatedInterest)}`} className="vault" />
        <BalanceCard label="Patrimoine" value={bank.totalWealth} detail="Portefeuille + Banque" className="wealth" />
      </section>

      <div className="bank-main-grid">
        <section className="panel bank-transfer-panel">
          <div className="bank-section-heading"><div><span className="eyebrow">Transferts</span><h2>Gérer mes Moras</h2></div><span className="bank-countdown">Prochain intérêt dans <strong>{formatBankCountdown(remainingMs)}</strong></span></div>
          <TransferForm direction="deposit" label="Déposer" available={bank.walletMoras} value={amounts.deposit} disabled={pending !== null} pending={pending === 'deposit'} onChange={(value) => setAmounts((current) => ({ ...current, deposit: value }))} onSubmit={submit} />
          <TransferForm direction="withdraw" label="Retirer" available={bank.bankMoras} value={amounts.withdraw} disabled={pending !== null} pending={pending === 'withdraw'} onChange={(value) => setAmounts((current) => ({ ...current, withdraw: value }))} onSubmit={submit} />
          {error && <p className="bank-error" role="alert">{error}</p>}
          <p className="bank-transfer-note">Les transferts sont gratuits et n’affectent pas vos statistiques de gains ou de dépenses.</p>
        </section>

        <section className="panel bank-history-panel">
          <div className="bank-section-heading"><div><span className="eyebrow">Activité</span><h2>Opérations récentes</h2></div></div>
          {bank.recentOperations.length ? <ol className="bank-history-list">
            {bank.recentOperations.map((operation) => <li key={operation.id}>
              <span className={`bank-operation-icon ${operation.type.toLowerCase()}`} aria-hidden="true">{operation.type === 'DEPOSIT' ? '↓' : operation.type === 'WITHDRAWAL' ? '↑' : '✦'}</span>
              <div><strong>{operationLabel(operation.type)}</strong><small>{formatOperationDate(operation.createdAt)}</small></div>
              <div className="bank-operation-values"><strong>{operation.type === 'WITHDRAWAL' ? '−' : '+'}{formatResourceAmount(operation.amount)}</strong><small>Banque : {formatResourceAmount(operation.bankBalanceAfter)}</small></div>
            </li>)}
          </ol> : <div className="bank-empty-history"><span aria-hidden="true">◇</span><strong>Aucune opération</strong><p>Votre premier dépôt apparaîtra ici.</p></div>}
        </section>
      </div>
    </div>
  )
}

function BalanceCard({ label, value, detail, className }: { label: string; value: string; detail: string; className: string }) {
  return <article className={`panel bank-balance-card ${className}`}><GameAssetIcon className="bank-mora-icon" src={currencyAssetPaths.mora} fallback="●" /><div><span>{label}</span><strong>{formatResourceAmount(value)}</strong><small>{detail}</small></div></article>
}

function TransferForm({ direction, label, available, value, disabled, pending, onChange, onSubmit }: { direction: Direction; label: string; available: string; value: string; disabled: boolean; pending: boolean; onChange: (value: string) => void; onSubmit: (direction: Direction, amount?: 'max') => void }) {
  return <form className={`bank-transfer-form ${direction}`} onSubmit={(event) => { event.preventDefault(); void onSubmit(direction) }}>
    <div><strong>{label}</strong><small>Disponible : {formatResourceAmount(available)} Moras</small></div>
    <label><span className="sr-only">Montant à {label.toLowerCase()}</span><input inputMode="numeric" autoComplete="off" placeholder="Montant" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>
    <button type="button" className="bank-max-button" disabled={disabled} onClick={() => void onSubmit(direction, 'max')}>MAX</button>
    <button type="submit" className="bank-submit-button" disabled={disabled}>{pending ? 'Traitement…' : label}</button>
  </form>
}

function operationLabel(type: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST'): string {
  return type === 'DEPOSIT' ? 'Dépôt' : type === 'WITHDRAWAL' ? 'Retrait' : 'Intérêt quotidien'
}

function formatOperationDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default BankScreen
