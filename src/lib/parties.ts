// Parties : un groupe d'amis pour une édition. Le créateur en est l'admin ; les autres
// rejoignent avec le code d'invitation. Le super admin (admins/{uid}) voit et gère toutes les parties.
import { useSyncExternalStore } from 'react'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError, isPermissionDenied } from './errors'
import { toDate, useSnapshot } from './live'
import { currentEdition, getEdition } from './editions'
import { useUsers } from './profile'
import type { Live, Membership, Party, PartyEvent, PartyStatus, UserProfile } from './types'

// ---------- Code d'invitation ----------

/** Alphabet sans caractères ambigus (pas de 0/O, 1/I/L). Doit rester aligné avec firestore.rules. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

/** Code saisi normalisé : sans espaces ni tirets, en majuscules. */
export function normalizeCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase()
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code)
}

/** Code aléatoire (crypto), ex. "K7QMZ3". */
export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export const PARTY_NAME_MIN = 2
export const PARTY_NAME_MAX = 40

// ---------- Conversions ----------

/**
 * Statut d'une party supprimée : le document reste en base (pierre tombale) pour que son id ne
 * puisse pas être recréé. Elle n'est lisible que par le super admin, et la couche données la
 * traite comme inexistante : elle n'apparaît jamais comme une `Party`.
 */
export const DELETED_STATUS = 'deleted'

/** true si les données lues sont celles d'une party supprimée (pierre tombale). */
export function isDeletedParty(d: DocumentData | undefined): boolean {
  return d?.status === DELETED_STATUS
}

/** Party lue, ou null si elle n'existe pas ou a été supprimée (pierre tombale). */
function livePartyOf(id: string, d: DocumentData | undefined): Party | null {
  return d && !isDeletedParty(d) ? toParty(id, d) : null
}

export function toParty(id: string, d: DocumentData): Party {
  return {
    id,
    editionId: d.editionId,
    name: d.name,
    ownerUid: d.ownerUid,
    code: d.code,
    status: d.status,
    eventCount: d.eventCount ?? 0,
    createdAt: toDate(d.createdAt),
  }
}

function toMembership(partyId: string, uid: string, d: DocumentData): Membership {
  return { uid, partyId, editionId: d.editionId, joinedAt: toDate(d.joinedAt), hasPicked: d.hasPicked === true }
}

function toEvent(id: string, d: DocumentData): PartyEvent {
  return { n: Number(id), type: d.type === 'owner' ? 'owner' : 'status', from: d.from, to: d.to, by: d.by, at: toDate(d.at) } as PartyEvent
}

// ---------- Création et adhésion ----------

/**
 * Crée une party pour l'édition et m'en fait admin et membre, en un seul batch :
 * parties/{p} + partyCodes/{code} + parties/{p}/members/{moi}. Le code est unique
 * (partyCodes/{code} ne peut pas être écrasé) ; en cas de collision on réessaie.
 */
export async function createParty(editionId: string, name: string): Promise<{ partyId: string; code: string }> {
  const uid = requireUid()
  const trimmed = name.trim()
  if (!getEdition(editionId)) throw new AppError('party-invalid', "Cette édition n'existe pas dans l'app.")
  if (trimmed.length < PARTY_NAME_MIN || trimmed.length > PARTY_NAME_MAX) {
    throw new AppError('party-invalid', `Le nom doit faire entre ${PARTY_NAME_MIN} et ${PARTY_NAME_MAX} caractères.`)
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const partyRef = doc(collection(db, 'parties'))
    const batch = writeBatch(db)
    batch.set(partyRef, {
      editionId,
      name: trimmed,
      ownerUid: uid,
      code,
      status: 'open',
      eventCount: 0,
      createdAt: serverTimestamp(),
    })
    batch.set(doc(db, 'partyCodes', code), { partyId: partyRef.id, editionId })
    batch.set(doc(partyRef, 'members', uid), { uid, editionId, joinedAt: serverTimestamp(), hasPicked: false })
    try {
      await batch.commit()
      return { partyId: partyRef.id, code }
    } catch (error) {
      // Refus = le code existe déjà (très improbable) : on en tire un autre.
      if (!isPermissionDenied(error)) throw error
    }
  }
  throw new AppError('party-invalid', "Impossible de créer la party. Réessaie dans un instant.")
}

/**
 * Rejoint une party avec son code. Renvoie l'id de la party.
 * Mauvais code : AppError('wrong-code'). Sans effet si je suis déjà membre.
 * La preuve parties/{p}/joinProofs/{moi} porte le code, est vérifiée par les règles dans
 * le même batch que l'adhésion, puis supprimée : l'adhésion ne stocke aucun code.
 */
export async function joinParty(rawCode: string): Promise<string> {
  const uid = requireUid()
  const code = normalizeCode(rawCode)
  const wrong = new AppError('wrong-code', "Ce code ne marche pas. Vérifie-le auprès de l'organisateur.")
  if (!isValidCode(code)) throw wrong
  const codeDoc = await getDoc(doc(db, 'partyCodes', code))
  if (!codeDoc.exists()) throw wrong
  const { partyId, editionId } = codeDoc.data() as { partyId: string; editionId: string }

  const memberRef = doc(db, 'parties', partyId, 'members', uid)
  if ((await getDoc(memberRef)).exists()) return partyId
  // Si je reviens après avoir quitté la party, mon prono y est encore : hasPicked le reflète.
  const hasPicked = (await getDoc(doc(db, 'parties', partyId, 'picks', uid))).exists()

  const proof = doc(db, 'parties', partyId, 'joinProofs', uid)
  const batch = writeBatch(db)
  batch.set(proof, { code })
  batch.set(memberRef, { uid, editionId, joinedAt: serverTimestamp(), hasPicked })
  try {
    await batch.commit()
  } catch (error) {
    if (isPermissionDenied(error)) throw wrong
    throw error
  }
  // Si la suppression échoue, la preuve reste illisible par tous : sans gravité.
  await deleteDoc(proof).catch(() => undefined)
  return partyId
}

// ---------- Lecture ----------

/**
 * Une party (null si elle n'existe pas ou a été supprimée ; erreur permission-denied si je n'en
 * suis pas membre).
 */
export function useParty(partyId: string | null): Live<Party | null> {
  const { user } = useAuth()
  return useSnapshot<Party | null>(
    user && partyId ? `parties/${partyId}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'parties', partyId!),
        (s) => next(livePartyOf(s.id, s.data({ serverTimestamps: 'estimate' }))),
        fail,
      ),
    null,
  )
}

/** Mes adhésions, toutes éditions confondues (requête collection group sur members.uid). */
export function useMyMemberships(): Live<Membership[]> {
  const { user } = useAuth()
  return useSnapshot<Membership[]>(
    user ? `memberships/${user.uid}` : null,
    (next, fail) =>
      onSnapshot(
        query(collectionGroup(db, 'members'), where('uid', '==', user!.uid)),
        (s) =>
          next(
            s.docs.map((d) => toMembership(d.ref.parent.parent!.id, d.id, d.data({ serverTimestamps: 'estimate' }))),
          ),
        fail,
      ),
    [],
  )
}

/**
 * Mes parties (filtrées sur une édition si editionId est donné), les plus récentes d'abord.
 * Combine mes adhésions et un abonnement à chaque party. Une party supprimée disparaît : son
 * adhésion part dans le même batch, et si son abonnement est refusé entre-temps (party devenue
 * illisible), elle est simplement retirée de la liste.
 */
export function useMyParties(editionId?: string | null): Live<Party[]> {
  const { user } = useAuth()
  return useSnapshot<Party[]>(
    user ? `myParties/${user.uid}/${editionId ?? '*'}` : null,
    (next, fail) => {
      const parties = new Map<string, Party>()
      const inner = new Map<string, () => void>()
      let ready = false
      const emit = () => {
        if (!ready) return
        next(
          [...parties.values()]
            .filter((p) => !editionId || p.editionId === editionId)
            .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
        )
      }
      const outer = onSnapshot(
        query(collectionGroup(db, 'members'), where('uid', '==', user!.uid)),
        (s) => {
          const ids = new Set(
            s.docs
              .filter((d) => !editionId || d.data().editionId === editionId)
              .map((d) => d.ref.parent.parent!.id),
          )
          for (const [id, unsub] of inner) {
            if (!ids.has(id)) {
              unsub()
              inner.delete(id)
              parties.delete(id)
            }
          }
          let pending = [...ids].filter((id) => !inner.has(id)).length
          ready = pending === 0
          for (const id of ids) {
            if (inner.has(id)) continue
            let first = true
            const loaded = () => {
              if (first) {
                first = false
                pending -= 1
                if (pending === 0) ready = true
              }
              emit()
            }
            inner.set(
              id,
              onSnapshot(
                doc(db, 'parties', id),
                (p) => {
                  const party = livePartyOf(id, p.data({ serverTimestamps: 'estimate' }))
                  if (party) parties.set(id, party)
                  else parties.delete(id)
                  loaded()
                },
                (error) => {
                  if (!isPermissionDenied(error)) return fail(error)
                  // Party supprimée (ou adhésion retirée) pendant l'écoute : elle disparaît.
                  // L'écoute est close ; on l'oublie pour la rouvrir si l'adhésion revient.
                  inner.delete(id)
                  parties.delete(id)
                  loaded()
                },
              ),
            )
          }
          emit()
        },
        fail,
      )
      return () => {
        outer()
        inner.forEach((u) => u())
      }
    },
    [],
  )
}

/** Mon adhésion à la party : null si je ne l'ai pas rejointe. */
export function useMembership(partyId: string | null): Live<Membership | null> {
  const { user } = useAuth()
  return useSnapshot<Membership | null>(
    user && partyId ? `parties/${partyId}/members/${user.uid}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'parties', partyId!, 'members', user!.uid),
        (s) => next(s.exists() ? toMembership(partyId!, s.id, s.data({ serverTimestamps: 'estimate' })) : null),
        fail,
      ),
    null,
  )
}

/** Tous les membres de la party (lisible par les membres) : qui joue, qui a déjà pronostiqué. */
export function useMembers(partyId: string | null): Live<Membership[]> {
  const { user } = useAuth()
  return useSnapshot<Membership[]>(
    user && partyId ? `parties/${partyId}/members` : null,
    (next, fail) =>
      onSnapshot(
        collection(db, 'parties', partyId!, 'members'),
        (s) => next(s.docs.map((d) => toMembership(partyId!, d.id, d.data({ serverTimestamps: 'estimate' })))),
        fail,
      ),
    [],
  )
}

/** Journal (changements de phase, transmissions d'admin), du plus ancien au plus récent. */
export function usePartyEvents(partyId: string | null): Live<PartyEvent[]> {
  const { user } = useAuth()
  return useSnapshot<PartyEvent[]>(
    user && partyId ? `parties/${partyId}/events` : null,
    (next, fail) =>
      onSnapshot(
        collection(db, 'parties', partyId!, 'events'),
        (s) =>
          next(s.docs.map((d) => toEvent(d.id, d.data({ serverTimestamps: 'estimate' }))).sort((a, b) => a.n - b.n)),
        fail,
      ),
    [],
  )
}

/**
 * Toutes les parties (super admin uniquement), les plus récentes d'abord. Les parties supprimées
 * (pierres tombales) n'y figurent pas ; elles restent dans la sauvegarde JSON.
 */
export function useAllParties(enabled: boolean): Live<Party[]> {
  const { user } = useAuth()
  return useSnapshot<Party[]>(
    user && enabled ? 'parties:all' : null,
    (next, fail) =>
      onSnapshot(
        query(collection(db, 'parties'), orderBy('createdAt', 'desc')),
        (s) =>
          next(
            s.docs.flatMap((d) => {
              const party = livePartyOf(d.id, d.data({ serverTimestamps: 'estimate' }))
              return party ? [party] : []
            }),
          ),
        fail,
      ),
    [],
  )
}

// ---------- Party active (choix local, par appareil) ----------

const ACTIVE_KEY = 'pronos-miss:active-party'
const listeners = new Set<() => void>()

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

/** Mémorise la party affichée par les onglets Accueil, Candidates et Soirée (null = aucune). */
export function setActivePartyId(partyId: string | null): void {
  try {
    if (partyId) localStorage.setItem(ACTIVE_KEY, partyId)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // stockage indisponible (navigation privée) : le choix ne survivra pas au rechargement
  }
  memory = partyId
  listeners.forEach((l) => l())
}

let memory: string | null = readActive()

/**
 * Id de la party active, mémorisé sur l'appareil. Ne garantit pas que j'en sois encore membre :
 * croise avec useMyParties() et retombe sur la plus récente si besoin.
 */
export function useActivePartyId(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => memory,
    () => null,
  )
}

// ---------- Droits ----------

/** true si je peux administrer la party : j'en suis l'admin (ownerUid), ou je suis super admin. */
export function canManageParty(party: Party | null, uid: string | null | undefined, isSuperAdmin: boolean): boolean {
  return !!party && !!uid && (party.ownerUid === uid || isSuperAdmin)
}

/** Transitions de phase autorisées (le retour en arrière est permis et journalisé). */
export const PARTY_STATUSES: PartyStatus[] = ['open', 'closed', 'finished']

/**
 * Party active de l'édition en cours : celle mémorisée sur l'appareil si j'en suis encore membre,
 * sinon la plus récente. data = null si je n'ai aucune party cette année (proposer /parties).
 * C'est le point d'entrée des onglets Accueil, Candidates et Soirée.
 */
export function useActiveParty(): Live<Party | null> {
  const current = useCurrentParties()
  return { data: current.data.active, loading: current.loading, error: current.error }
}

/**
 * Mes parties de l'édition en cours et la party active parmi elles (même règle que useActiveParty).
 * Sert à la bulle « Party active » affichée quand je suis dans plusieurs parties.
 */
export function useCurrentParties(): Live<{ parties: Party[]; active: Party | null }> {
  const activeId = useActivePartyId()
  const parties = useMyParties(currentEdition()?.id ?? null)
  const active = parties.data.find((p) => p.id === activeId) ?? parties.data[0] ?? null
  return { data: { parties: parties.data, active }, loading: parties.loading, error: parties.error }
}

/**
 * Profils utiles à l'affichage d'une party : ses membres, plus les auteurs et cibles du journal
 * (un ancien membre, le super admin). Les profils ne sont pas listables : on les lit par uid.
 */
export function usePartyUsers(partyId: string | null): Live<Record<string, UserProfile>> {
  const members = useMembers(partyId)
  const events = usePartyEvents(partyId)
  const uids = new Set(members.data.map((m) => m.uid))
  for (const e of events.data) {
    uids.add(e.by)
    if (e.type === 'owner') {
      uids.add(e.from)
      uids.add(e.to)
    }
  }
  return useUsers([...uids])
}
