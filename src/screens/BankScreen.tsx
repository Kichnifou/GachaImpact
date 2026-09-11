import { useCallback, useEffect, useRef, useState } from 'react'

import type { BankHistoryDto, BankOperationDto, BankTransferDto, PlayerBankDto } from '../api/types'
import type { BankTransferDirection } from '../bank/bank-transfer-intent-coordinator'
import { formatBankCountdown } from '../bank/bank-presentation'
import GameAssetIcon from '../components/GameAssetIcon'
import HistoryModalShell from '../components/HistoryModalShell'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { currencyAssetPaths } from '../utils/gameAssets'

type BankScreenProps = {
  initialBank: PlayerBankDto | null
  onLoad: () => Promise<PlayerBankDto>
  onLoadHistory: (page: number) => Promise<BankHistoryDto>
  onTransfer: (direction: BankTransferDirection, amount: string) => Promise<BankTransferDto>
}

type Direction = BankTransferDirection

function BankScreen({ initialBank, onLoad, onLoadHistory, onTransfer }: BankScreenProps) {
  const [bank, setBank] = useState<PlayerBankDto | null>(initialBank)
  const [amounts, setAmounts] = useState<Record<Direction, string>>({ deposit: '', withdraw: '' })
  const [pending, setPending] = useState<Direction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [transferPulse, setTransferPulse] = useState<Direction | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
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

  const submit = async (direction: Direction) => {
    if (!bank || pending) return
    const amount = amounts[direction].trim()
    if (!/^[1-9]\d*$/.test(amount)) { setError('Saisissez un montant entier strictement positif.'); return }
    setPending(direction)
    setError(null)
    try {
      const result = await onTransfer(direction, amount)
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

  if (!bank) return <div className="screen-content bank-screen"><section className="panel bank-loading" role={error ? 'alert' : 'status'}>{error ?? 'Ouverture de votre Banque…'}</section></div>

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
          <TransferForm direction="deposit" label="Déposer" available={bank.walletMoras} value={amounts.deposit} disabled={pending !== null} pending={pending === 'deposit'} onChange={(value) => setAmounts((current) => ({ ...current, deposit: value }))} onSubmit={submit} onMax={() => setAmounts((current) => ({ ...current, deposit: bank.walletMoras }))} />
          <TransferForm direction="withdraw" label="Retirer" available={bank.bankMoras} value={amounts.withdraw} disabled={pending !== null} pending={pending === 'withdraw'} onChange={(value) => setAmounts((current) => ({ ...current, withdraw: value }))} onSubmit={submit} onMax={() => setAmounts((current) => ({ ...current, withdraw: bank.bankMoras }))} />
          {error && <p className="bank-error" role="alert">{error}</p>}
          <p className="bank-transfer-note">Les transferts sont gratuits et n’affectent pas vos statistiques de gains ou de dépenses.</p>
        </section>

        <section className="panel bank-history-panel">
          <div className="bank-section-heading"><div><span className="eyebrow">Activité</span><h2>Opérations récentes</h2></div></div>
          {bank.recentOperations.length ? <OperationList operations={bank.recentOperations.slice(0, 5)} /> : <div className="bank-empty-history"><span aria-hidden="true">◇</span><strong>Aucune opération</strong><p>Votre premier dépôt apparaîtra ici.</p></div>}
          <footer className="bank-history-footer"><button type="button" disabled={bank.recentOperations.length === 0} onClick={() => setHistoryOpen(true)}>Voir l’historique</button></footer>
        </section>
      </div>
      {historyOpen && <BankHistoryModal onClose={() => setHistoryOpen(false)} onLoad={onLoadHistory} />}
    </div>
  )
}

function BalanceCard({ label, value, detail, className }: { label: string; value: string; detail: string; className: string }) {
  return <article className={`panel bank-balance-card ${className}`}><GameAssetIcon className="bank-mora-icon" src={currencyAssetPaths.mora} fallback="●" /><div><span>{label}</span><strong>{formatResourceAmount(value)}</strong><small>{detail}</small></div></article>
}

function TransferForm({ direction, label, available, value, disabled, pending, onChange, onSubmit, onMax }: { direction: Direction; label: string; available: string; value: string; disabled: boolean; pending: boolean; onChange: (value: string) => void; onSubmit: (direction: Direction) => void; onMax: () => void }) {
  return <form className={`bank-transfer-form ${direction}`} onSubmit={(event) => { event.preventDefault(); void onSubmit(direction) }}>
    <div><strong>{label}</strong><small>Disponible : {formatResourceAmount(available)} Moras</small></div>
    <label><span className="sr-only">Montant à {label.toLowerCase()}</span><input inputMode="numeric" autoComplete="off" placeholder="Montant" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>
    <button type="button" className="bank-max-button" disabled={disabled} onClick={onMax}>MAX</button>
    <button type="submit" className="bank-submit-button" disabled={disabled}>{pending ? 'Traitement…' : label}</button>
  </form>
}

function OperationList({ operations }: { operations: readonly BankOperationDto[] }) {
  return <ol className="bank-history-list">{operations.map((operation) => <li key={operation.id}>
    <span className={`bank-operation-icon ${operation.type.toLowerCase()}`} aria-hidden="true">{operation.type === 'DEPOSIT' ? '↓' : operation.type === 'WITHDRAWAL' ? '↑' : '✦'}</span>
    <div><strong>{operationLabel(operation.type)}</strong><small>{formatOperationDate(operation.createdAt)}</small></div>
    <div className="bank-operation-values"><strong>{operation.type === 'WITHDRAWAL' ? '−' : '+'}{formatResourceAmount(operation.amount)}</strong><small>Banque : {formatResourceAmount(operation.bankBalanceAfter)}</small></div>
  </li>)}</ol>
}

export function BankHistoryModal({ onClose, onLoad }: { onClose: () => void; onLoad: (page: number) => Promise<BankHistoryDto> }) {
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<BankHistoryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      setError(null)
      try {
        const result = await onLoad(page)
        if (active) setHistory(result)
      } catch (reason) {
        if (active) setError(apiErrorMessage(reason))
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [onLoad, page])

  const visiblePage = history?.page ?? page
  const totalPages = Math.max(history?.totalPages ?? 0, 1)
  return <HistoryModalShell title="Historique de la Banque" category="Archives personnelles" labelledBy="bank-history-title" page={visiblePage} totalPages={totalPages} loading={loading} onPageChange={setPage} onClose={onClose}>
      <div className="history-table-wrap">
        {error ? <p className="detail-status error" role="alert">{error}</p> : !history && loading ? <p className="detail-status">Chargement de l’historique…</p> : history?.totalCount === 0 ? <p className="detail-status">Aucune opération enregistrée.</p> : <table className="bank-history-table"><thead><tr><th>Date</th><th>Opération</th><th>Montant</th><th>Banque après</th><th>Portefeuille après</th></tr></thead><tbody>{history?.operations.map((operation) => <tr key={operation.id}><td>{formatOperationDate(operation.createdAt)}</td><td>{operationLabel(operation.type)}</td><td>{operation.type === 'WITHDRAWAL' ? '−' : '+'}{formatResourceAmount(operation.amount)}</td><td>{formatResourceAmount(operation.bankBalanceAfter)}</td><td>{operation.walletBalanceAfter === null ? '—' : formatResourceAmount(operation.walletBalanceAfter)}</td></tr>)}</tbody></table>}
      </div>
    </HistoryModalShell>
}

function operationLabel(type: BankOperationDto['type']): string {
  return type === 'DEPOSIT' ? 'Dépôt' : type === 'WITHDRAWAL' ? 'Retrait' : 'Intérêt quotidien'
}

function formatOperationDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default BankScreen
