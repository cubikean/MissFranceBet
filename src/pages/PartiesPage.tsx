import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InviteShare } from '../components/InviteShare'
import { Sash } from '../components/Sash'
import { PHASE_LABEL, sashVariant, statusLabel, TROPHY_EMOJI, TROPHY_LABEL } from '../components/display'
import {
  candidateStatus,
  CODE_LENGTH,
  codeError,
  createParty,
  currentEdition,
  errorMessage,
  getCandidate,
  getEdition,
  joinParty,
  leaveParty,
  missLabel,
  normalizeCode,
  PARTY_NAME_MAX,
  PARTY_NAME_MIN,
  prefersReducedMotion,
  setActivePartyId,
  trophyFor,
  useActiveParty,
  useAuth,
  useMyParties,
  useMyPick,
  useResults,
  type Party,
} from '../lib'
import '../styles/ui.css'
import './PartiesPage.css'

/** Mes parties : choisir la party active, en créer une, en rejoindre une, en quitter une. */
export function PartiesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const edition = currentEdition()
  const parties = useMyParties()
  const active = useActiveParty().data
  const [leaving, setLeaving] = useState<Party | null>(null)
  const [created, setCreated] = useState<{ partyId: string; code: string; name: string } | null>(null)

  const current = parties.data.filter((p) => p.editionId === edition?.id)
  const past = parties.data.filter((p) => p.editionId !== edition?.id)

  function choose(party: Party) {
    setActivePartyId(party.id)
    navigate('/')
  }

  return (
    <section className="page parties stack stack--lg" aria-labelledby="parties-title">
      <header className="stack">
        <h1 id="parties-title">Mes parties</h1>
        <p>Une party, c'est ton groupe d'amis pour {edition?.title ?? "l'édition en cours"}. Tu as un prono par party.</p>
      </header>

      {created && (
        <div className="card parties__created">
          <h2 className="section-title">«&nbsp;{created.name}&nbsp;» est créée</h2>
          <p>Envoie le lien à tes amis&nbsp;: avec lui, ils rejoignent ta party en un geste.</p>
          <InviteShare code={created.code} partyName={created.name} />
          <Link to="/" className="button">
            Aller à l'accueil
          </Link>
        </div>
      )}

      <section className="stack" aria-labelledby="parties-current">
        <h2 id="parties-current" className="section-title">
          {edition?.title ?? 'Cette année'}
        </h2>
        {parties.loading ? (
          <p className="muted" role="status">
            Chargement…
          </p>
        ) : parties.error ? (
          <p className="form-error" role="alert">
            {errorMessage(parties.error)}
          </p>
        ) : current.length === 0 ? (
          <p className="muted">Tu n'as pas encore de party cette année. Crée la tienne ou rejoins celle de tes amis.</p>
        ) : (
          <ul className="parties__list">
            {current.map((party) => {
              const isActive = party.id === active?.id
              const isOwner = party.ownerUid === user?.uid
              return (
                <li key={party.id} className={`card parties__item${isActive ? ' parties__item--active' : ''}`}>
                  <div className="parties__head">
                    <h3 className="parties__name">{party.name}</h3>
                    {isActive && <span className="parties__tag">Active</span>}
                  </div>
                  <p className="muted">
                    {PHASE_LABEL[party.status]}
                    {isOwner ? ", tu en es l'admin" : ''}
                  </p>
                  <PartyPick party={party} />
                  <div className="parties__actions">
                    {isActive ? (
                      <Link to="/" className="button">
                        Ouvrir
                      </Link>
                    ) : (
                      <button type="button" className="button" onClick={() => choose(party)}>
                        Jouer dans cette party
                      </button>
                    )}
                    <button type="button" className="button button--ghost" onClick={() => setLeaving(party)}>
                      Quitter
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="parties__forms">
        <CreatePartyForm
          editionId={edition?.id ?? null}
          onCreated={(c) => {
            setActivePartyId(c.partyId)
            setCreated(c)
            window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
          }}
        />
        <JoinPartyForm onJoined={() => navigate('/')} />
      </div>

      {past.length > 0 && (
        <section className="stack" aria-labelledby="parties-past">
          <h2 id="parties-past" className="section-title">
            Éditions précédentes
          </h2>
          <ul className="parties__list">
            {past.map((party) => (
              <li key={party.id} className="card parties__item">
                <h3 className="parties__name">{party.name}</h3>
                <p className="muted">
                  {getEdition(party.editionId)?.title ?? `Édition ${party.editionId}`}, {PHASE_LABEL[party.status].toLowerCase()}
                </p>
                <PartyPick party={party} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={!!leaving}
        title={leaving && leaving.ownerUid === user?.uid ? "Tu es l'admin de cette party" : 'Quitter la party\u00a0?'}
        confirmLabel={leaving && leaving.ownerUid === user?.uid ? 'Aller à la gestion' : 'Quitter la party'}
        onCancel={() => setLeaving(null)}
        onConfirm={async () => {
          if (!leaving) return
          if (leaving.ownerUid === user?.uid) {
            setActivePartyId(leaving.id)
            setLeaving(null)
            navigate('/soiree/gestion')
            return
          }
          await leaveParty(leaving)
          setLeaving(null)
        }}
      >
        {leaving && leaving.ownerUid === user?.uid ? (
          <p>
            Avant de quitter «&nbsp;{leaving.name}&nbsp;», transmets ton rôle d'admin à un autre membre depuis la gestion de la
            party.
          </p>
        ) : (
          <>
            <p>Tu ne verras plus «&nbsp;{leaving?.name}&nbsp;» ni les pronos de ses joueurs.</p>
            <p>Ton prono reste enregistré&nbsp;: si tu reviens avec le code, tu le retrouves.</p>
          </>
        )}
      </ConfirmDialog>
    </section>
  )
}

/** Mon prono dans une party, pour sa carte : vignette, nom, écharpe, et statut ou trophée une fois fermée. */
function PartyPick({ party }: { party: Party }) {
  const myPick = useMyPick(party.id)
  const results = useResults(party.status !== 'open' ? party.id : null).data
  const candidate = myPick.data ? getCandidate(party.editionId, myPick.data.candidateId) : null

  if (myPick.loading) {
    return (
      <p className="muted parties__pick-empty" role="status">
        Chargement de ton prono…
      </p>
    )
  }
  if (myPick.data && !candidate) {
    // Prono enregistré sur un id absent des données embarquées (candidate retirée, données corrigées).
    return (
      <p className="parties__pick-empty">
        {party.status === 'open'
          ? "Ton prono porte sur une candidate qui n'est plus dans l'app. Choisis-en une autre."
          : "Ton prono porte sur une candidate qui n'est plus dans l'app : il ne peut pas rapporter de trophée."}
      </p>
    )
  }
  if (!candidate) {
    return (
      <p className="parties__pick-empty">
        {party.status === 'open' ? "Tu n'as pas encore choisi ta Miss." : "Tu n'as pas fait de prono dans cette party."}
      </p>
    )
  }

  const status = candidateStatus(candidate.id, party, results)
  const trophy = party.status === 'finished' ? trophyFor(myPick.data, results) : null
  const detail =
    party.status === 'open'
      ? "Modifiable jusqu'à la fermeture"
      : trophy
        ? `${TROPHY_EMOJI[trophy]} ${TROPHY_LABEL[trophy]}`
        : statusLabel(status)

  return (
    <div className={`parties__pick${status === 'eliminated' ? ' parties__pick--out' : ''}`}>
      <img className="parties__pick-photo" src={candidate.photo} alt="" width="48" height="64" loading="lazy" />
      <div className="parties__pick-body">
        <p className="parties__pick-label">Ton prono</p>
        <p className="parties__pick-name">{candidate.name}</p>
        <Sash region={candidate.region} variant={sashVariant(status, true)} size="sm" />
        <span className="visually-hidden">{missLabel(candidate)}</span>
        {detail && <p className="parties__pick-detail">{detail}</p>}
      </div>
    </div>
  )
}

function CreatePartyForm({
  editionId,
  onCreated,
}: {
  editionId: string | null
  onCreated: (created: { partyId: string; code: string; name: string }) => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < PARTY_NAME_MIN || trimmed.length > PARTY_NAME_MAX) {
      setError(`Le nom doit faire entre ${PARTY_NAME_MIN} et ${PARTY_NAME_MAX} caractères.`)
      return
    }
    if (!editionId) {
      setError("Aucune édition n'est disponible dans l'app pour l'instant.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await createParty(editionId, trimmed)
      setName('')
      onCreated({ ...result, name: trimmed })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={(e) => void submit(e)} noValidate aria-labelledby="create-title">
      <h2 id="create-title" className="section-title">
        Créer une party
      </h2>
      <p className="muted">Tu en seras l'admin&nbsp;: c'est toi qui fermeras les pronos et saisiras les résultats.</p>
      <div className="field">
        <label className="field__label" htmlFor="create-name">
          Nom de la party
        </label>
        <input
          id="create-name"
          className="input"
          autoComplete="off"
          maxLength={PARTY_NAME_MAX}
          placeholder="La soirée chez Julie"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button" disabled={busy} aria-busy={busy}>
        {busy ? 'Un instant…' : 'Créer la party'}
      </button>
    </form>
  )
}

function JoinPartyForm({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = normalizeCode(code)
    const invalid = codeError(clean)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    try {
      setActivePartyId(await joinParty(clean))
      onJoined()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={(e) => void submit(e)} noValidate aria-labelledby="join-title">
      <h2 id="join-title" className="section-title">
        Rejoindre une party
      </h2>
      <div className="field">
        <label className="field__label" htmlFor="parties-code">
          Code d'invitation
        </label>
        <input
          id="parties-code"
          className="input input--code"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={CODE_LENGTH + 4}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button" disabled={busy} aria-busy={busy}>
        {busy ? 'Un instant…' : 'Rejoindre'}
      </button>
    </form>
  )
}
