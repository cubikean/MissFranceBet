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

/**
 * Message d'erreur pour un code saisi (normalisé ou non), null s'il a le bon format.
 * 0/O et 1/I/L n'existent pas dans les codes : on le dit plutôt que de deviner.
 */
export function codeError(raw: string): string | null {
  const code = normalizeCode(raw)
  if (isValidCode(code)) return null
  if (/[0O1IL]/.test(code)) {
    return "Les codes n'utilisent jamais 0, O, 1, I ni L. Vérifie le code auprès de l'organisateur."
  }
  return `Le code fait ${CODE_LENGTH}\u00a0caractères (lettres et chiffres). Vérifie-le auprès de l'organisateur.`
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

// ---------- Party perdue (retrait, suppression) ----------

/** Message neutre affiché quand une de mes parties disparaît sans que je l'aie quittée. */
export interface PartyNotice {
  partyId: string
  message: string
}

let notice: PartyNotice | null = null
const noticeListeners = new Set<() => void>()
/** Parties déjà signalées, ou que je quitte / supprime moi-même : pas de message. */
const announced = new Set<string>()

function announceLost(party: Party, deleted: boolean): void {
  if (announced.has(party.id)) return
  announced.add(party.id)
  notice = {
    partyId: party.id,
    message: deleted
      ? `La party «\u00a0${party.name}\u00a0» a été supprimée.`
      : `Tu ne fais plus partie de la party «\u00a0${party.name}\u00a0».`,
  }
  noticeListeners.forEach((l) => l())
}

/**
 * À appeler juste avant de quitter ou de supprimer soi-même une party : pas de message.
 * `expected = false` annule (l'écriture a échoué).
 */
export function expectPartyExit(partyId: string, expected = true): void {
  if (expected) announced.add(partyId)
  else announced.delete(partyId)
}

/** Dernière party perdue (retrait par l'admin, suppression), à afficher une fois puis effacer. */
export function usePartyNotice(): PartyNotice | null {
  return useSyncExternalStore(
    (l) => {
      noticeListeners.add(l)
      return () => noticeListeners.delete(l)
    },
    () => notice,
    () => null,
  )
}

export function clearPartyNotice(): void {
  notice = null
  noticeListeners.forEach((l) => l())
}

/**
 * Mes parties (filtrées sur une édition si editionId est donné), les plus récentes d'abord.
 * Combine mes adhésions et un abonnement à chaque party.
 *
 * Une party devenue inaccessible (je suis retiré, elle est supprimée : mon adhésion disparaît,
 * refus des règles, document absent ou `status == 'deleted'`) sort simplement de la liste, avec un
 * message neutre (usePartyNotice) : jamais d'erreur pour toute la liste. Une adhésion pas encore
 * confirmée par le serveur (juste après une création ou une adhésion) attend sa confirmation avant
 * qu'on lise la party, sinon les règles refuseraient la lecture.
 *
 * Pourquoi un écouteur sur ma propre adhésion : Firestore ne réévalue pas les règles d'un écouteur
 * déjà ouvert quand un autre document change. Après un retrait, l'écouteur de la party et la requête
 * collection group peuvent continuer de servir l'ancien état ; members/{moi} (lisible par moi même
 * absent) reçoit, lui, la suppression.
 */
export function useMyParties(editionId?: string | null): Live<Party[]> {
  const { user } = useAuth()
  return useSnapshot<Party[]>(
    user ? `myParties/${user.uid}/${editionId ?? '*'}` : null,
    (next, fail) => {
      const parties = new Map<string, Party>()
      const inner = new Map<string, () => void>()
      /** Abonnements sans première réponse : on attend avant d'émettre. */
      const waiting = new Set<string>()
      /** Parties refusées par les règles : un seul nouvel essai, à la prochaine adhésion confirmée. */
      const refused = new Map<string, number>()
      /**
       * Parties perdues (supprimées, adhésion retirée) alors que la requête des adhésions les liste
       * encore : on ne les relit pas, sauf si l'adhésion change (je reviens avec le code).
       * Valeur : joinedAt (ms) de l'adhésion au moment de la perte.
       */
      const gone = new Map<string, number | null>()
      /** joinedAt (ms) de chaque adhésion listée. */
      const joinedAt = new Map<string, number | null>()
      let outerReady = false

      const emit = () => {
        if (!outerReady || waiting.size > 0) return
        next(
          [...parties.values()]
            .filter((p) => !editionId || p.editionId === editionId)
            .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
        )
      }
      const drop = (id: string, lost: 'removed' | 'deleted') => {
        inner.get(id)?.()
        inner.delete(id)
        waiting.delete(id)
        const party = parties.get(id)
        parties.delete(id)
        if (party) announceLost(party, lost === 'deleted')
      }
      const lose = (id: string, lost: 'removed' | 'deleted') => {
        gone.set(id, joinedAt.get(id) ?? null)
        drop(id, lost)
        emit()
      }
      const watch = (id: string) => {
        waiting.add(id)
        const party = onSnapshot(
          doc(db, 'parties', id),
          (p) => {
            const d = p.exists() ? p.data({ serverTimestamps: 'estimate' }) : null
            if (!d || isDeletedParty(d)) return lose(id, 'deleted')
            if (!parties.has(id)) announced.delete(id) // (re)vue : un futur retrait sera signalé
            parties.set(id, toParty(id, d))
            waiting.delete(id)
            emit()
          },
          (error) => {
            if (!isPermissionDenied(error)) {
              fail(error)
              return
            }
            refused.set(id, (refused.get(id) ?? 0) + 1)
            drop(id, 'removed')
            emit()
          },
        )
        const membership = onSnapshot(
          doc(db, 'parties', id, 'members', user!.uid),
          { includeMetadataChanges: true },
          (m) => {
            // Seule une absence confirmée par le serveur compte (pas le cache, pas une écriture locale).
            if (m.exists() || m.metadata.fromCache || m.metadata.hasPendingWrites) return
            lose(id, 'removed')
          },
          () => undefined, // l'écouteur de la party signale déjà les refus
        )
        inner.set(id, () => {
          party()
          membership()
        })
      }

      const outer = onSnapshot(
        query(collectionGroup(db, 'members'), where('uid', '==', user!.uid)),
        // Métadonnées : on est prévenu quand une adhésion locale est confirmée par le serveur.
        { includeMetadataChanges: true },
        (s) => {
          const ids = new Set<string>()
          const confirmed = new Set<string>()
          joinedAt.clear()
          for (const d of s.docs) {
            const data = d.data()
            if (editionId && data.editionId !== editionId) continue
            const id = d.ref.parent.parent!.id
            ids.add(id)
            joinedAt.set(id, toDate(data.joinedAt)?.getTime() ?? null)
            if (!d.metadata.hasPendingWrites) confirmed.add(id)
          }
          for (const id of [...inner.keys()]) if (!ids.has(id)) drop(id, 'removed')
          for (const id of [...refused.keys()]) if (!ids.has(id)) refused.delete(id)
          // Nouvelle adhésion (je reviens) : la party perdue peut être relue.
          for (const [id, at] of [...gone]) if (!ids.has(id) || joinedAt.get(id) !== at) gone.delete(id)
          for (const id of ids) {
            if (inner.has(id) || gone.has(id) || !confirmed.has(id)) continue
            if ((refused.get(id) ?? 0) >= 2) continue
            watch(id)
          }
          outerReady = true
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
