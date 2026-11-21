import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'
import { useSnapshot } from './live'
import type { Candidate, CandidatesFile, Live } from './types'

/** Candidates de l'édition, triées par `order`. */
export function useCandidates(editionId: string | null): Live<Candidate[]> {
  const { user } = useAuth()
  return useSnapshot<Candidate[]>(
    user && editionId ? `editions/${editionId}/candidates` : null,
    (next, fail) =>
      onSnapshot(
        query(collection(db, 'editions', editionId!, 'candidates'), orderBy('order')),
        (s) => next(s.docs.map((d) => ({ ...(d.data() as Candidate), id: d.id }))),
        fail,
      ),
    [],
  )
}

const bundled = import.meta.glob<CandidatesFile>('../data/editions/*/candidates.json', {
  eager: true,
  import: 'default',
})

/** Fichiers candidates.json embarqués dans le build (pour l'import admin), par id d'édition. */
export function bundledCandidateFiles(): Record<string, CandidatesFile> {
  return Object.fromEntries(Object.values(bundled).map((f) => [f.editionId, f]))
}

/** "Miss Bretagne" */
export function missLabel(candidate: Pick<Candidate, 'region'>): string {
  return `Miss ${candidate.region}`
}
