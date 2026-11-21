// /admin : super admin (protégé par RequireSuperAdmin). Toutes les parties et la sauvegarde.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  downloadBackup,
  errorMessage,
  getEdition,
  setActivePartyId,
  useAllParties,
  useIsSuperAdmin,
  useMembers,
  useUsers,
  type Party,
  type PartyStatus,
  type UserProfile,
} from '../lib'
import './AdminPage.css'

const STATUS_LABEL: Record<PartyStatus, string> = {
  open: 'Pronos ouverts',
  closed: 'Pronos fermés',
  finished: 'Terminée',
}

export function AdminPage() {
  const isSuperAdmin = useIsSuperAdmin().data
  const parties = useAllParties(isSuperAdmin)
  const users = useUsers('all').data
  const navigate = useNavigate()

  function manage(party: Party) {
    setActivePartyId(party.id)
    navigate('/soiree/gestion')
  }

  return (
    <section className="page super" aria-labelledby="super-title">
      <h1 id="super-title">Super admin</h1>

      <BackupCard />

      <section className="super__section" aria-labelledby="super-parties">
        <h2 id="super-parties">
          Toutes les parties{!parties.loading && ` (${parties.data.length})`}
        </h2>
        {parties.loading ? (
          <p className="muted" role="status">
            Chargement…
          </p>
        ) : parties.error ? (
          <p className="super__error" role="alert">
            {errorMessage(parties.error)}
          </p>
        ) : parties.data.length === 0 ? (
          <p className="muted">Aucune party pour l'instant. Elles apparaîtront ici dès qu'un joueur en crée une.</p>
        ) : (
          <ul className="super__list">
            {parties.data.map((p) => (
              <PartyRow key={p.id} party={p} users={users} onManage={() => manage(p)} />
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function PartyRow({ party, users, onManage }: { party: Party; users: Record<string, UserProfile>; onManage: () => void }) {
  const members = useMembers(party.id)
  const owner = users[party.ownerUid]
  const edition = getEdition(party.editionId)
  const count = members.data.length
  return (
    <li className="super-party">
      <div className="super-party__head">
        <h3 className="super-party__name">{party.name}</h3>
        <span className={`super-party__status super-party__status--${party.status}`}>{STATUS_LABEL[party.status]}</span>
      </div>
      <dl className="super-party__facts">
        <div>
          <dt>Édition</dt>
          <dd>{edition?.title ?? party.editionId}</dd>
        </div>
        <div>
          <dt>Admin</dt>
          <dd>{owner?.displayName ?? 'Joueur inconnu'}</dd>
        </div>
        <div>
          <dt>Membres</dt>
          <dd>{members.loading ? '…' : count}</dd>
        </div>
      </dl>
      <button type="button" className="button button--ghost" onClick={onManage}>
        Gérer la party<span className="visually-hidden"> {party.name}</span>
      </button>
    </li>
  )
}

function BackupCard() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function backup() {
    setBusy(true)
    setMessage(null)
    try {
      await downloadBackup()
      setMessage({ ok: true, text: 'Sauvegarde téléchargée. Range le fichier en lieu sûr.' })
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="super__backup" aria-labelledby="super-backup">
      <h2 id="super-backup">Sauvegarde</h2>
      <p className="muted">
        À faire après chaque soirée : rien n'est sauvegardé automatiquement. Le fichier contient les profils et, pour
        chaque party, les membres, le journal, les résultats et les pronos une fois révélés.
      </p>
      <button type="button" className="button" onClick={() => void backup()} disabled={busy} aria-busy={busy}>
        {busy ? 'Un instant…' : 'Télécharger une sauvegarde'}
      </button>
      {message && (
        <p className={message.ok ? 'super__ok' : 'super__error'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
    </section>
  )
}
