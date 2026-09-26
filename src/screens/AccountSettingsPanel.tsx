import { useEffect, useRef, useState } from 'react'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { getGameApiClient } from '../api/game-api'
import type { SnapshotApplyDto, SnapshotPreviewDto, TwitchAccountDto } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'

const expected = new Set(['banner_votes.json', 'c6_characters.json', 'combat_config.json', 'combat_data.json', 'contests_data.json', 'element_passives.json', 'friendships_data.json', 'genshin_characters.json', 'gift_codes.json', 'giveaway.json', 'long_missions.json', 'missions_pool.json', 'monthly_boss.json', 'monthly_events.json', 'monthly_events_data.json', 'shop_items.json', 'viewers_data.json'])
type ConfirmAction = 'unlink' | 'apply' | null

export default function AccountSettingsPanel() {
  const api = getGameApiClient()
  const [account, setAccount] = useState<TwitchAccountDto | null>(null)
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [preview, setPreview] = useState<SnapshotPreviewDto | null>(null)
  const [result, setResult] = useState<SnapshotApplyDto | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<ConfirmAction>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => { folderRef.current?.setAttribute('webkitdirectory', '') }, [])
  useEffect(() => {
    let active = true
    void api.getTwitchAccount().then(value => { if (active) setAccount(value) }).catch(reason => { if (active) setError(apiErrorMessage(reason)) })
    const url = new URL(location.href)
    const outcome = url.searchParams.get('twitch')
    if (outcome) { url.searchParams.delete('twitch'); history.replaceState(history.state, '', url)
      if (outcome !== 'connected') setError(outcome === 'TWITCH_IDENTITY_CONFLICT' ? 'Ce compte Twitch est déjà lié à un autre joueur.' : 'La liaison Twitch a échoué ou a été annulée.') }
    return () => { active = false }
  }, [api])
  useEffect(() => {
    if (!confirm) return
    confirmRef.current?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setConfirm(null) }
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
  const run = async (action: () => Promise<void>) => { setPending(true); setError(''); try { await action() } catch (reason) { setError(apiErrorMessage(reason)) } finally { setPending(false) } }
  const select = async (list: FileList | null) => {
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
  const confirmAction = () => void run(async () => {
    if (confirm === 'unlink') { await api.unlinkTwitch(); setAccount(await api.getTwitchAccount()); setPreview(null); setFiles(null) }
    else if (confirm === 'apply' && preview && files) { const value = await api.applyTwitchSnapshot(files, preview.previewId); setResult(value); setPreview(null); setAccount(await api.getTwitchAccount()) }
    setConfirm(null)
  })
  return <ScrollableScreenPanel className="configuration-frame" fixed={<header className="menu-configuration-heading"><h2>Compte</h2></header>}>
    <div className="account-settings">
      {error && <p className="configuration-error" role="alert">{error}</p>}
      {!account ? <p>Chargement du compte…</p> : <section className="account-section"><h3>Compte Twitch</h3>
        {account.linked ? <><p><strong>{account.linked.displayName || account.linked.login}</strong> · Connecté</p><p>Lié le {new Date(account.linked.linkedAt).toLocaleDateString('fr-FR')}</p><button type="button" disabled={pending} onClick={event => { openerRef.current = event.currentTarget; setConfirm('unlink') }}>Délier Twitch</button></>
          : <><p>Non connecté</p><button type="button" disabled={!account.pilotAvailable || pending} onClick={connect}>Connecter Twitch</button>{!account.pilotAvailable && <p>La liaison Twitch est indisponible pour ce compte ou sur ce serveur.</p>}</>}
      </section>}
      {account?.snapshotAvailable && <section className="account-section"><h3>Snapshot Streamer.bot</h3><p>Le standalone est un miroir de test. Sélectionnez les fichiers locaux ; ils ne seront pas modifiés.</p>
        <div className="account-actions"><label>Choisir le dossier Data<input ref={folderRef} type="file" multiple accept=".json" onChange={event => void select(event.target.files)} /></label><label>Ou choisir 17 fichiers JSON<input type="file" multiple accept=".json" onChange={event => void select(event.target.files)} /></label></div>
        {files && <><p>17 fichiers sélectionnés.</p><button type="button" disabled={pending} onClick={() => void run(async () => { setPreview(await api.previewTwitchSnapshot(files)); setResult(null) })}>Prévisualiser le snapshot</button></>}
        {preview && <div className="account-preview"><p>Snapshot : <code>{preview.snapshotHash}</code></p><p>Viewer Kichnifou trouvé · {preview.files} fichiers reconnus</p><div className="account-domain-list">{preview.domains.map(domain => <article key={domain.name}><strong>{domain.name}</strong><span>{domain.action}</span><small>Catégorie : {domain.category}</small><small>Actuel : {domain.current}</small><small>Snapshot : {domain.snapshot}</small>{domain.reason && <small>Raison : {domain.reason}</small>}{domain.anomalies.map(message => <small key={message}>{message}</small>)}</article>)}</div><p className="account-warning">{preview.warning}</p><button type="button" disabled={pending || preview.domains.some(domain => domain.category === 'BLOCKED_AMBIGUOUS' || (domain.category === 'PLAYER_LOCAL_PHYSICAL' && domain.action === 'PENDING_MAPPING'))} onClick={event => { openerRef.current = event.currentTarget; setConfirm('apply') }}>{account.lastImport ? 'Confirmer le rafraîchissement' : 'Confirmer l’import'}</button></div>}
        {result && <p role="status">{result.replayed ? 'Snapshot déjà importé.' : 'Import terminé.'} Domaines importés : {result.imported.join(', ')}. Domaines différés : {result.deferred.length}.</p>}
        {account.lastImport && <p>Dernier import : {new Date(account.lastImport.at).toLocaleString('fr-FR')}</p>}
      </section>}
    </div>
    {confirm && <div className="account-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirm(null) }}><div ref={dialogRef} className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="account-confirm-title"><h3 id="account-confirm-title">{confirm === 'unlink' ? 'Délier Twitch ?' : 'Confirmer le rafraîchissement ?'}</h3><p>{confirm === 'unlink' ? 'La liaison Twitch sera retirée. Votre Player, votre compte web et votre progression seront conservés.' : preview?.warning}</p><div><button type="button" onClick={() => setConfirm(null)}>Annuler</button><button ref={confirmRef} type="button" disabled={pending} onClick={confirmAction}>Confirmer</button></div></div></div>}
  </ScrollableScreenPanel>
}
