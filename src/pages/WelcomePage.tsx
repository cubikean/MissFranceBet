import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { PhotoPicker } from '../components/PhotoPicker'
import { claimUsername, errorMessage, USERNAME_MAX, usernameError, useProfile } from '../lib'
import '../styles/ui.css'
import './WelcomePage.css'

function fromState(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from
  // '/' n'est pas une vraie destination : après l'onboarding, on propose d'abord les parties.
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/' ? from : null
}

/** Onboarding (une seule fois) : pseudo unique + photo facultative. */
export function WelcomePage() {
  const profile = useProfile()
  const location = useLocation()
  const navigate = useNavigate()
  const from = fromState(location.state)
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (profile.loading) {
    return (
      <p className="page muted" role="status">
        Chargement…
      </p>
    )
  }
  // Profil déjà créé (retour arrière, rechargement) : on file vers la suite.
  if (profile.data && !busy) return <Navigate to={from ?? '/'} replace />

  const invalid = usernameError(name)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (invalid) return
    setBusy(true)
    setError(null)
    try {
      await claimUsername(name, photo)
      navigate(from ?? '/parties', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="page welcome">
      <header className="stack">
        <h1>Bienvenue</h1>
        <p>Choisis ton pseudo, et si tu veux une photo&nbsp;: c'est comme ça que tes amis te verront dans la party.</p>
      </header>

      <form className="stack stack--lg" onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="welcome-name">
            Ton pseudo
          </label>
          <input
            id="welcome-name"
            className="input"
            autoComplete="nickname"
            maxLength={USERNAME_MAX + 5}
            aria-invalid={touched && !!invalid}
            aria-describedby="welcome-name-hint"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          <p id="welcome-name-hint" className={touched && invalid ? 'form-error' : 'field__hint'}>
            {touched && invalid ? invalid : `Entre 2 et ${USERNAME_MAX} caractères. Il doit être unique.`}
          </p>
        </div>

        <PhotoPicker value={photo} name={name} onChange={setPhoto} disabled={busy} />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button button--block" disabled={busy} aria-busy={busy}>
          {busy ? 'Un instant…' : "C'est parti"}
        </button>
      </form>
    </main>
  )
}
