import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CODE_LENGTH, errorMessage, isValidCode, joinParty, normalizeCode, setActivePartyId } from '../lib'
import { clearReturnTo } from './returnTo'
import '../styles/ui.css'
import './JoinPage.css'

/** Rejoindre une party avec son code ; /rejoindre/:code = lien d'invitation (code pré-rempli). */
export function JoinPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(() => normalizeCode(params.code ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fromLink = !!params.code

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = normalizeCode(code)
    if (!isValidCode(clean)) {
      setError(`Le code fait ${CODE_LENGTH} caractères (lettres et chiffres). Vérifie-le auprès de l'organisateur.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const partyId = await joinParty(clean)
      clearReturnTo()
      setActivePartyId(partyId)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="page join">
      <header className="stack">
        <h1>Rejoindre une party</h1>
        <p>
          {fromLink
            ? 'Un ami t\'a invité. Vérifie le code et rejoins sa party.'
            : "Entre le code que l'organisateur de la party t'a envoyé."}
        </p>
      </header>

      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="join-code">
            Code d'invitation
          </label>
          <input
            id="join-code"
            className="input input--code"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={CODE_LENGTH + 4}
            aria-invalid={!!error}
            aria-describedby="join-code-hint"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <p id="join-code-hint" className="field__hint">
            {CODE_LENGTH} caractères, par exemple K7QMZ3.
          </p>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button button--action button--block" disabled={busy} aria-busy={busy}>
          {busy ? 'Un instant…' : 'Rejoindre la party'}
        </button>
      </form>

      <p>
        <Link to="/parties" className="link-button">
          Voir mes parties
        </Link>
      </p>
    </main>
  )
}
