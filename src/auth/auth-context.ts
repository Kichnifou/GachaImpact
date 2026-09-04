import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'configurationError'

export type SignUpResult = Readonly<{
  confirmationRequired: boolean
}>

export type AuthContextValue = Readonly<{
  status: AuthStatus
  session: Session | null
  configurationMessage: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}>

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
