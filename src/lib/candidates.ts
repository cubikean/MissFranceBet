// Candidates embarquées dans l'app (src/data/editions/<e>/candidates.json) : pas de Firestore.
import type { Candidate, CandidatesFile } from './types'

const files = import.meta.glob<CandidatesFile>('../data/editions/*/candidates.json', {
  eager: true,
  import: 'default',
})

const BY_EDITION = new Map<string, Candidate[]>(
  Object.values(files).map((f) => [f.editionId, [...f.candidates].sort((a, b) => a.order - b.order)]),
)

/** Candidates d'une édition, triées par `order` ([] si l'édition n'est pas embarquée). */
export function listCandidates(editionId: string | null | undefined): Candidate[] {
  return (editionId && BY_EDITION.get(editionId)) || []
}

/** Une candidate (null si inconnue pour cette édition). */
export function getCandidate(editionId: string | null | undefined, candidateId: string | null | undefined): Candidate | null {
  return listCandidates(editionId).find((c) => c.id === candidateId) ?? null
}

/** "Miss Bretagne" */
export function missLabel(candidate: Pick<Candidate, 'region'>): string {
  return `Miss ${candidate.region}`
}
