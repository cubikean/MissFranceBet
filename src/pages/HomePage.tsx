import { Link } from 'react-router'
import { Sash } from '../components/Sash'
import { useNow } from '../components/useNow'
import { PHASE_LABEL, sashVariant, statusLabel, TROPHY_EMOJI } from '../components/display'
import {
  candidateStatus,
  currentEdition,
  errorMessage,
  getCandidate,
  missLabel,
  trophyFor,
  useActiveParty,
  useMyPick,
  useResults,
  type Edition,
} from '../lib'
import '../styles/ui.css'
import './HomePage.css'

const DAY = 24 * 60 * 60 * 1000
/** Durée approximative de l'émission, pour afficher « En direct » pendant la soirée. */
const SHOW_LENGTH = 4 * 60 * 60 * 1000

function showDate(date: Date): string {
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = `${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time}`
}

function Countdown({ edition }: { edition: Edition }) {
  const remaining0 = edition.showAt.getTime() - Date.now()
  const now = useNow(remaining0 < 2 * DAY ? 1000 : 60 * 1000)
  const remaining = edition.showAt.getTime() - now.getTime()

  if (remaining <= 0) {
    if (-remaining < SHOW_LENGTH) return <p className="live-badge">En direct sur TF1</p>
    return <p className="muted">L'émission est passée.</p>
  }
  if (remaining >= DAY) {
    const days = Math.ceil(remaining / DAY)
    return (
      <p className="home__countdown">
        <span aria-hidden="true">J-{days}</span>
        <span className="visually-hidden">Dans {days} jours</span>
      </p>
    )
  }
  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <p className="home__countdown">
      <span aria-hidden="true">
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
      <span className="visually-hidden">
        Dans {h} heures et {m} minutes
      </span>
    </p>
  )
}

export function HomePage() {
  const edition = currentEdition()
  const active = useActiveParty()
  const party = active.data
  const myPick = useMyPick(party?.id ?? null)
  const results = useResults(party && party.status !== 'open' ? party.id : null)

  const candidate = party && myPick.data ? getCandidate(party.editionId, myPick.data.candidateId) : null
  const status = candidate ? candidateStatus(candidate.id, party, results.data) : 'neutral'
  const trophy = party?.status === 'finished' ? trophyFor(myPick.data, results.data) : null

  return (
    <section className="page home stack stack--lg" aria-labelledby="home-title">
      <header className="home__header">
        <h1 id="home-title">Pronos Miss {edition ? edition.id : ''}</h1>
        {edition && (
          <>
            <p className="home__date">{showDate(edition.showAt)}, sur TF1</p>
            <Countdown edition={edition} />
          </>
        )}
      </header>

      {active.loading ? (
        <p className="muted" role="status">
          Chargement…
        </p>
      ) : active.error ? (
        <p className="form-error" role="alert">
          {errorMessage(active.error)}
        </p>
      ) : !party ? (
        <div className="card">
          <h2 className="section-title">Crée ta party ou rejoins celle de tes amis</h2>
          <p>Une party, c'est ton groupe d'amis : chacun choisit la Miss qu'il voit gagner, et on compare le soir de l'émission.</p>
          <Link to="/parties" className="button button--action home__cta">
            Créer ou rejoindre une party
          </Link>
        </div>
      ) : (
        <>
          <div className="home__party">
            <p>
              <span className="muted">Party : </span>
              <strong>{party.name}</strong>
              <span className="muted">, {PHASE_LABEL[party.status].toLowerCase()}</span>
            </p>
            <Link to="/parties" className="link-button">
              Changer de party
            </Link>
          </div>

          <div className="home__pick">
            {myPick.loading ? (
              <p className="muted" role="status">
                Chargement de ton prono…
              </p>
            ) : candidate ? (
              <>
                <p className="muted">Ton prono</p>
                <Sash region={candidate.region} size="lg" variant={sashVariant(status)} />
                <p className="home__pick-name">
                  {missLabel(candidate)}, {candidate.name}
                </p>
                {statusLabel(status) && <p className="home__status">{statusLabel(status)}</p>}
              </>
            ) : (
              <p>
                {party.status === 'open'
                  ? "Tu n'as pas encore choisi. Va voir les candidates."
                  : "Tu n'as pas fait de prono dans cette party."}
              </p>
            )}
          </div>

          <NextStep phase={party.status} hasPick={!!candidate} trophy={trophy} />
        </>
      )}
    </section>
  )
}

function NextStep({
  phase,
  hasPick,
  trophy,
}: {
  phase: 'open' | 'closed' | 'finished'
  hasPick: boolean
  trophy: 'gold' | 'silver' | 'bronze' | null
}) {
  if (phase === 'open') {
    return (
      <div className="stack">
        {hasPick && <p>Tu peux changer d'avis jusqu'à la fermeture des pronos.</p>}
        <Link to="/candidates" className={`button home__cta${hasPick ? '' : ' button--action'}`}>
          Voir les candidates
        </Link>
      </div>
    )
  }
  if (phase === 'closed') {
    return (
      <div className="stack">
        <p>Les pronos sont fermés et révélés. Suis l'émission avec la party.</p>
        <Link to="/soiree" className="button home__cta">
          Voir la soirée
        </Link>
      </div>
    )
  }
  return (
    <div className="stack">
      <p>
        {trophy
          ? `Bravo, tu gagnes ${TROPHY_EMOJI[trophy]} ! Le trophée est sur ton profil.`
          : hasPick
            ? "C'est terminé. Pas de trophée cette fois."
            : "C'est terminé."}
      </p>
      <Link to="/soiree" className="button home__cta">
        Voir le podium
      </Link>
    </div>
  )
}
