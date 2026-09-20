import { useEffect, useRef, useState } from 'react'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { privacyLabels, type PrivacyCategory, type PrivacyLevel, type PrivacySettings, type SocialActions } from '../social/types'
import { apiErrorMessage } from '../utils/formatters'

export default function PrivacySettingsPanel({ actions }: { actions: SocialActions }) {
  const [value, setValue] = useState<PrivacySettings | null>(null), [pending, setPending] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const alive = useRef(false), mutation = useRef(false)
  useEffect(() => { alive.current = true; void actions.privacy().then(v => { if (alive.current) setValue(v) }).catch(e => { if (alive.current) setError(apiErrorMessage(e)) }); return () => { alive.current = false } }, [actions])
  const save = async (category: PrivacyCategory, level: PrivacyLevel) => {
    if (mutation.current) return
    mutation.current = true; setPending(true); setError(''); setSaved(false)
    try { const next = await actions.savePrivacy(category, level); if (alive.current) { setValue(next); setSaved(true) } }
    catch (reason) { if (alive.current) setError(apiErrorMessage(reason)) }
    finally { mutation.current = false; if (alive.current) setPending(false) }
  }
  return <ScrollableScreenPanel className="configuration-frame" fixed={<div><h2>Confidentialité</h2><p>Votre pseudo, avatar, niveau et élément restent visibles.</p><div className="privacy-feedback" role="status">{pending ? 'Enregistrement…' : saved ? 'Préférences enregistrées.' : ''}</div>{error && <p role="alert">{error}</p>}</div>}>
    {!value && !error ? <p>Chargement…</p> : <div className="privacy-settings">{value?.settings.map(setting => <label key={setting.categoryKey}><span>{privacyLabels[setting.categoryKey]}</span><select aria-label={privacyLabels[setting.categoryKey]} value={setting.level} disabled={pending} onChange={e => void save(setting.categoryKey, e.target.value as PrivacyLevel)}><option value="PUBLIC">Public</option><option value="FRIENDS">Amis uniquement</option><option value="PRIVATE">Privé</option></select></label>)}</div>}
  </ScrollableScreenPanel>
}
