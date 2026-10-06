import TwitchProgressionChoice from './TwitchProgressionChoice'
import type { TwitchLinkResolutionDto } from '../api/types'
import { useTutorialPresentation } from '../tutorial/tutorial-presentation'
import { useEffect, useRef, useState } from 'react'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import AppButton from '../components/AppButton'
import { getGameApiClient } from '../api/game-api'
import type { SnapshotApplyDto, SnapshotPreviewDto, TwitchAccountDto } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'

const expected = new Set(['banner_votes.json', 'c6_characters.json', 'combat_config.json', 'combat_data.json', 'contests_data.json', 'element_passives.json', 'friendships_data.json', 'genshin_characters.json', 'gift_codes.json', 'giveaway.json', 'long_missions.json', 'missions_pool.json', 'monthly_boss.json', 'monthly_events.json', 'monthly_events_data.json', 'shop_items.json', 'viewers_data.json'])
type ConfirmAction = 'apply' | null
const runtimeStatusError = (error: 'CONFLICT' | 'UNAVAILABLE') => error === 'CONFLICT'
  ? 'La réception du chat Twitch nécessite un contrôle opérateur.'
  : 'Le statut du chat Twitch est temporairement indisponible. Réessayez plus tard.'

const favorStatusError = (error: 'CONFLICT' | 'UNAVAILABLE') => error === 'CONFLICT'
  ? 'La réception des abonnements Twitch nécessite un contrôle opérateur.'
  : 'Le statut des abonnements Twitch est temporairement indisponible. Réessayez plus tard.'
const giftStatusError = (error: NonNullable<TwitchAccountDto['giftSupremeError']>) => error === 'MANUAL_REWARD_CONFLICT'
  ? 'Désactivez ou supprimez l’ancienne récompense Gift Suprême manuelle dans Twitch, puis cliquez sur Réessayer.'
  : error === 'CREDENTIAL_INVALID' ? 'L’autorisation Gift Suprême doit être renouvelée.'
    : error === 'CONFLICT' ? 'Gift Suprême nécessite un contrôle opérateur.' : 'Le statut Gift Suprême est temporairement indisponible. Réessayez plus tard.'
const awaitingSubscription = (value: TwitchAccountDto) => Boolean(value.giftSupremePending && value.giftSupremeAvailable || value.runtimeChatPending && value.runtimeSubscriptionAvailable || value.favorSubscriptionPending && value.favorSubscriptionAvailable)

export default function AccountSettingsPanel({ onRefreshPlayerState = async () => undefined }: { onRefreshPlayerState?: () => Promise<void> }) {
  const api = getGameApiClient()
  const [resolution, setResolution] = useState<TwitchLinkResolutionDto | null>(null)
  const [success, setSuccess] = useState('')
  const [account, setAccount] = useState<TwitchAccountDto | null>(null)
  const presentationMode = useTutorialPresentation().active
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [preview, setPreview] = useState<SnapshotPreviewDto | null>(null)
  const [result, setResult] = useState<SnapshotApplyDto | null>(null)
  const [pending, setPending] = useState(false)
  const [streamerbotAcknowledged, setStreamerbotAcknowledged] = useState(false)
  const pendingRef = useRef(false)
  const commandRevision = useRef(0)
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
    const outcome = presentationMode ? null : url.searchParams.get('twitch')
    if (outcome) { url.searchParams.delete('twitch'); history.replaceState(history.state, '', url)
      if (outcome !== 'connected' && outcome !== 'progression-choice' && outcome !== 'profile-recovered' && !outcome.startsWith('runtime-') && !outcome.startsWith('favor-runtime-') && !outcome.startsWith('gift-supreme-')) setError(outcome === 'TWITCH_PROFILE_WEB_CONFLICT' ? apiErrorMessage({ code: outcome }) : outcome === 'TWITCH_IDENTITY_CONFLICT' ? 'Ce compte Twitch possède déjà une identité web. Résolution opérateur nécessaire.' : outcome === 'TWITCH_PROFILE_NOT_DISPOSABLE' ? 'Votre profil web contient des données à préserver. Résolution opérateur nécessaire.' : outcome === 'TWITCH_PROFILE_NOT_FOUND' ? 'Aucun profil Twitch existant à récupérer.' : 'La liaison Twitch a échoué ou a été annulée.') }
    // OAuth returns through a full page bootstrap; the authenticated subject now resolves the recovered Player.
    if (outcome === 'connected' || outcome === 'profile-recovered') setSuccess('Compte Twitch lié. Twitch et l’application web utilisent la même progression.')
    if (outcome === 'profile-recovered') void onRefreshPlayerState().catch(reason => setError(apiErrorMessage(reason)))
    if (outcome === 'runtime-error') setError('L’autorisation ou l’activation du chat Twitch a échoué ou a été annulée.')
    if (outcome === 'favor-runtime-error') setError('L’autorisation ou l’activation des abonnements Twitch a échoué ou a été annulée.')
    if (outcome === 'gift-supreme-error') setError('L’autorisation ou l’activation Gift Suprême a échoué ou a été annulée.')
    let checkingGift = false
    let checkingFavor = false
    void (async () => {
      try {
        let revision = commandRevision.current
        let value = await api.getTwitchAccount(controller.signal)
        if (!active) return
        if (revision !== commandRevision.current) return
        setAccount(value)
        if (!value.linked && !presentationMode) { const next = await api.getTwitchLinkResolution(controller.signal); if (active) setResolution(next) }
        checkingFavor = Boolean(value.favorSubscriptionPending)
        checkingGift = Boolean(value.giftSupremePending)
        if (!presentationMode && awaitingSubscription(value)) {
          setRuntimeChecking(true)
          for (let attempt = 0; attempt < 4 && active && awaitingSubscription(value); attempt++) {
            await new Promise<void>(resolve => { cancelWait = resolve; timer = setTimeout(resolve, 1_000) })
            if (!active) return
            revision = commandRevision.current
            value = await api.getTwitchAccount(controller.signal)
            if (!active) return
            if (revision !== commandRevision.current) return
            setAccount(value)
            checkingFavor = Boolean(value.favorSubscriptionPending)
            checkingGift = Boolean(value.giftSupremePending)
          }
          if (active && awaitingSubscription(value)) setError(value.giftSupremePending ? 'L’activation Gift Suprême n’a pas pu être confirmée. Réessayez plus tard.' : value.favorSubscriptionPending ? 'La réception des abonnements Twitch n’a pas pu être confirmée. Réessayez plus tard.' : 'La réception du chat Twitch n’a pas pu être confirmée. Réessayez plus tard.')
        }
        if (active && !presentationMode && (value.runtimeChatError || value.favorSubscriptionError)) setError([value.runtimeChatError && runtimeStatusError(value.runtimeChatError), value.favorSubscriptionError && favorStatusError(value.favorSubscriptionError)].filter(Boolean).join(' '))
      } catch (reason) { if (active) setError(controller.signal.aborted ? checkingGift ? 'Le statut Gift Suprême n’a pas pu être confirmé. Réessayez plus tard.' : checkingFavor ? 'Le statut des abonnements Twitch n’a pas pu être confirmé. Réessayez plus tard.' : 'Le statut du chat Twitch n’a pas pu être confirmé. Réessayez plus tard.' : apiErrorMessage(reason)) }
      finally { clearTimeout(deadline); if (active) setRuntimeChecking(false) }
    })()
    return () => { active = false; controller.abort(); clearTimeout(deadline); clearTimeout(timer); cancelWait?.() }
  }, [api, presentationMode])
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
  const run = async (action: () => Promise<void>, allowDuringRuntimeCheck = false) => {
    if (pendingRef.current || applyingRef.current || runtimeChecking && !allowDuringRuntimeCheck) return
    pendingRef.current = true
    setPending(true); setError('')
    try { await action() } catch (reason) { if (reason && typeof reason === 'object' && 'code' in reason && ['TWITCH_RESOLUTION_EXPIRED','TWITCH_PROFILE_CHANGED'].includes(String(reason.code))) setResolution(null); setError(apiErrorMessage(reason)) }
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
  const resolve = (choice: 'WEB' | 'TWITCH') => void run(async () => {
    if (!resolution) return
    const next = await api.resolveTwitchLink(resolution.id, choice)
    if (next.resolutionRequired) { setResolution(next.resolution ?? null); setError('La progression a changé. Vérifie le nouveau résumé avant de confirmer.'); return }
    setResolution(null); setSuccess('Compte Twitch lié. Twitch et l’application web utilisent la même progression.')
    setAccount(await api.getTwitchAccount())
    try { await onRefreshPlayerState() } catch { setError('Liaison réussie. Recharge la page pour actualiser ta progression.') }
  })
  const activateRuntime = () => void run(async () => {
    const { url } = await api.startTwitchRuntime()
    const target = new URL(url)
    if (target.origin !== 'https://id.twitch.tv' || target.pathname !== '/oauth2/authorize' || target.username || target.password) throw new Error('URL Twitch invalide.')
    location.assign(target.toString())
  })
  const activateFavor = () => void run(async () => {
    const { url } = await api.startTwitchFavor()
    const target = new URL(url)
    if (target.origin !== 'https://id.twitch.tv' || target.pathname !== '/oauth2/authorize' || target.username || target.password) throw new Error('URL Twitch invalide.')
    location.assign(target.toString())
  })
  const activateGift = () => void run(async () => {
    const { url } = await api.startTwitchGiftSupreme()
    const target = new URL(url)
    if (target.origin !== 'https://id.twitch.tv' || target.pathname !== '/oauth2/authorize' || target.username || target.password) throw new Error('URL Twitch invalide.')
    location.assign(target.toString())
  })
  const refreshGift = async (poll = false) => {
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 8_000)
    try {
      let value = await api.getTwitchAccount(controller.signal)
      setAccount(value)
      for (let attempt = 0; poll && value.giftSupremePending && attempt < 4; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1_000))
        value = await api.getTwitchAccount(controller.signal)
        setAccount(value)
      }
      if (poll && value.giftSupremePending) setError('L’activation Gift Suprême n’a pas pu être confirmée. Réessayez plus tard.')
    } finally { clearTimeout(deadline) }
  }
  const retryGift = () => void run(async () => { await api.ensureTwitchGiftSupreme(); await refreshGift(true) })
  const disableGift = () => void run(async () => {
    try { await api.disableTwitchGiftSupreme() }
    catch (reason) { try { await refreshGift() } catch { /* Preserve the original cleanup error. */ } throw reason }
    await refreshGift()
  })
  const disableFavor = () => void run(async () => {
    await api.disableTwitchFavor()
    const value = await api.getTwitchAccount()
    setAccount(value)
    if (value.favorSubscriptionError) setError(favorStatusError(value.favorSubscriptionError))
  })
  const disableRuntime = () => void run(async () => {
    await api.disableTwitchRuntime()
    const value = await api.getTwitchAccount()
    setAccount(value)
    if (value.runtimeChatError) setError(runtimeStatusError(value.runtimeChatError))
  })
  const controlCommandPilot = (disarm: boolean) => void run(async () => {
    commandRevision.current++
    if (disarm) await api.disarmTwitchCommandPilot()
    else { if (!streamerbotAcknowledged) return; await api.armTwitchCommandPilot('STREAMERBOT_PATH_DISABLED') }
    setAccount(await api.getTwitchAccount())
  }, disarm)
  const confirmAction = () => {
    if (pendingRef.current || pending || applyingRef.current || runtimeChecking) return
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
  const commandArmed = Boolean(account?.commandPilotArmed || account?.commandPilotEnabled)
  const commandPilotControls = !presentationMode && account?.eligible && (account.commandPilotCapabilityEnabled || commandArmed) && <div className="account-twitch-runtime" aria-busy={pending}>
    <h4>Pilote commandes Twitch</h4>
    <p className={account.commandPilotEnabled ? 'account-twitch-active' : undefined}>{account.commandPilotEnabled ? '● Activé' : commandArmed ? 'Armé · inactif' : !account.runtimeChatActive ? 'Préparation requise' : 'Non activé'}</p>
    <p>{account.commandPilotCapabilityEnabled ? 'Disponible sur ce serveur.' : 'Indisponible sur ce serveur.'} Armement : {account.commandPilotArmed ? 'ON' : 'OFF'} · État effectif : {account.commandPilotEnabled ? 'ON' : 'OFF'}.</p>
    <p className="account-twitch-description">{account.runtimeChatActive ? 'La réception du chat Twitch est active. Le pilote s’active uniquement sur votre demande.' : commandArmed ? 'Le statut du chat Twitch est dégradé. Le pilote peut être désactivé.' : 'Autorisez d’abord la réception du chat Twitch.'}</p>
    {!commandArmed && <label><input type="checkbox" checked={streamerbotAcknowledged} disabled={pending || applying} onChange={event => setStreamerbotAcknowledged(event.target.checked)} /> J’ai désactivé les chemins Streamer.bot concernés.</label>}
    <AppButton disabled={pending || applying || !commandArmed && (!streamerbotAcknowledged || runtimeChecking || !account.commandPilotAvailable || !account.runtimeChatActive)} aria-busy={pending} onClick={() => controlCommandPilot(commandArmed)}>{commandArmed ? 'Désactiver le pilote commandes' : 'Activer le pilote commandes'}</AppButton>
  </div>
  return <ScrollableScreenPanel className="configuration-frame" fixed={<header className="menu-configuration-heading"><h2>Compte</h2></header>}>
    <div data-business-pending={pending} className="account-settings">
      {error && <p className="configuration-error" role="alert">{error}</p>}
      {!account ? <p data-tutorial-state={!error ? "loading" : undefined}>Chargement du compte…</p> : <section data-tutorial-anchor="account-player" className="account-section"><h3>Compte Twitch</h3>
        {account.linked ? <><p>Twitch et l’application web utilisent la même progression. Un changement de pseudo Twitch conserve cette liaison.</p><p><strong>{account.linked.displayName || account.linked.login}</strong> · Connecté</p><p>Lié le {new Date(account.linked.linkedAt).toLocaleDateString('fr-FR')}</p>
          {!presentationMode && account.eligible && account.runtimeSubscriptionAvailable && <div className="account-twitch-runtime" aria-busy={pending || runtimeChecking}>
            <h4>Réception du chat Twitch</h4>
            <p className={account.runtimeChatActive ? 'account-twitch-active' : undefined}>{runtimeChecking && account.runtimeChatPending ? 'Chargement du compte…' : account.runtimeChatActive ? '● Activée' : 'Non activée'}</p>
            <p className="account-twitch-description">{account.runtimeChatActive ? 'GachaImpact reçoit les messages du chat Twitch.' : 'Permet à GachaImpact de recevoir les messages du chat Twitch pendant le pilote.'}</p>
            <AppButton disabled={pending || runtimeChecking || account.runtimeChatPending} aria-busy={pending} onClick={account.runtimeChatActive ? disableRuntime : activateRuntime}>{account.runtimeChatActive ? 'Désactiver' : 'Autoriser et activer'}</AppButton>
          </div>}
          {commandPilotControls}
          {account.eligible && account.favorSubscriptionAvailable && <div className="account-twitch-runtime account-twitch-favor" aria-busy={pending || runtimeChecking}>
            <h4>Faveur de l’Astre</h4>
            <p className={account.favorSubscriptionActive ? 'account-twitch-active' : undefined}>{account.favorSubscriptionPending ? 'Vérification en cours…' : account.favorSubscriptionActive ? '● Activée' : 'Non activée'}</p>
            <p className="account-twitch-description">{account.favorSubscriptionActive ? 'GachaImpact reçoit les nouveaux abonnements Twitch pour la Faveur.' : 'Permet à GachaImpact de détecter les nouveaux abonnements Twitch et d’attribuer automatiquement la Faveur aux joueurs éligibles.'}</p>
            <AppButton disabled={pending || runtimeChecking || account.favorSubscriptionPending} aria-busy={pending} onClick={account.favorSubscriptionActive ? disableFavor : activateFavor}>{account.favorSubscriptionActive ? 'Désactiver' : 'Autoriser et activer'}</AppButton>
          </div>}
          {account.eligible && account.giftSupremeAvailable && <div className="account-twitch-runtime account-twitch-gift" aria-busy={pending || runtimeChecking}>
            <h4>Gift Suprême Twitch</h4>
            <p className={account.giftSupremeActive ? 'account-twitch-active' : undefined}>{account.giftSupremeDisabling ? 'Désactivation en cours…' : account.giftSupremePending ? 'Vérification en cours…' : account.giftSupremeActive ? '● Activé' : 'Non activé'}</p>
            <p className="account-twitch-description">Permet à GachaImpact de gérer automatiquement la récompense Twitch Gift Suprême.</p>
            {account.giftSupremeError && <p className="configuration-error" role="alert">{giftStatusError(account.giftSupremeError)}</p>}
            <AppButton disabled={pending || runtimeChecking || account.giftSupremePending} aria-busy={pending} onClick={account.giftSupremeDisabling || account.giftSupremeActive ? disableGift : account.giftSupremeAuthorized && account.giftSupremeError !== 'CREDENTIAL_INVALID' ? retryGift : activateGift}>{account.giftSupremeDisabling ? 'Réessayer la désactivation' : account.giftSupremeActive ? 'Désactiver' : account.giftSupremeAuthorized && account.giftSupremeError !== 'CREDENTIAL_INVALID' ? 'Réessayer' : 'Autoriser et activer'}</AppButton>
            {account.giftSupremeDisabling && account.giftSupremeAuthorized && <AppButton disabled={pending || runtimeChecking} onClick={retryGift}>Réactiver</AppButton>}
            {account.giftSupremeAuthorized && !account.giftSupremeActive && !account.giftSupremeDisabling && <AppButton disabled={pending || runtimeChecking} onClick={disableGift}>Désactiver</AppButton>}
          </div>}
</>
          : <><p>Non connecté</p>{!resolution && <AppButton disabled={!(account.identityLinkAvailable ?? account.pilotAvailable) || pending} onClick={connect}>Lier mon compte Twitch</AppButton>}{!(account.identityLinkAvailable ?? account.pilotAvailable) && <p>La liaison Twitch est indisponible pour ce compte ou sur ce serveur.</p>}{commandPilotControls}</>}
        {!presentationMode && resolution && <TwitchProgressionChoice key={JSON.stringify(resolution)} resolution={resolution} pending={pending} onChoose={resolve} />}
      </section>}
      {!presentationMode && account?.snapshotAvailable && <section className="account-section"><h3>Snapshot Streamer.bot</h3><p>Le standalone est un miroir de test. Sélectionnez les fichiers locaux ; ils ne seront pas modifiés.</p>
        <div className="account-actions"><label>Choisir le dossier Data<input ref={folderRef} type="file" multiple accept=".json" disabled={pending} onChange={event => void select(event.target.files)} /></label><label>Ou choisir 17 fichiers JSON<input type="file" multiple accept=".json" disabled={pending} onChange={event => void select(event.target.files)} /></label></div>
        {files && <><p>17 fichiers sélectionnés.</p><button type="button" disabled={pending} onClick={() => void run(async () => { setPreview(await api.previewTwitchSnapshot(files)); setResult(null) })}>Prévisualiser le snapshot</button></>}
        {preview && <div className="account-preview"><p>Snapshot : <code>{preview.snapshotHash}</code></p><p>Viewer Kichnifou trouvé · {preview.files} fichiers reconnus</p><div className="account-domain-list">{preview.domains.map(domain => <article key={domain.name}><strong>{domain.name}</strong><span>{domain.action}</span><small>Catégorie : {domain.category}</small><small>Actuel : {domain.current}</small><small>Snapshot : {domain.snapshot}</small>{domain.reason && <small>Raison : {domain.reason}</small>}{domain.anomalies.map(message => <small key={message}>{message}</small>)}</article>)}</div><p className="account-warning">{preview.warning}</p><button type="button" disabled={pending || preview.domains.some(domain => domain.category === 'BLOCKED_AMBIGUOUS' || (domain.category === 'PLAYER_LOCAL_PHYSICAL' && domain.action === 'PENDING_MAPPING'))} onClick={event => { openerRef.current = event.currentTarget; setConfirm('apply') }}>{account.lastImport ? 'Confirmer le rafraîchissement' : 'Confirmer l’import'}</button></div>}
        {result && <p role="status">{result.replayed ? 'Snapshot déjà importé.' : 'Import terminé.'} Domaines importés : {result.imported.join(', ')}. Domaines différés : {result.deferred.length}.</p>}
        {account.lastImport && <p>Dernier import : {new Date(account.lastImport.at).toLocaleString('fr-FR')}</p>}
      </section>}
    </div>
    {success && <p className="account-link-success" role="status">{success}</p>}
    {confirm && <div className="account-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !applyingRef.current) setConfirm(null) }}><div ref={dialogRef} className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="account-confirm-title" aria-busy={applying}><h3 id="account-confirm-title">Confirmer le rafraîchissement ?</h3><p>{preview?.warning}</p>{applying && <p className="account-apply-progress" role="status"><span className="account-apply-spinner" aria-hidden="true" />{account?.lastImport ? 'Rafraîchissement en cours…' : 'Import en cours…'}</p>}<div><button type="button" disabled={applying} onClick={() => setConfirm(null)}>Annuler</button><button ref={confirmRef} type="button" disabled={pending} onClick={confirmAction}>{applying ? account?.lastImport ? 'Rafraîchissement en cours…' : 'Import en cours…' : 'Confirmer'}</button></div></div></div>}
  </ScrollableScreenPanel>
}
