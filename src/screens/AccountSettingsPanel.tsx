import { useEffect, useRef, useState } from 'react'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import AppButton from '../components/AppButton'
import { getGameApiClient } from '../api/game-api'
import type { SnapshotApplyDto, SnapshotPreviewDto, TwitchAccountDto } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'

const expected = new Set(['banner_votes.json', 'c6_characters.json', 'combat_config.json', 'combat_data.json', 'contests_data.json', 'element_passives.json', 'friendships_data.json', 'genshin_characters.json', 'gift_codes.json', 'giveaway.json', 'long_missions.json', 'missions_pool.json', 'monthly_boss.json', 'monthly_events.json', 'monthly_events_data.json', 'shop_items.json', 'viewers_data.json'])
type ConfirmAction = 'unlink' | 'apply' | null
const runtimeStatusError = (error: 'CONFLICT' | 'UNAVAILABLE') => error === 'CONFLICT'
  ? 'La réception du chat Twitch nécessite un contrôle opérateur.'
  : 'Le statut du chat Twitch est temporairement indisponible. Réessayez plus tard.'

export default function AccountSettingsPanel({ onRefreshPlayerState = async () => undefined }: { onRefreshPlayerState?: () => Promise<void> }) {
  const api = getGameApiClient()
  const [account, setAccount] = useState<TwitchAccountDto | null>(null)
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [preview, setPreview] = useState<SnapshotPreviewDto | null>(null)
  const [result, setResult] = useState<SnapshotApplyDto | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [runtimeChecking, setRuntimeChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const applyingRef = useRef(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<ConfirmAction>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => { folderRef.current?.setAttribute('webkitdirectory', '') }, [])
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelWait: (() => void) | undefined
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 8_000)
    const url = new URL(location.href)
    const outcome = url.searchParams.get('twitch')
    if (outcome) { url.searchParams.delete('twitch'); history.replaceState(history.state, '', url)
      if (outcome !== 'connected' && !outcome.startsWith('runtime-')) setError(outcome === 'TWITCH_IDENTITY_CONFLICT' ? 'Ce compte Twitch est déjà lié à un autre joueur.' : 'La liaison Twitch a échoué ou a été annulée.') }
    if (outcome === 'runtime-error') setError('L’autorisation ou l’activation du chat Twitch a échoué ou a été annulée.')
    void (async () => {
      try {
        let value = await api.getTwitchAccount(controller.signal)
        if (!active) return
        setAccount(value)
        if (value.runtimeChatPending && value.runtimeSubscriptionAvailable) {
          setRuntimeChecking(true)
          for (let attempt = 0; attempt < 4 && active && value.runtimeChatPending; attempt++) {
            await new Promise<void>(resolve => { cancelWait = resolve; timer = setTimeout(resolve, 1_000) })
            if (!active) return
            value = await api.getTwitchAccount(controller.signal)
            if (!active) return
            setAccount(value)
          }
          if (active && value.runtimeChatPending) setError('La réception du chat Twitch n’a pas pu être confirmée. Réessayez plus tard.')
        }
        if (active && value.runtimeChatError) setError(runtimeStatusError(value.runtimeChatError))
      } catch (reason) { if (active) setError(controller.signal.aborted ? 'Le statut du chat Twitch n’a pas pu être confirmé. Réessayez plus tard.' : apiErrorMessage(reason)) }
      finally { clearTimeout(deadline); if (active) setRuntimeChecking(false) }
    })()
    return () => { active = false; controller.abort(); clearTimeout(deadline); clearTimeout(timer); cancelWait?.() }
  }, [api])
  useEffect(() => {
    if (!confirm) return
    confirmRef.current?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!applyingRef.current) setConfirm(null) }
      if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
        if (!buttons.length) return
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
      }
    }
    window.addEventListener('keydown', keys)
    return () => { window.removeEventListener('keydown', keys); openerRef.current?.focus() }
  }, [confirm])
  const run = async (action: () => Promise<void>) => {
    if (pendingRef.current || applyingRef.current || runtimeChecking) return
    pendingRef.current = true
    setPending(true); setError('')
    try { await action() } catch (reason) { setError(apiErrorMessage(reason)) }
    finally { pendingRef.current = false; setPending(false) }
  }
  const select = async (list: FileList | null) => {
    if (applyingRef.current) return
    setFiles(null); setPreview(null); setResult(null); setError('')
    if (!list) return
    const selected = Array.from(list)
    const names = selected.map(file => file.name)
    if (selected.length !== expected.size || new Set(names).size !== expected.size || names.some(name => !expected.has(name))) { setError('Sélectionnez exactement les 17 fichiers JSON attendus.'); return }
    if (selected.some(file => file.size > 4_000_000) || selected.reduce((sum, file) => sum + file.size, 0) > 8_000_000) { setError('Snapshot trop volumineux.'); return }
    try {
      const contents = await Promise.all(selected.map(async file => [file.name, await file.text()] as const))
      setFiles(Object.fromEntries(contents))
    } catch { setError('Impossible de lire les fichiers sélectionnés.') }
  }
  const connect = () => void run(async () => { const { url } = await api.startTwitchLink(); if (new URL(url).origin !== 'https://id.twitch.tv') throw new Error('URL Twitch invalide.'); location.assign(url) })
  const activateRuntime = () => void run(async () => {
    const { url } = await api.startTwitchRuntime()
    const target = new URL(url)
    if (target.origin !== 'https://id.twitch.tv' || target.pathname !== '/oauth2/authorize' || target.username || target.password) throw new Error('URL Twitch invalide.')
    location.assign(target.toString())
  })
  const disableRuntime = () => void run(async () => {
    await api.disableTwitchRuntime()
    const value = await api.getTwitchAccount()
    setAccount(value)
    if (value.runtimeChatError) setError(runtimeStatusError(value.runtimeChatError))
  })
  const confirmAction = () => {
    if (pendingRef.current || pending || applyingRef.current || runtimeChecking) return
    if (confirm === 'unlink') { void run(async () => { await api.unlinkTwitch(); setAccount(await api.getTwitchAccount()); setPreview(null); setFiles(null); setConfirm(null) }); return }
    if (confirm !== 'apply' || !preview || !files) return
    applyingRef.current = true
    setApplying(true)
    setPending(true)
    setError('')
    void (async () => {
      try {
        const value = await api.applyTwitchSnapshot(files, preview.previewId)
        setResult(value)
        setPreview(null)
        setConfirm(null)
        try { await onRefreshPlayerState(); setAccount(await api.getTwitchAccount()) }
        catch (reason) { setError(`Import terminé, mais l’actualisation a échoué : ${apiErrorMessage(reason)}`) }
      } catch (reason) { setError(apiErrorMessage(reason)) }
      finally { applyingRef.current = false; setApplying(false); setPending(false) }
    })()
  }
  return <ScrollableScreenPanel className="configuration-frame" fixed={<header className="menu-configuration-heading"><h2>Compte</h2></header>}>
    <div className="account-settings">
      {error && <p className="configuration-error" role="alert">{error}</p>}
      {!account ? <p>Chargement du compte…</p> : <section className="account-section"><h3>Compte Twitch</h3>
        {account.linked ? <><p><strong>{account.linked.displayName || account.linked.login}</strong> · Connecté</p><p>Lié le {new Date(account.linked.linkedAt).toLocaleDateString('fr-FR')}</p>
          {account.eligible && account.runtimeSubscriptionAvailable && <div className="account-twitch-runtime" aria-busy={pending || runtimeChecking}>
            <h4>Réception du chat Twitch</h4>
            <p className={account.runtimeChatActive ? 'account-twitch-active' : undefined}>{runtimeChecking ? 'Chargement du compte…' : account.runtimeChatActive ? '● Activée' : 'Non activée'}</p>
            <p className="account-twitch-description">{account.runtimeChatActive ? 'GachaImpact reçoit les messages du chat Twitch.' : 'Permet à GachaImpact de recevoir les messages du chat Twitch pendant le pilote.'}</p>
            <AppButton disabled={pending || runtimeChecking || account.runtimeChatPending} aria-busy={pending} onClick={account.runtimeChatActive ? disableRuntime : activateRuntime}>{account.runtimeChatActive ? 'Désactiver' : 'Autoriser et activer'}</AppButton>
          </div>}
          <button type="button" disabled={pending || runtimeChecking} onClick={event => { openerRef.current = event.currentTarget; setConfirm('unlink') }}>Délier Twitch</button></>
          : <><p>Non connecté</p><button type="button" disabled={!account.pilotAvailable || pending} onClick={connect}>Connecter Twitch</button>{!account.pilotAvailable && <p>La liaison Twitch est indisponible pour ce compte ou sur ce serveur.</p>}</>}
      </section>}
      {account?.snapshotAvailable && <section className="account-section"><h3>Snapshot Streamer.bot</h3><p>Le standalone est un miroir de test. Sélectionnez les fichiers locaux ; ils ne seront pas modifiés.</p>
        <div className="account-actions"><label>Choisir le dossier Data<input ref={folderRef} type="file" multiple accept=".json" disabled={pending} onChange={event => void select(event.target.files)} /></label><label>Ou choisir 17 fichiers JSON<input type="file" multiple accept=".json" disabled={pending} onChange={event => void select(event.target.files)} /></label></div>
        {files && <><p>17 fichiers sélectionnés.</p><button type="button" disabled={pending} onClick={() => void run(async () => { setPreview(await api.previewTwitchSnapshot(files)); setResult(null) })}>Prévisualiser le snapshot</button></>}
        {preview && <div className="account-preview"><p>Snapshot : <code>{preview.snapshotHash}</code></p><p>Viewer Kichnifou trouvé · {preview.files} fichiers reconnus</p><div className="account-domain-list">{preview.domains.map(domain => <article key={domain.name}><strong>{domain.name}</strong><span>{domain.action}</span><small>Catégorie : {domain.category}</small><small>Actuel : {domain.current}</small><small>Snapshot : {domain.snapshot}</small>{domain.reason && <small>Raison : {domain.reason}</small>}{domain.anomalies.map(message => <small key={message}>{message}</small>)}</article>)}</div><p className="account-warning">{preview.warning}</p><button type="button" disabled={pending || preview.domains.some(domain => domain.category === 'BLOCKED_AMBIGUOUS' || (domain.category === 'PLAYER_LOCAL_PHYSICAL' && domain.action === 'PENDING_MAPPING'))} onClick={event => { openerRef.current = event.currentTarget; setConfirm('apply') }}>{account.lastImport ? 'Confirmer le rafraîchissement' : 'Confirmer l’import'}</button></div>}
        {result && <p role="status">{result.replayed ? 'Snapshot déjà importé.' : 'Import terminé.'} Domaines importés : {result.imported.join(', ')}. Domaines différés : {result.deferred.length}.</p>}
        {account.lastImport && <p>Dernier import : {new Date(account.lastImport.at).toLocaleString('fr-FR')}</p>}
      </section>}
    </div>
    {confirm && <div className="account-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !applyingRef.current) setConfirm(null) }}><div ref={dialogRef} className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="account-confirm-title" aria-busy={applying}><h3 id="account-confirm-title">{confirm === 'unlink' ? 'Délier Twitch ?' : 'Confirmer le rafraîchissement ?'}</h3><p>{confirm === 'unlink' ? 'La liaison Twitch sera retirée. Votre Player, votre compte web et votre progression seront conservés.' : preview?.warning}</p>{applying && <p className="account-apply-progress" role="status"><span className="account-apply-spinner" aria-hidden="true" />{account?.lastImport ? 'Rafraîchissement en cours…' : 'Import en cours…'}</p>}<div><button type="button" disabled={applying} onClick={() => setConfirm(null)}>Annuler</button><button ref={confirmRef} type="button" disabled={pending} onClick={confirmAction}>{applying ? account?.lastImport ? 'Rafraîchissement en cours…' : 'Import en cours…' : 'Confirmer'}</button></div></div></div>}
  </ScrollableScreenPanel>
}
