// Types partagés de l'app. Les dates Firestore (Timestamp) sont converties en Date.
// Attention : `Pick` masque l'utilitaire TypeScript Pick<T, K> là où il est importé.

/** Édition = une année de Miss France. Embarquée dans l'app : src/data/editions/<id>/edition.json */
export interface Edition {
  id: string
  title: string
  showAt: Date
}

/** Format de src/data/editions/<id>/edition.json */
export interface EditionFile {
  editionId: string
  title: string
  /** ISO 8601 avec fuseau, ex. "2026-12-12T21:10:00+01:00" */
  showAt: string
}

/** Candidate embarquée : src/data/editions/<e>/candidates.json */
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

export type PartyStatus = 'open' | 'closed' | 'finished'

/** parties/{id} : un groupe d'amis pour une édition. Son créateur (ownerUid) en est l'admin. */
export interface Party {
  id: string
  editionId: string
  name: string
  ownerUid: string
  /** Code d'invitation (6 caractères), lisible par les membres. */
  code: string
  status: PartyStatus
  /** Nombre de changements de phase (= nombre d'entrées dans events). */
  statusChanges: number
  createdAt: Date | null
}

/** parties/{p}/members/{uid} */
export interface Membership {
  uid: string
  partyId: string
  editionId: string
  joinedAt: Date | null
  hasPicked: boolean
}

/** parties/{p}/events/{n} : journal des changements de phase, immuable, visible des membres. */
export interface PartyEvent {
  n: number
  from: PartyStatus
  to: PartyStatus
  /** uid de l'admin (ou du super admin) qui a changé la phase */
  by: string
  at: Date | null
}

/** parties/{p}/picks/{uid} */
export interface Pick {
  uid: string
  candidateId: string
  /** 1 au premier choix, +1 à chaque changement d'avis */
  changeCount: number
  updatedAt: Date | null
}

/** parties/{p}/pickHistory/{uid}_{changeCount} */
export interface PickHistoryEntry {
  id: string
  uid: string
  candidateId: string
  changeCount: number
  at: Date | null
}

/** parties/{p}/results/live — null = pas encore saisi */
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
