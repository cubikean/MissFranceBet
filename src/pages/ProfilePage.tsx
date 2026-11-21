import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { EmojiPicker } from '../components/EmojiPicker'
import { Sash } from '../components/Sash'
import { TROPHY_EMOJI, TROPHY_LABEL } from '../components/display'
import {
  errorMessage,
  getCandidate,
  normalizeUsername,
  signOut,
  updateProfile,
  USERNAME_MAX,
  usernameError,
  useMyTrophies,
  useProfile,
  type UserProfile,
} from '../lib'
import '../styles/ui.css'
import './ProfilePage.css'

export function ProfilePage() {
  const profile = useProfile().data
  const trophies = useMyTrophies()
  const [signingOut, setSigningOut] = useState(false)

  if (!profile) {
    return (
      <p className="page muted" role="status">
        Chargement…
      </p>
    )
  }

  const counts = { gold: 0, silver: 0, bronze: 0 }
  for (const t of trophies.data) counts[t.trophy] += 1

  return (
    <section className="page profile stack stack--lg" aria-labelledby="profile-title">
      <header className="profile__header">
        <span className="profile__avatar" aria-hidden="true">
          {profile.emoji}
        </span>
        <h1 id="profile-title">{profile.displayName}</h1>
      </header>

      <section className="stack" aria-labelledby="profile-trophies">
        <h2 id="profile-trophies" className="section-title">
          Mes trophées
        </h2>
        {trophies.loading ? (
          <p className="muted" role="status">
            Chargement…
          </p>
        ) : trophies.error ? (
          <p className="form-error" role="alert">
            {errorMessage(trophies.error)}
          </p>
        ) : trophies.data.length === 0 ? (
          <p className="muted">Pas encore de trophée. Choisis la bonne Miss et il apparaîtra ici, d'année en année.</p>
        ) : (
          <>
            <p className="profile__counts">
              {(['gold', 'silver', 'bronze'] as const)
                .filter((t) => counts[t] > 0)
                .map((t) => (
                  <span key={t}>
                    {TROPHY_EMOJI[t]} × {counts[t]}
                  </span>
                ))}
            </p>
            <ul className="profile__trophies">
              {trophies.data.map((t) => {
                const c = getCandidate(t.party.editionId, t.candidateId)
                return (
                  <li key={t.party.id} className="card profile__trophy">
                    <span className="profile__trophy-emoji" aria-hidden="true">
                      {TROPHY_EMOJI[t.trophy]}
                    </span>
                    <div className="profile__trophy-body">
                      <p>
                        <strong>{t.edition?.title ?? `Édition ${t.party.editionId}`}</strong>, {t.party.name}
                      </p>
                      <p className="muted">
                        {TROPHY_LABEL[t.trophy]}
                        <span className="visually-hidden"> ({TROPHY_EMOJI[t.trophy]})</span>
                      </p>
                      {c && <Sash region={c.region} size="sm" variant={t.trophy === 'gold' ? 'winner' : 'default'} />}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <ProfileForm profile={profile} />

      <section className="stack" aria-labelledby="profile-account">
        <h2 id="profile-account" className="section-title">
          Mon compte
        </h2>
        <Link to="/parties" className="button button--ghost profile__button">
          Mes parties
        </Link>
        <button
          type="button"
          className="button button--ghost profile__button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true)
            void signOut().finally(() => setSigningOut(false))
          }}
        >
          Me déconnecter
        </button>
      </section>
    </section>
  )
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const [name, setName] = useState(profile.displayName)
  const [emoji, setEmoji] = useState(profile.emoji)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const invalid = usernameError(name)
  const changed = normalizeUsername(name) !== profile.displayName || emoji !== profile.emoji

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await updateProfile(profile, { displayName: name, emoji })
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={(e) => void submit(e)} noValidate aria-labelledby="profile-edit">
      <h2 id="profile-edit" className="section-title">
        Modifier mon profil
      </h2>
      <div className="field">
        <label className="field__label" htmlFor="profile-name">
          Pseudo
        </label>
        <input
          id="profile-name"
          className="input"
          autoComplete="nickname"
          maxLength={USERNAME_MAX + 5}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
        />
      </div>
      <EmojiPicker
        value={emoji}
        onChange={(v) => {
          setEmoji(v)
          setSaved(false)
        }}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="form-ok" role="status">
        {saved ? 'Profil enregistré' : ''}
      </p>
      <button type="submit" className="button profile__button" disabled={busy || !changed} aria-busy={busy}>
        {busy ? 'Un instant…' : 'Enregistrer'}
      </button>
    </form>
  )
}
