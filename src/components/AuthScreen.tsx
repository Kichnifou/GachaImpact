import { useState, type FormEvent } from 'react'

import { useAuth } from '../auth/auth-context'

type AuthMode = 'login' | 'register'

function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setMessage(null)
    setErrorMessage(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setErrorMessage(null)

    if (mode === 'register' && password !== passwordConfirmation) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        const result = await signUp(email.trim(), password)
        if (result.confirmationRequired) {
          setMessage('Compte créé. Consultez votre e-mail pour confirmer votre inscription.')
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'L’authentification a échoué.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="entry-shell">
      <section className="entry-panel panel" aria-labelledby="auth-title">
        <div className="entry-brand" aria-hidden="true"><span>✦</span></div>
        <p className="eyebrow">Chroniques astrales</p>
        <h1 id="auth-title">Gacha<span>Impact</span></h1>

        <div className="auth-tabs" role="tablist" aria-label="Authentification">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Se connecter</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Créer un compte</button>
        </div>

        <form className="entry-form" onSubmit={submit}>
          <label htmlFor="auth-email">Adresse e-mail</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />

          <label htmlFor="auth-password">Mot de passe</label>
          <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />

          {mode === 'register' && (
            <>
              <label htmlFor="auth-password-confirmation">Confirmer le mot de passe</label>
              <input id="auth-password-confirmation" type="password" autoComplete="new-password" required minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />
            </>
          )}

          {errorMessage && <p className="form-feedback error" role="alert">{errorMessage}</p>}
          {message && <p className="form-feedback success" role="status">{message}</p>}

          <button type="submit" className="entry-primary-button" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'login' ? 'Connexion…' : 'Création…'
              : mode === 'login' ? 'Entrer dans le jeu' : 'Créer mon compte'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AuthScreen
