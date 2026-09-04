import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { FrontendConfigurationError } from '../config/environment'
import { getSupabaseClient } from '../infrastructure/supabase/client'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [configurationMessage, setConfigurationMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    try {
      const client = getSupabaseClient()
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return
        setSession(nextSession)
        setStatus(nextSession ? 'signedIn' : 'signedOut')
      })

      void client.auth.getSession().then(({ data: sessionData, error }) => {
        if (!active) return
        if (error) {
          setSession(null)
          setStatus('signedOut')
          return
        }

        setSession(sessionData.session)
        setStatus(sessionData.session ? 'signedIn' : 'signedOut')
      })

      return () => {
        active = false
        data.subscription.unsubscribe()
      }
    } catch (error) {
      const message =
        error instanceof FrontendConfigurationError
          ? error.message
          : 'La configuration Supabase du frontend est invalide.'
      queueMicrotask(() => {
        if (!active) return
        setConfigurationMessage(message)
        setStatus('configurationError')
      })
    }

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
    if (error) throw new Error(authErrorMessage(error.code))
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signUp({ email, password })
    if (error) throw new Error(authErrorMessage(error.code))
    return { confirmationRequired: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await getSupabaseClient().auth.signOut()
    if (error) throw new Error('La déconnexion n’a pas pu aboutir.')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, configurationMessage, signIn, signUp, signOut }),
    [configurationMessage, session, signIn, signOut, signUp, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'invalid_credentials':
      return 'E-mail ou mot de passe incorrect.'
    case 'email_exists':
    case 'user_already_exists':
      return 'Un compte utilise déjà cette adresse e-mail.'
    case 'weak_password':
      return 'Le mot de passe choisi n’est pas assez sécurisé.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Trop de tentatives. Réessayez dans quelques instants.'
    default:
      return 'L’authentification n’a pas pu aboutir. Vérifiez vos informations.'
  }
}
