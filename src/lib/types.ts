// Types partagés de l'app. Les dates Firestore (Timestamp) sont converties en Date.
// Attention : `Pick` masque l'utilitaire TypeScript Pick<T, K> là où il est importé.

export type EditionStatus = 'open' | 'closed' | 'finished'

/** editions/{id} */
export interface Edition {
  id: string
  title: string
  showAt: Date
  status: EditionStatus
  createdAt: Date | null
}

/** editions/{e}/candidates/{id} — champs de src/data/editions/<e>/candidates.json */
export interface Candidate {
  id: string
  order: number
  region: string
  name: string
  age: number | null
  heightM: number | null
  origin: string | null
  job: string | null
  passions: string | null
  instagram: string
  photo: string
  photoFull: string
}

/** Format du fichier src/data/editions/<e>/candidates.json */
export interface CandidatesFile {
  editionId: string
  candidates: Candidate[]
}

/** editions/{e}/members/{uid} (aucun code stocké : voir joinProofs dans firestore.rules) */
export interface Membership {
  uid: string
  joinedAt: Date | null
  hasPicked: boolean
}

/** editions/{e}/picks/{uid} */
export interface Pick {
  uid: string
  candidateId: string
  /** 1 au premier choix, +1 à chaque changement d'avis */
  changeCount: number
  updatedAt: Date | null
}

/** editions/{e}/pickHistory/{uid}_{changeCount} */
export interface PickHistoryEntry {
  id: string
  uid: string
  candidateId: string
  changeCount: number
  at: Date | null
}

/** editions/{e}/results/live — null = pas encore saisi */
export interface Results {
  top15: string[] | null
  top5: string[] | null
  winner: string | null
  firstRunnerUp: string | null
  secondRunnerUp: string | null
  updatedAt: Date | null
}

/** users/{uid} */
export interface UserProfile {
  uid: string
  displayName: string
  displayNameLower: string
  emoji: string
  createdAt: Date | null
}

export type CandidateStatus =
  | 'neutral' // pronos ouverts
  | 'inRace'
  | 'eliminated'
  | 'winner'
  | 'firstRunnerUp'
  | 'secondRunnerUp'

export type Trophy = 'gold' | 'silver' | 'bronze'

/** Valeur temps réel renvoyée par tous les hooks de données. */
export interface Live<T> {
  data: T
  loading: boolean
  error: Error | null
}
