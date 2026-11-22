import type { PartyEvent, PartyStatus, UserProfile } from '../lib'
import './PartyJournal.css'

const STATUS_VERB: Record<PartyStatus, string> = {
  open: 'a rouvert les pronos',
  closed: 'a fermé les pronos',
  finished: 'a terminé la soirée',
}

/** « 21h04 » aujourd'hui, sinon « 12 déc. à 21h04 ». */
export function formatEventTime(at: Date | null): string {
  if (!at) return "à l'instant"
  const hm = `${at.getHours()}h${String(at.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  if (at.toDateString() === today.toDateString()) return `à ${hm}`
  const day = at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return `le ${day} à ${hm}`
}

/** Phrase du journal : « Olga a fermé les pronos », « Olga a passé la main à Alice ». */
export function describeEvent(event: PartyEvent, users: Record<string, UserProfile>, usersLoading = false): string {
  // « … » tant que les profils se chargent, plutôt qu'un faux « Un ancien joueur ».
  const name = (uid: string) => users[uid]?.displayName ?? (usersLoading ? '…' : 'Un ancien joueur')
  const who = name(event.by)
  if (event.type === 'owner') {
    if (event.by === event.from) return `${who} a passé la main à ${name(event.to)}`
    return `${who} a transmis le rôle d'admin de ${name(event.from)} à ${name(event.to)}`
  }
  if (event.to === 'closed' && event.from === 'finished') return `${who} a rouvert la soirée`
  return `${who} ${STATUS_VERB[event.to]}`
}

/** Journal des phases et des transmissions, du plus récent au plus ancien. */
export function PartyJournal({
  events,
  users,
  usersLoading = false,
}: {
  events: PartyEvent[]
  users: Record<string, UserProfile>
  usersLoading?: boolean
}) {
  if (events.length === 0) {
    return <p className="muted">Rien pour l'instant. Chaque changement de phase apparaîtra ici, visible de tous.</p>
  }
  return (
    <ol className="party-journal" reversed>
      {[...events].reverse().map((e) => (
        <li key={e.n} className="party-journal__item">
          <span>{describeEvent(e, users, usersLoading)}</span>{' '}
          <time className="party-journal__time" dateTime={e.at?.toISOString()}>
            {formatEventTime(e.at)}
          </time>
        </li>
      ))}
    </ol>
  )
}
