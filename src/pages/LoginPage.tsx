import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Sash } from '../components/Sash'
import {
  errorMessage,
  isInAppBrowser,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  useAuth,
} from '../lib'
import { clearReturnTo, readReturnTo } from './returnTo'
import '../styles/ui.css'
import './LoginPage.css'

type Mode = 'signin' | 'signup' | 'reset'

const TITLES: Record<Mode, string> = {
  signin: 'Connecte-toi',
  signup: 'Crée ton compte',
  reset: 'Mot de passe oublié',
}

export function LoginPage() {
  const { user, loading, error: redirectError } = useAuth()
  const location = useLocation()
  const [returnTo] = useState(() => readReturnTo(location.state))
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  // Lien ouvert depuis Instagram, Messenger ou Facebook : Google y refuse la connexion.
  const [inApp] = useState(() => isInAppBrowser(navigator.userAgent))

  if (loading) {
    return (
      <p className="page muted" role="status">
        Chargement…
      </p>
    )
  }
  // Connecté : RequireProfile enverra vers /bienvenue si le pseudo manque, en gardant la destination.
  if (user) {
    clearReturnTo() // idempotent : la destination est connue, on l'oublie pour la suite
    return <Navigate to={returnTo ?? '/'} replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'reset') {
      void run(async () => {
        await resetPassword(email)
        setInfo(`Si un compte existe pour ${email.trim()}, tu vas recevoir un email pour choisir un nouveau mot de passe. Pense à regarder dans les spams.`)
      })
    } else {
      void run(() => (mode === 'signup' ? signUpWithEmail(email, password) : signInWithEmail(email, password)))
    }
  }

  const shownError = error ?? (redirectError ? errorMessage(redirectError) : null)

  return (
    <main className="page login">
      <header className="login__header">
        <h1 className="login__brand">Pronos Miss</h1>
        <Sash region="Entre amis" size="lg" />
        <p>Choisis la Miss que tu vois gagner, et compare tes pronos avec ceux de tes amis le soir de l'émission.</p>
      </header>

      <section className="card login__card" aria-labelledby="login-title">
        <h2 id="login-title">{TITLES[mode]}</h2>

        {inApp && mode !== 'reset' && (
          <p className="login__inapp" role="note">
            Google refuse la connexion dans le navigateur d'Instagram, de Messenger ou de Facebook. Ouvre ce lien
            dans Safari ou Chrome, ou connecte-toi par email.
          </p>
        )}

        {mode !== 'reset' && (
          <>
            <button
              type="button"
              className="button button--ghost button--block"
              disabled={busy}
              onClick={() => void run(signInWithGoogle)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9z" />
                <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
              </svg>
              Continuer avec Google
            </button>
            <p className="login__or" aria-hidden="true">
              ou avec ton email
            </p>
          </>
        )}

        <form className="stack" onSubmit={submit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {mode !== 'reset' && (
            <div className="field">
              <label className="field__label" htmlFor="login-password">
                Mot de passe
              </label>
              <input
                id="login-password"
                className="input"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                aria-describedby={mode === 'signup' ? 'login-password-hint' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'signup' && (
                <p id="login-password-hint" className="field__hint">
                  6 caractères minimum.
                </p>
              )}
            </div>
          )}

          {shownError && (
            <p className="form-error" role="alert">
              {shownError}
            </p>
          )}
          {info && (
            <p className="form-ok" role="status">
              {info}
            </p>
          )}

          <button type="submit" className="button button--block" disabled={busy} aria-busy={busy}>
            {busy
              ? 'Un instant…'
              : mode === 'signup'
                ? 'Créer mon compte'
                : mode === 'reset'
                  ? 'Recevoir le lien'
                  : 'Me connecter'}
          </button>
        </form>

        <div className="login__switch">
          {mode === 'signin' && (
            <>
              <button type="button" className="link-button" onClick={() => switchMode('reset')}>
                Mot de passe oublié&nbsp;?
              </button>
              <button type="button" className="link-button" onClick={() => switchMode('signup')}>
                Pas encore de compte&nbsp;? Crée-le
              </button>
            </>
          )}
          {mode !== 'signin' && (
            <button type="button" className="link-button" onClick={() => switchMode('signin')}>
              {mode === 'signup' ? "J'ai déjà un compte" : 'Revenir à la connexion'}
            </button>
          )}
        </div>
      </section>

      {returnTo?.startsWith('/rejoindre') && (
        <p className="muted">Une fois connecté, tu arriveras directement sur la party de tes amis.</p>
      )}
    </main>
  )
}
