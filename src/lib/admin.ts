import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'
import { useSnapshot } from './live'
import { normalizeCode } from './editions'
import type { CandidatesFile, EditionStatus, Live, Results } from './types'

/** true si admins/{uid} existe (document créé à la main dans la console). */
export function useIsAdmin(): Live<boolean> {
  const { user } = useAuth()
  return useSnapshot<boolean>(
    user ? `admins/${user.uid}` : null,
    (next, fail) => onSnapshot(doc(db, 'admins', user!.uid), (s) => next(s.exists()), fail),
    false,
  )
}

/** Crée une édition (statut open) et son code de soirée. id conseillé : l'année, ex. "2027". */
export async function createEdition(input: {
  id: string
  title: string
  showAt: Date
  code: string
}): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, 'editions', input.id), {
    title: input.title,
    showAt: Timestamp.fromDate(input.showAt),
    status: 'open',
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'editionSecrets', input.id), { code: normalizeCode(input.code) })
  await batch.commit()
}

/** Modifie le titre et/ou la date d'émission. */
export async function updateEdition(
  editionId: string,
  patch: { title?: string; showAt?: Date },
): Promise<void> {
  await updateDoc(doc(db, 'editions', editionId), {
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.showAt !== undefined && { showAt: Timestamp.fromDate(patch.showAt) }),
  })
}

/** Change le code de soirée (normalisé : majuscules, sans espaces, 4 caractères minimum). */
export async function setEditionCode(editionId: string, code: string): Promise<void> {
  await setDoc(doc(db, 'editionSecrets', editionId), { code: normalizeCode(code) })
}

/** Importe (ou réimporte) les candidates d'un fichier candidates.json. */
export async function importCandidates(editionId: string, file: CandidatesFile): Promise<number> {
  const batch = writeBatch(db)
  for (const c of file.candidates) {
    batch.set(doc(db, 'editions', editionId, 'candidates', c.id), c)
  }
  await batch.commit()
  return file.candidates.length
}

/** Change de phase (retour en arrière autorisé). */
export async function setStatus(editionId: string, status: EditionStatus): Promise<void> {
  await updateDoc(doc(db, 'editions', editionId), { status })
}

/** Saisit tout ou partie des résultats (fusion). Passe null pour effacer un champ. */
export async function setResults(
  editionId: string,
  patch: Partial<Omit<Results, 'updatedAt'>>,
): Promise<void> {
  await setDoc(
    doc(db, 'editions', editionId, 'results', 'live'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
