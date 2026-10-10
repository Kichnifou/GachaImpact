import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { loadFrontendConfig } from '../../config/environment'

let singleton: SupabaseClient | undefined
let recoverySingleton: SupabaseClient | undefined

export function getRecoveryClient(): SupabaseClient {
  if (!recoverySingleton) {
    const config = loadFrontendConfig()
    recoverySingleton = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { storageKey: 'gachaimpact-password-recovery', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return recoverySingleton
}

export function getSupabaseClient(): SupabaseClient {
  if (!singleton) {
    const config = loadFrontendConfig()
    singleton = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return singleton
}
