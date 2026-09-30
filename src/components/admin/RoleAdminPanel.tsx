import { useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { ModerationStateDto } from '../../api/types'
import { AdminFeedback, ConfirmAction, useAdminTask } from './AdminUi'

const roles = ['TESTER', 'MODERATOR', 'ADMIN'] as const
const labels = { TESTER: 'Testeur', MODERATOR: 'Modérateur', ADMIN: 'Administrateur' }

export default function RoleAdminPanel({ state, onChanged }: { state: ModerationStateDto; onChanged: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState<{ role: typeof roles[number]; enabled: boolean } | null>(null)
  const task = useAdminTask(() => { void onChanged() })
  const assigned = state.player.roles ?? []
  const change = (role: typeof roles[number], enabled: boolean) => {
    if (role !== 'TESTER') { setConfirmation({ role, enabled }); return }
    void apply(role, enabled)
  }
  const apply = async (role: typeof roles[number], enabled: boolean) => {
    setConfirmation(null)
    await task.execute(JSON.stringify({ playerId: state.player.id, role, enabled }), key => getGameApiClient().setAdminRole(state.player.id, role, enabled, key))
  }
  return <section className="panel moderation-tool moderation-role" aria-label="Rôles du joueur ciblé" aria-busy={task.pending}>
    <h2>Rôles</h2><p>Rôles actifs de {state.player.displayName}</p>
    <AdminFeedback error={task.error} notice={task.notice} />
    <div className="admin-role-list">{roles.map(role => {
      const active = assigned.includes(role)
      return <div key={role}><span>{labels[role]} · {active ? 'actif' : 'absent'}</span>
        <button type="button" disabled={task.pending} onClick={() => change(role, !active)}>{active ? 'Retirer' : 'Attribuer'}</button></div>
    })}</div>
    {confirmation && <ConfirmAction title={`${confirmation.enabled ? 'Attribuer' : 'Retirer'} le rôle ${labels[confirmation.role]} ?`}
      pending={task.pending} onCancel={() => setConfirmation(null)} onConfirm={() => void apply(confirmation.role, confirmation.enabled)}>
      Ce changement de droits est immédiat et sera inscrit au journal. Le dernier administrateur actif ne peut pas être retiré.
    </ConfirmAction>}
  </section>
}
