export type FrontendConfig = Readonly<{
  supabaseUrl: string
  supabasePublishableKey: string
  apiBaseUrl: string
}>

type FrontendEnvironment = Readonly<
  Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_API_BASE_URL', string>>
>

export class FrontendConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FrontendConfigurationError'
  }
}

export function loadFrontendConfig(
  environment: FrontendEnvironment = import.meta.env as unknown as FrontendEnvironment,
): FrontendConfig {
  const supabaseUrl = requiredUrl(environment.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL')
  const apiBaseUrl = requiredUrl(environment.VITE_API_BASE_URL, 'VITE_API_BASE_URL')
  const supabasePublishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabasePublishableKey) {
    throw new FrontendConfigurationError('VITE_SUPABASE_PUBLISHABLE_KEY est manquante.')
  }

  return {
    supabaseUrl: stripTrailingSlash(supabaseUrl),
    supabasePublishableKey,
    apiBaseUrl: stripTrailingSlash(apiBaseUrl),
  }
}

function requiredUrl(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new FrontendConfigurationError(`${name} est manquante.`)
  }

  try {
    return new URL(value).toString()
  } catch {
    throw new FrontendConfigurationError(`${name} doit contenir une URL valide.`)
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}
