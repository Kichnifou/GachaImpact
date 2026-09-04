import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { loadFrontendConfig } from '../../config/environment'

let singleton: SupabaseClient | undefined

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
