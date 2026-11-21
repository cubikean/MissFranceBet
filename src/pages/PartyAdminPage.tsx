// /soiree/gestion : gestion de la party active, par son admin ou par le super admin.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import {
  canManageParty,
  DELETE_PARTY_PHRASE,
  deleteParty,
  deletePhraseMatches,
  errorMessage,
  getEdition,
  PARTY_NAME_MAX,
  PARTY_NAME_MIN,
  regenerateCode,
  removeMember,
  renameParty,
  setPartyStatus,
  transferOwnership,
  useActiveParty,
  useActivePartyId,
  useAuth,
  useIsSuperAdmin,
  useMembers,
  useParty,
  usePartyEvents,
  useResults,
  usePartyUsers,
  type Live,
  type Membership,
  type Party,
  type PartyStatus,
  type UserProfile,
} from '../lib'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog, type ConfirmDialogProps } from '../components/ConfirmDialog'
import { PartyJournal } from '../components/PartyJournal'
import { ResultsEditor } from '../components/ResultsEditor'
import './PartyAdminPage.css'

const STATUS_LABEL: Record<PartyStatus, string> = {
  open: 'Pronos ouverts',
  closed: 'Pronos fermés, émission en cours',
  finished: 'Soirée terminée',
}

const JOURNAL_NOTE = 'Ce changement est inscrit au journal de la party, visible de tous les membres.'

/**
 * Party à gérer : la party active. Le super admin peut gérer une party dont il n'est pas membre
 * (ouverte depuis /admin) : useActiveParty ne la connaît pas, on la lit alors directement.
 */
function useManagedParty(): Live<Party | null> & { isSuperAdmin: boolean } {
  const activeId = useActivePartyId()
  const active = useActiveParty()
  const superAdmin = useIsSuperAdmin()
  const needDirect = superAdmin.data && !!activeId && !active.loading && active.data?.id !== activeId
  const direct = useParty(needDirect ? activeId : null)
  const loading = active.loading || superAdmin.loading || direct.loading
  return {
    data: (needDirect ? direct.data : null) ?? active.data,
    loading,
    error: active.error,
    isSuperAdmin: superAdmin.data,
  }
}

type Confirm = Omit<ConfirmDialogProps, 'open' | 'onCancel'>

export function PartyAdminPage() {
  const { user } = useAuth()
  const managed = useManagedParty()
  // Pendant la suppression, la party disparaît du cache local avant la fin de l'écriture :
  // on garde l'écran tel quel jusqu'au bout (et pour afficher une éventuelle erreur).
  const [frozen, setFrozen] = useState<Party | null>(null)
  const [leaving, setLeaving] = useState<string | null>(null)
  const party = frozen ?? managed.data

  if (leaving) return <Navigate to={leaving} replace />
  if (managed.loading && !frozen) {
    return (
      <p className="page muted" role="status">
        Chargement…
      </p>
    )
  }
  if (!party || !canManageParty(party, user?.uid, managed.isSuperAdmin)) return <Navigate to="/soiree" replace />

  return (
    <PartyAdmin
      key={party.id}
      party={party}
      uid={user!.uid}
      isSuperAdmin={managed.isSuperAdmin}
      onDelete={async (typed) => {
        setFrozen(party)
        try {
          await deleteParty(party, typed)
        } catch (e) {
          setFrozen(null)
          throw e
        }
        setLeaving(managed.isSuperAdmin && party.ownerUid !== user?.uid ? '/admin' : '/parties')
      }}
    />
  )
}

function PartyAdmin({
  party,
  uid,
  isSuperAdmin,
  onDelete,
}: {
  party: Party
  uid: string
  isSuperAdmin: boolean
  onDelete: (typedPhrase: string) => Promise<void>
}) {
  const members = useMembers(party.id)
  const users = usePartyUsers(party.id).data
  const events = usePartyEvents(party.id)
  const results = useResults(party.id)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  // Les actions confirmées utilisent la party la plus récente (eventCount, code) : elle a pu
  // changer pendant que la fenêtre était ouverte.
  const latest = useRef(party)
  useEffect(() => {
    latest.current = party
  })
  const edition = getEdition(party.editionId)
  const pickedCount = members.data.filter((m) => m.hasPicked).length
  const memberCount = members.data.length

  const ask = (c: Confirm) =>
    setConfirm({
      ...c,
      onConfirm: async (typed) => {
        await c.onConfirm(typed)
        setConfirm(null)
      },
    })

  function askStatus(to: PartyStatus) {
    const texts: Record<PartyStatus, { title: string; label: string; body: ReactNode }> = {
      closed:
        party.status === 'open'
          ? {
              title: 'Fermer les pronos ?',
              label: 'Fermer les pronos',
              body: (
                <>
                  <p>
                    Plus personne ne pourra changer d'avis, et tous les pronos de la party seront révélés.{' '}
                    {pickedCount} joueur{pickedCount > 1 ? 's' : ''} sur {memberCount} {pickedCount > 1 ? 'ont' : 'a'}{' '}
                    choisi.
                  </p>
                  <p>{JOURNAL_NOTE}</p>
                </>
              ),
            }
          : {
              title: 'Revenir à la soirée en cours ?',
              label: 'Revenir à la soirée en cours',
              body: (
                <>
                  <p>Les trophées de cette party sont retirés jusqu'à ce que tu termines de nouveau la soirée.</p>
                  <p>{JOURNAL_NOTE}</p>
                </>
              ),
            },
      open: {
        title: 'Rouvrir les pronos ?',
        label: 'Rouvrir les pronos',
        body: (
          <>
            <p>
              Les joueurs pourront de nouveau changer d'avis, alors que tout le monde a déjà vu les pronos des autres.
            </p>
            <p>{JOURNAL_NOTE}</p>
          </>
        ),
      },
      finished: {
        title: 'Terminer la soirée ?',
        label: 'Terminer la soirée',
        body: (
          <>
            <p>
              {results.data.winner
                ? 'Les trophées sont attribués selon le podium saisi et restent sur les profils.'
                : "Le podium n'est pas encore saisi : personne ne recevra de trophée tant qu'il ne l'est pas."}
            </p>
            <p>{JOURNAL_NOTE}</p>
          </>
        ),
      },
    }
    const t = texts[to]
    ask({ title: t.title, confirmLabel: t.label, children: t.body, onConfirm: () => setPartyStatus(latest.current, to) })
  }

  return (
    <section className="page manage" aria-labelledby="manage-title">
      <header className="manage__header">
        <Link to="/soiree" className="manage__back">
          Retour à la soirée
        </Link>
        <h1 id="manage-title">Gérer la party</h1>
        <p className="manage__party">
          <strong>{party.name}</strong>
          {edition && <span className="muted"> {edition.title}</span>}
        </p>
        {isSuperAdmin && party.ownerUid !== uid && (
          <p className="manage__note">
            Tu gères cette party en tant que super admin. Son admin est{' '}
            {users[party.ownerUid]?.displayName ?? 'un joueur inconnu'}.
          </p>
        )}
      </header>

      <Card title="Phase" id="phase">
        <p className="manage__status">
          <span className={`status-dot status-dot--${party.status}`} aria-hidden="true" />
          {STATUS_LABEL[party.status]}
        </p>
        {party.status === 'open' && (
          <p className="muted">
            {pickedCount} joueur{pickedCount > 1 ? 's' : ''} sur {memberCount} {pickedCount > 1 ? 'ont' : 'a'} choisi.
            Ferme les pronos juste avant l'émission : tout le monde verra alors les choix des autres.
          </p>
        )}
        {party.status === 'closed' && (
          <p className="muted">Saisis les résultats au fil de l'émission, puis termine la soirée après le podium.</p>
        )}
        <div className="manage__actions">
          {party.status === 'open' && (
            <button type="button" className="button button--action" onClick={() => askStatus('closed')}>
              Fermer les pronos
            </button>
          )}
          {party.status === 'closed' && (
            <>
              <button
                type="button"
                className={results.data.winner ? 'button button--action' : 'button'}
                onClick={() => askStatus('finished')}
              >
                Terminer la soirée
              </button>
              <button type="button" className="button button--ghost" onClick={() => askStatus('open')}>
                Rouvrir les pronos
              </button>
            </>
          )}
          {party.status === 'finished' && (
            <button type="button" className="button button--ghost" onClick={() => askStatus('closed')}>
              Revenir à la soirée en cours
            </button>
          )}
        </div>
      </Card>

      <Card title="Résultats" id="resultats">
        {party.status === 'open' ? (
          <p className="muted">
            Ferme d'abord les pronos : la saisie du top 15, du top 5 et du podium s'ouvre ensuite.
          </p>
        ) : results.loading ? (
          <p className="muted" role="status">
            Chargement…
          </p>
        ) : party.status === 'finished' ? (
          <>
            <ResultsEditor partyId={party.id} editionId={party.editionId} results={results.data} readOnly />
            <p className="muted">
              La soirée est terminée : les résultats sont figés. Pour les corriger, reviens à la soirée en cours, puis
              termine-la de nouveau.
            </p>
            <div className="manage__actions">
              <button type="button" className="button button--ghost" onClick={() => askStatus('closed')}>
                Revenir à la soirée en cours
              </button>
            </div>
          </>
        ) : (
          <ResultsEditor
            partyId={party.id}
            editionId={party.editionId}
            results={results.data}
            onPodiumSaved={() => {
              if (party.status === 'closed') askStatus('finished')
            }}
          />
        )}
        {results.error && (
          <p className="manage__error" role="alert">
            {errorMessage(results.error)}
          </p>
        )}
      </Card>

      <Card title="Invitation" id="invitation">
        <InviteBlock
          party={party}
          onRegenerate={() =>
            ask({
              title: 'Changer le code ?',
              confirmLabel: 'Changer le code',
              children: (
                <>
                  <p>
                    L'ancien code <strong>{party.code}</strong> et l'ancien lien cesseront aussitôt de marcher. Les
                    membres actuels restent dans la party.
                  </p>
                  <p>À faire si le lien a circulé au-delà de tes amis.</p>
                </>
              ),
              onConfirm: async () => {
                await regenerateCode(latest.current)
              },
            })
          }
        />
      </Card>

      <Card title={`Membres (${memberCount})`} id="membres">
        <MemberList
          party={party}
          uid={uid}
          members={members.data}
          users={users}
          onRemove={(m, name) =>
            ask({
              title: `Retirer ${name} ?`,
              confirmLabel: `Retirer ${name}`,
              children: (
                <p>
                  {name} ne verra plus cette party. Son prono reste enregistré : s'il revient avec le code, il le
                  retrouve.
                </p>
              ),
              onConfirm: () => removeMember(party.id, m.uid),
            })
          }
          onTransfer={(m, name) =>
            ask({
              title: `Transmettre le rôle d'admin à ${name} ?`,
              confirmLabel: `Transmettre à ${name}`,
              children: (
                <>
                  <p>
                    {name} pourra fermer les pronos, saisir les résultats et gérer les membres.
                    {party.ownerUid === uid && !isSuperAdmin && ' Tu restes membre, sans droits d’admin.'}
                  </p>
                  <p>{JOURNAL_NOTE}</p>
                </>
              ),
              onConfirm: () => transferOwnership(latest.current, m.uid),
            })
          }
        />
        {members.error && (
          <p className="manage__error" role="alert">
            {errorMessage(members.error)}
          </p>
        )}
      </Card>

      <Card title="Nom de la party" id="nom">
        <RenameForm party={party} />
      </Card>

      <Card title="Journal" id="journal">
        <PartyJournal events={events.data} users={users} />
      </Card>

      <Card title="Supprimer la party" id="supprimer" danger>
        <p className="muted">Tous les membres perdent l'accès, et les trophées de cette party disparaissent.</p>
        <button
          type="button"
          className="button button--ghost manage__danger"
          onClick={() =>
            ask({
              title: 'Supprimer la party ?',
              confirmLabel: 'Supprimer la party',
              requirePhrase: { phrase: DELETE_PARTY_PHRASE, matches: deletePhraseMatches },
              children: (
                <>
                  <p>
                    La party <strong>{party.name}</strong> sera supprimée pour ses {memberCount} membre
                    {memberCount > 1 ? 's' : ''}.
                  </p>
                  <ul className="manage__consequences">
                    <li>Tous les membres perdent l'accès à la party.</li>
                    <li>Les trophées gagnés dans cette party disparaissent des profils.</li>
                    <li>Le code et le lien d'invitation cessent de marcher.</li>
                    <li>C'est définitif : impossible de revenir en arrière.</li>
                  </ul>
                </>
              ),
              onConfirm: onDelete,
            })
          }
        >
          Supprimer la party
        </button>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        confirmLabel={confirm?.confirmLabel ?? ''}
        requirePhrase={confirm?.requirePhrase}
        onConfirm={(typed) => confirm?.onConfirm(typed)}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.children}
      </ConfirmDialog>
    </section>
  )
}

function Card({ title, id, danger, children }: { title: string; id: string; danger?: boolean; children: ReactNode }) {
  return (
    <section className={danger ? 'manage-card manage-card--danger' : 'manage-card'} aria-labelledby={`card-${id}`}>
      <h2 id={`card-${id}`} className="manage-card__title">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ---------- Invitation ----------

function InviteBlock({ party, onRegenerate }: { party: Party; onRegenerate: () => void }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const link = `${window.location.origin}/rejoindre/${party.code}`
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setFeedback('Lien copié')
    } catch {
      setFeedback('Copie impossible : sélectionne le lien et copie-le à la main.')
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: party.name,
        text: `Rejoins ma party « ${party.name} » pour les pronos Miss France, avec le code ${party.code}.`,
        url: link,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setFeedback('Partage impossible. Copie le lien à la place.')
    }
  }

  return (
    <div className="invite">
      <p className="invite__code" aria-label={`Code d'invitation : ${party.code.split('').join(' ')}`}>
        {party.code}
      </p>
      <input
        className="invite__link"
        value={link}
        readOnly
        aria-label="Lien d'invitation"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="manage__actions">
        {canShare && (
          <button type="button" className="button" onClick={() => void share()}>
            Partager le lien
          </button>
        )}
        <button type="button" className={canShare ? 'button button--ghost' : 'button'} onClick={() => void copy()}>
          Copier le lien
        </button>
      </div>
      <p className="invite__feedback" role="status">
        {feedback}
      </p>
      <button type="button" className="button button--ghost" onClick={onRegenerate}>
        Changer le code
      </button>
    </div>
  )
}

// ---------- Membres ----------

function MemberList({
  party,
  uid,
  members,
  users,
  onRemove,
  onTransfer,
}: {
  party: Party
  uid: string
  members: Membership[]
  users: Record<string, UserProfile>
  onRemove: (m: Membership, name: string) => void
  onTransfer: (m: Membership, name: string) => void
}) {
  const nameOf = (m: Membership) => users[m.uid]?.displayName ?? 'Joueur inconnu'
  const sorted = [...members].sort((a, b) => {
    if (a.uid === party.ownerUid) return -1
    if (b.uid === party.ownerUid) return 1
    return nameOf(a).localeCompare(nameOf(b), 'fr')
  })
  if (sorted.length === 0) return <p className="muted">Personne pour l'instant.</p>
  return (
    <ul className="members">
      {sorted.map((m) => {
        const name = nameOf(m)
        const isOwner = m.uid === party.ownerUid
        return (
          <li key={m.uid} className="member">
            <div className="member__who">
              <Avatar profile={users[m.uid]} />
              <span className="member__name">
                {name}
                {m.uid === uid && <span className="muted"> (toi)</span>}
              </span>
              {isOwner && <span className="member__badge">Admin</span>}
            </div>
            <p className="member__picked muted">
              {party.status === 'open' ? (m.hasPicked ? 'A choisi' : "N'a pas encore choisi") : null}
            </p>
            {!isOwner && (
              <div className="member__actions">
                <button type="button" className="button button--ghost button--small" onClick={() => onTransfer(m, name)}>
                  Transmettre l'admin
                </button>
                <button type="button" className="button button--ghost button--small" onClick={() => onRemove(m, name)}>
                  Retirer
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------- Nom ----------

function RenameForm({ party }: { party: Party }) {
  const [name, setName] = useState(party.name)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const trimmed = name.trim()
  const valid = trimmed.length >= PARTY_NAME_MIN && trimmed.length <= PARTY_NAME_MAX

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || trimmed === party.name) return
    setBusy(true)
    setMessage(null)
    try {
      await renameParty(party.id, trimmed)
      setMessage({ ok: true, text: 'Nom enregistré' })
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="rename" onSubmit={(e) => void submit(e)}>
      <label htmlFor="party-name" className="visually-hidden">
        Nom de la party
      </label>
      <input
        id="party-name"
        className="rename__input"
        value={name}
        maxLength={PARTY_NAME_MAX}
        onChange={(e) => {
          setName(e.target.value)
          setMessage(null)
        }}
        aria-describedby="party-name-help"
        autoComplete="off"
      />
      <p id="party-name-help" className="muted rename__help">
        Entre {PARTY_NAME_MIN} et {PARTY_NAME_MAX} caractères. Tous les membres voient le nouveau nom.
      </p>
      <button type="submit" className="button" disabled={busy || !valid || trimmed === party.name}>
        {busy ? 'Un instant…' : 'Renommer la party'}
      </button>
      {message && (
        <p className={message.ok ? 'rename__ok' : 'manage__error'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
    </form>
  )
}
