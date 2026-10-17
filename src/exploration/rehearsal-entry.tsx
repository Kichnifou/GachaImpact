// Local rehearsal entry only. The normal application never imports this module.
import { createRoot } from 'react-dom/client'
import type { Session } from '@supabase/supabase-js'
import GameShell from '../components/GameShell'
import { AuthContext, type AuthContextValue } from '../auth/auth-context'
import { createGameApiClient } from '../api/game-api'
import type { PlayerDto, PlayerResourcesDto } from '../api/types'
import { createRehearsalShellProps } from './rehearsal-shell-fixture'
import '../index.css'
import '../App.css'

type Bootstrap = { player: PlayerDto; subject: string; token: string; apiBaseUrl: string; resources: PlayerResourcesDto }
const profile = new URLSearchParams(location.search).get('profile') ?? 'normal'
const response = await fetch(`/__rehearsal/bootstrap?profile=${encodeURIComponent(profile)}`, { cache: 'no-store' })
if (!response.ok) throw Error('La recette locale est indisponible. Relancez exploration:rehearse depuis server/.')
const bootstrap = await response.json() as Bootstrap
if (new URL(bootstrap.apiBaseUrl).hostname !== '127.0.0.1' || location.hostname !== '127.0.0.1') throw Error('Local rehearsal origin required')
const client = createGameApiClient({ baseUrl: bootstrap.apiBaseUrl, getAccessToken: async () => bootstrap.token })
const props = createRehearsalShellProps(), root = createRoot(document.getElementById('root')!)
props.player = bootstrap.player
props.resources = bootstrap.resources
props.explorationApi = { overview: () => client.getExploration(), act: input => client.actExploration(input), presence: (id, input) => client.explorationPresence(id, input) }
props.tutorialApi = { get: async () => ({ version: 1, status: 'COMPLETED', stepId: null }), put: async value => value }
props.sharedInvocationApi = {
  state: async () => ({ broadcasting: null, watching: null }), availableCount: async () => ({ count: 0 }), list: async () => ({ sessions: [] }),
  start: async () => { throw Error('Seule Exploration est connectée dans cette recette') },
  watch: async () => { throw Error('Seule Exploration est connectée dans cette recette') },
  control: async () => { throw Error('Seule Exploration est connectée dans cette recette') },
  resume: async () => { throw Error('Seule Exploration est connectée dans cette recette') },
  react: async () => { throw Error('Seule Exploration est connectée dans cette recette') },
}
props.onRefreshPlayerState = async () => {
  const result = await fetch(`${bootstrap.apiBaseUrl}/__rehearsal/resources`, { headers: { Authorization: `Bearer ${bootstrap.token}` }, cache: 'no-store' })
  if (!result.ok) throw Error('Ressources de recette indisponibles')
  props.resources = await result.json() as PlayerResourcesDto
  render()
}
props.onRefreshResources = props.onRefreshPlayerState
const session: Session = { access_token: bootstrap.token, refresh_token: 'local-rehearsal', expires_in: 3600, token_type: 'bearer', user: {
  id: bootstrap.subject, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date(0).toISOString(),
} }
const auth: AuthContextValue = { status: 'signedIn', session, configurationMessage: null,
  signIn: async () => { throw Error('Authentification de recette locale uniquement') }, signUp: async () => ({ confirmationRequired: false }), signOut: async () => { location.reload() },
}
function render() { root.render(<AuthContext value={auth}><GameShell {...props} /></AuthContext>) }
document.title = `Exploration — recette privée (${profile})`
render()
