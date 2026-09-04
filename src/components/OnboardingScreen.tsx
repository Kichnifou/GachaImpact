import { useState, type FormEvent } from 'react'

type OnboardingScreenProps = {
  onSubmit: (displayName: string) => Promise<void>
}

function OnboardingScreen({ onSubmit }: OnboardingScreenProps) {
  const [displayName, setDisplayName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedName = displayName.trim()

    if (normalizedName.length < 1 || normalizedName.length > 40) {
      setErrorMessage('Le pseudo doit contenir entre 1 et 40 caractères.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await onSubmit(normalizedName)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de créer votre profil.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="entry-shell">
      <section className="entry-panel compact panel" aria-labelledby="onboarding-title">
        <span className="entry-step">Première connexion</span>
        <h1 id="onboarding-title">Choisis ton pseudo</h1>
        <p>Ce nom représentera ton profil GachaImpact.</p>
        <form className="entry-form" onSubmit={submit}>
          <label htmlFor="display-name">Pseudo</label>
          <input id="display-name" type="text" autoComplete="nickname" maxLength={40} required autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          {errorMessage && <p className="form-feedback error" role="alert">{errorMessage}</p>}
          <button type="submit" className="entry-primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Création…' : 'Continuer'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default OnboardingScreen
