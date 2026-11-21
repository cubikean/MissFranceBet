import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Confetti } from '../components/Confetti'
import { InviteShare } from '../components/InviteShare'
import { PartyJournal } from '../components/PartyJournal'
import { Sash } from '../components/Sash'
import { formatDateTime, PHASE_LABEL, sashVariant, statusLabel, TROPHY_EMOJI } from '../components/display'
import {
  canManageParty,
  candidateStatus,
  errorMessage,
  getCandidate,
  hasPodium,
  missLabel,
  trophyFor,
  useActiveParty,
  useAuth,
  useIsSuperAdmin,
  useMembers,
  usePartyEvents,
  usePickHistory,
  usePicks,
  useResults,
  usePartyUsers,
  type Party,
  type PickHistoryEntry,
  type Results,
  type UserProfile,
} from '../lib'
import '../styles/ui.css'
import './PartyPage.css'

type Users = Record<string, UserProfile>

function who(users: Users, uid: string): string {
  return users[uid]?.displayName ?? 'Un ancien joueur'
}

/** Soirée de la party active : avant la fermeture, qui a joué ; après, les pronos révélés et le direct. */
export function PartyPage() {
  const { user } = useAuth()
  const isSuperAdmin = useIsSuperAdmin().data
  const active = useActiveParty()
  const party = active.data
  const users = usePartyUsers(party?.id ?? null).data

  if (active.loading) {
    return (
      <p className="page muted" role="status">
        Chargement…
      </p>
    )
  }
  if (active.error) {
    return (
      <section className="page">
        <p className="form-error" role="alert">
          {errorMessage(active.error)}
        </p>
      </section>
    )
  }
  if (!party) {
    return (
      <section className="page stack" aria-labelledby="soiree-title">
        <h1 id="soiree-title">Soirée</h1>
        <p>Tu n'as pas encore de party cette année. Crée la tienne ou rejoins celle de tes amis.</p>
        <Link to="/parties" className="button button--action soiree__cta">
          Créer ou rejoindre une party
        </Link>
      </section>
    )
  }

  return (
    <section className="page soiree stack stack--lg" aria-labelledby="soiree-title">
      <header className="soiree__header">
        {party.status === 'closed' && <p className="live-badge">En direct</p>}
        <h1 id="soiree-title">{party.name}</h1>
        <p className="muted">{PHASE_LABEL[party.status]}</p>
        {canManageParty(party, user?.uid, isSuperAdmin) && (
          <Link to="/soiree/gestion" className="button soiree__cta">
            Gérer la party
          </Link>
        )}
      </header>

      {party.status === 'open' ? (
        <BeforeClosing party={party} users={users} />
      ) : (
        <Revealed party={party} users={users} myUid={user?.uid ?? null} />
      )}

      <Journal partyId={party.id} users={users} />
    </section>
  )
}

function BeforeClosing({ party, users }: { party: Party; users: Users }) {
  const members = useMembers(party.id)
  const picked = members.data.filter((m) => m.hasPicked).length
  const sorted = [...members.data].sort((a, b) => who(users, a.uid).localeCompare(who(users, b.uid), 'fr'))

  return (
    <>
      <section className="card" aria-labelledby="soiree-players">
        <h2 id="soiree-players" className="section-title">
          {members.loading ? 'Joueurs' : `${picked} sur ${members.data.length} ont fait leur prono`}
        </h2>
        <p className="muted">Les pronos restent secrets jusqu'à la fermeture, pour tout le monde, admin compris.</p>
        {members.error ? (
          <p className="form-error" role="alert">
            {errorMessage(members.error)}
          </p>
        ) : (
          <ul className="players">
            {sorted.map((m) => (
              <li key={m.uid} className="player player--compact">
                <Avatar profile={users[m.uid]} size="sm" />
                <span className="player__name">{who(users, m.uid)}</span>
                <span className={m.hasPicked ? 'player__done' : 'muted'}>{m.hasPicked ? 'a choisi' : 'pas encore'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="soiree-invite">
        <h2 id="soiree-invite" className="section-title">
          Inviter des amis
        </h2>
        <InviteShare code={party.code} partyName={party.name} />
      </section>
    </>
  )
}

function Revealed({ party, users, myUid }: { party: Party; users: Users; myUid: string | null }) {
  const members = useMembers(party.id)
  const picks = usePicks(party.id)
  const history = usePickHistory(party.id, 'all')
  const results = useResults(party.id).data

  const memberUids = new Set(members.data.map((m) => m.uid))
  const players = picks.data
    .filter((p) => memberUids.has(p.uid))
    .map((pick) => ({ pick, candidate: getCandidate(party.editionId, pick.candidateId) }))
    .sort((a, b) => who(users, a.pick.uid).localeCompare(who(users, b.pick.uid), 'fr'))
  const noPick = members.data.filter((m) => !picks.data.some((p) => p.uid === m.uid))

  const statuses = players.map((p) => candidateStatus(p.pick.candidateId, party, results))
  const out = statuses.filter((s) => s === 'eliminated').length
  // Décrochage des écharpes éliminées l'une après l'autre : 60 ms de décalage (DESIGN.md).
  let k = 0
  const delays = statuses.map((s) => (s === 'eliminated' ? k++ * 60 : 0))

  const historyByUid = new Map<string, PickHistoryEntry[]>()
  for (const h of history.data) historyByUid.set(h.uid, [...(historyByUid.get(h.uid) ?? []), h])

  const error = picks.error ?? members.error
  if (error) {
    return (
      <p className="form-error" role="alert">
        {errorMessage(error)}
      </p>
    )
  }

  return (
    <>
      {hasPodium(results) && <Podium party={party} results={results} players={players} users={users} />}

      <section className="stack" aria-labelledby="soiree-picks">
        <div className="soiree__picks-head">
          <h2 id="soiree-picks" className="section-title">
            Les pronos
          </h2>
          {players.length > 0 && (
            <p className="soiree__counter" aria-live="polite">
              {players.length - out} en course · {out} out
            </p>
          )}
        </div>
        {picks.loading ? (
          <p className="muted" role="status">
            Chargement…
          </p>
        ) : players.length === 0 ? (
          <p className="muted">Personne n'a fait de prono dans cette party.</p>
        ) : (
          <ul className="players">
            {players.map(({ pick, candidate }, i) => {
              const status = statuses[i] ?? 'neutral'
              const changes = pick.changeCount - 1
              const entries = historyByUid.get(pick.uid) ?? []
              const label = statusLabel(status)
              const trophy = party.status === 'finished' ? trophyFor(pick, results) : null
              return (
                <li key={pick.uid} className={`player${pick.uid === myUid ? ' player--me' : ''}`}>
                  <div className="player__row">
                    <Avatar profile={users[pick.uid]} />
                    <span className="player__name">
                      {who(users, pick.uid)}
                      {pick.uid === myUid && <span className="muted"> (toi)</span>}
                    </span>
                    <Sash
                      region={candidate?.region ?? 'Inconnue'}
                      variant={sashVariant(status)}
                      size="sm"
                      delay={delays[i]}
                      className="player__sash"
                    />
                  </div>
                  <p className="player__meta">
                    {candidate ? missLabel(candidate) : 'Candidate inconnue'}
                    {label ? `, ${label.toLowerCase()}` : ''}
                    {trophy ? ` ${TROPHY_EMOJI[trophy]}` : ''}
                  </p>
                  {entries.length > 1 ? (
                    <details className="player__history">
                      <summary>
                        {changes === 1 ? "A changé d'avis 1 fois" : `A changé d'avis ${changes} fois`}
                      </summary>
                      <ol>
                        {entries.map((h) => {
                          const c = getCandidate(party.editionId, h.candidateId)
                          return (
                            <li key={h.id}>
                              {formatDateTime(h.at)} : {c ? missLabel(c) : 'candidate inconnue'}
                            </li>
                          )
                        })}
                      </ol>
                    </details>
                  ) : (
                    <p className="player__meta muted">
                      {entries[0]?.at ? `Choisie le ${formatDateTime(entries[0].at)}, sans changer d'avis` : "N'a pas changé d'avis"}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {noPick.length > 0 && (
          <p className="muted">
            Sans prono : {noPick.map((m) => who(users, m.uid)).join(', ')}.
          </p>
        )}
      </section>
    </>
  )
}

const PODIUM: { key: 'winner' | 'firstRunnerUp' | 'secondRunnerUp'; title: string; trophy: 'gold' | 'silver' | 'bronze' }[] = [
  { key: 'firstRunnerUp', title: '1re dauphine', trophy: 'silver' },
  { key: 'winner', title: 'Élue', trophy: 'gold' },
  { key: 'secondRunnerUp', title: '2e dauphine', trophy: 'bronze' },
]

function Podium({
  party,
  results,
  players,
  users,
}: {
  party: Party
  results: Results
  players: { pick: { uid: string; candidateId: string } }[]
  users: Users
}) {
  const [firstSight] = useState(() => {
    const key = `pronos-miss:confetti:${party.id}`
    try {
      if (localStorage.getItem(key)) return false
      localStorage.setItem(key, '1')
    } catch {
      // stockage indisponible : la pluie se rejouera au prochain chargement
    }
    return true
  })

  return (
    <section className="podium" aria-labelledby="soiree-podium">
      {firstSight && <Confetti />}
      <h2 id="soiree-podium" className="section-title">
        Le podium
      </h2>
      <ol className="podium__steps">
        {PODIUM.map(({ key, title, trophy }) => {
          const id = results[key]
          const c = id ? getCandidate(party.editionId, id) : null
          const winners = players.filter((p) => id && p.pick.candidateId === id)
          return (
            <li key={key} className={`podium__step podium__step--${trophy}`}>
              <span className="podium__trophy" aria-hidden="true">
                {TROPHY_EMOJI[trophy]}
              </span>
              <span className="podium__title">{title}</span>
              {c ? (
                <>
                  <img className="podium__photo" src={c.photo} alt="" width="300" height="400" />
                  <Sash region={c.region} variant={key === 'winner' ? 'winner' : 'default'} size="sm" />
                  <span className="podium__name">{c.name}</span>
                </>
              ) : (
                <span className="muted">À venir</span>
              )}
              {winners.length > 0 && (
                <span className="podium__players">
                  {winners.map((p) => who(users, p.pick.uid)).join(', ')}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Journal({ partyId, users }: { partyId: string; users: Users }) {
  const events = usePartyEvents(partyId)
  return (
    <section className="stack" aria-labelledby="soiree-journal">
      <h2 id="soiree-journal" className="section-title">
        Journal de la party
      </h2>
      {events.error ? (
        <p className="form-error" role="alert">
          {errorMessage(events.error)}
        </p>
      ) : (
        <PartyJournal events={events.data} users={users} />
      )}
    </section>
  )
}
