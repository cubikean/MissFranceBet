import { Link } from 'react-router'
import { CandidateCard } from '../components/CandidateCard'
import {
  candidateStatus,
  currentEdition,
  getCandidate,
  getEdition,
  listCandidates,
  missLabel,
  useActiveParty,
  useMyPick,
  useResults,
} from '../lib'
import '../styles/ui.css'
import './CandidatesPage.css'

export function CandidatesPage() {
  const party = useActiveParty().data
  const editionId = party?.editionId ?? currentEdition()?.id ?? null
  const edition = getEdition(editionId)
  const candidates = listCandidates(editionId)
  const myPick = useMyPick(party?.id ?? null).data
  const results = useResults(party && party.status !== 'open' ? party.id : null).data
  const mine = myPick ? getCandidate(editionId, myPick.candidateId) : null

  const statuses = new Map(candidates.map((c) => [c.id, candidateStatus(c.id, party, results)]))
  const eliminated = [...statuses.values()].filter((s) => s === 'eliminated').length
  const showStatus = !!party && party.status !== 'open'

  return (
    <section className="page candidates" aria-labelledby="candidates-title">
      <header className="stack candidates__header">
        <h1 id="candidates-title">Les candidates</h1>
        <p className="muted">
          {edition?.title ?? ''}, {candidates.length} candidates.
          {showStatus && ` ${candidates.length - eliminated} en course · ${eliminated} éliminées`}
        </p>
        {!party ? (
          <p>
            Pour choisir ta Miss, <Link to="/parties">crée ou rejoins une party</Link>.
          </p>
        ) : mine ? (
          <p>
            Ton prono dans « {party.name} » : <strong>{missLabel(mine)}</strong>.
          </p>
        ) : party.status === 'open' ? (
          <p>Touche une candidate pour voir sa fiche et la choisir.</p>
        ) : null}
      </header>

      <ul className="candidates__grid">
        {candidates.map((c) => {
          return (
            <li key={c.id}>
              <CandidateCard
                candidate={c}
                status={statuses.get(c.id) ?? 'neutral'}
                mine={mine?.id === c.id}
                showStatus={showStatus}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
