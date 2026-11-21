import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Sash } from '../components/Sash'
import { Toast } from '../components/Toast'
import { sashVariant, statusLabel } from '../components/display'
import {
  candidateStatus,
  currentEdition,
  errorMessage,
  getCandidate,
  missLabel,
  setPick,
  useActiveParty,
  useMyPick,
  useResults,
} from '../lib'
import '../styles/ui.css'
import './CandidatePage.css'

function formatHeight(m: number): string {
  return `${m.toFixed(2).replace('.', ',')} m`
}

/** Fiche d'une candidate (feuille qui monte du bas) et bouton « Choisir Miss <Région> ». */
export function CandidatePage() {
  const { id } = useParams()
  const active = useActiveParty()
  const party = active.data
  const editionId = party?.editionId ?? currentEdition()?.id ?? null
  const candidate = getCandidate(editionId, id)
  const myPick = useMyPick(party?.id ?? null)
  const results = useResults(party && party.status !== 'open' ? party.id : null).data
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  if (!candidate) {
    return (
      <section className="page stack">
        <h1>Candidate introuvable</h1>
        <p>Cette fiche n'existe pas pour cette édition.</p>
        <Link to="/candidates" className="button">
          Voir les candidates
        </Link>
      </section>
    )
  }

  const label = missLabel(candidate)
  const isMine = myPick.data?.candidateId === candidate.id
  const status = candidateStatus(candidate.id, party, results)
  const closed = !!party && party.status !== 'open'
  const disabled = !party || closed || isMine || busy || myPick.loading

  async function choose() {
    if (!party || !candidate) return
    setBusy(true)
    setError(null)
    try {
      await setPick(party, candidate.id)
      setToast(`${missLabel(candidate)} choisie`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const facts: [string, string][] = []
  if (candidate.age) facts.push(['Âge', `${candidate.age} ans`])
  if (candidate.heightM) facts.push(['Taille', formatHeight(candidate.heightM)])
  if (candidate.origin) facts.push(['Origine', candidate.origin])
  if (candidate.job) facts.push(['Profession', candidate.job])
  if (candidate.passions) facts.push(['Passions', candidate.passions])

  return (
    <section className="page fiche" aria-labelledby="fiche-title">
      <Link to="/candidates" className="link-button fiche__back">
        Retour aux candidates
      </Link>

      <article className="fiche__sheet">
        <div className="fiche__photo">
          <img src={candidate.photoFull} alt={`${candidate.name}, ${label}, en pied`} width="700" height="1244" />
        </div>

        <div className="fiche__body">
          <header className="fiche__header">
            <Sash region={candidate.region} variant={sashVariant(status, isMine)} />
            <h1 id="fiche-title">{candidate.name}</h1>
            <p className="muted">{label}</p>
            {closed && statusLabel(status) && <p className="fiche__status">{statusLabel(status)}</p>}
          </header>

          {facts.length > 0 && (
            <dl className="fiche__facts">
              {facts.map(([term, value]) => (
                <div key={term} className="fiche__fact">
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {candidate.instagram && (
            <div className="fiche__instagram">
              <a
                className="instagram-button"
                href={`https://www.instagram.com/${encodeURIComponent(candidate.instagram)}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className="instagram-button__icon"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
                </svg>
                Voir sur Instagram
                <span className="visually-hidden"> : @{candidate.instagram} (nouvel onglet)</span>
              </a>
              <span className="muted fiche__instagram-handle">@{candidate.instagram}</span>
            </div>
          )}

          <div className="fiche__choose">
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="button button--action button--block"
              disabled={disabled}
              aria-busy={busy}
              aria-describedby="fiche-choose-hint"
              onClick={() => void choose()}
            >
              {busy ? 'Un instant…' : isMine ? `${label} est ton prono` : `Choisir ${label}`}
            </button>
            <p id="fiche-choose-hint" className="field__hint">
              {!party ? (
                <>
                  Pour choisir, <Link to="/parties">crée ou rejoins une party</Link>.
                </>
              ) : closed ? (
                'Les pronos sont fermés : tu ne peux plus changer.'
              ) : (
                `Party : ${party.name}. Tu peux changer d'avis jusqu'à la fermeture.`
              )}
            </p>
          </div>
        </div>
      </article>

      <Toast message={toast} onDone={clearToast} />
    </section>
  )
}
