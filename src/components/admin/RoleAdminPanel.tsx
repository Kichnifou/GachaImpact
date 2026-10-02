import { useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { ModerationStateDto } from '../../api/types'
import { AdminFeedback, ConfirmAction, useAdminTask } from './AdminUi'

const roles = ['TESTER', 'MODERATOR', 'ADMIN'] as const
const labels = { TESTER: 'Testeur', MODERATOR: 'Modérateur', ADMIN: 'Administrateur' }
type RoleIntent = Readonly<{ playerId: string; playerDisplayName: string; role: typeof roles[number]; enabled: boolean }>

export default function RoleAdminPanel({ state, onChanged }: { state: ModerationStateDto; onChanged: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState<RoleIntent | null>(null)
  const task = useAdminTask(() => { void onChanged() })
  const assigned = state.player.roles ?? []
  const change = (role: typeof roles[number], enabled: boolean) => {
    const intent = { playerId: state.player.id, playerDisplayName: state.player.displayName, role, enabled }
    if (role !== 'TESTER') { setConfirmation(intent); return }
    void apply(intent)
  }
  const apply = async (intent: RoleIntent) => {
    const success = await task.execute(JSON.stringify(intent), key => getGameApiClient().setAdminRole(intent.playerId, intent.role, intent.enabled, key))
    if (success) setConfirmation(null)
  }
  return <section className="panel moderation-tool moderation-role" aria-label="Rôles du joueur ciblé" aria-busy={task.pending}>
    <h2 className="admin-role-title">Rôles · {state.player.displayName}</h2>
    <AdminFeedback error={task.error} notice={task.notice} />
    <div className="admin-role-list">{roles.map(role => {
      const active = assigned.includes(role)
      return <div key={role}><span>{labels[role]} <span className={`admin-role-status${active ? ' active' : ''}`} role="img" aria-label={active ? 'Actif' : 'Inactif'}>{active ? '✓' : '○'}</span></span>
        <button type="button" aria-label={`${active ? 'Retirer' : 'Attribuer'} le rôle ${labels[role]}`} disabled={task.pending} onClick={() => change(role, !active)}>{active ? 'Retirer' : 'Attribuer'}</button></div>
    })}</div>
    {confirmation && <ConfirmAction title={`${confirmation.enabled ? 'Attribuer' : 'Retirer'} le rôle ${labels[confirmation.role]} à ${confirmation.playerDisplayName} ?`}
      pending={task.pending} onCancel={() => setConfirmation(null)} onConfirm={() => void apply(confirmation)}>
      Ce changement de droits pour {confirmation.playerDisplayName} est immédiat et sera inscrit au journal. Le dernier administrateur actif ne peut pas être retiré.
    </ConfirmAction>}
  </section>
}
