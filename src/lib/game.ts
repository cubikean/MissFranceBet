// Fonctions pures de la logique de jeu (testées dans game.test.ts, sans Firebase).
import type { CandidateStatus, Party, Pick, Results, Trophy } from './types'

export const EMPTY_RESULTS: Results = {
  top15: null,
  top5: null,
  winner: null,
  firstRunnerUp: null,
  secondRunnerUp: null,
  updatedAt: null,
}

/** Le podium est considéré comme saisi dès que la gagnante l'est. */
export function hasPodium(results: Results | null): boolean {
  return !!results?.winner
}

/**
 * Statut d'une candidate pour l'affichage (voir SPEC.md) :
 * open → neutral ; fermé → inRace, puis éliminée selon top 15 / top 5 / podium.
 */
export function candidateStatus(
  candidateId: string,
  party: { status: Party['status'] } | null,
  results: Results | null,
): CandidateStatus {
  if (!party || party.status === 'open') return 'neutral'
  const r = results ?? EMPTY_RESULTS
  if (hasPodium(r)) {
    if (r.winner === candidateId) return 'winner'
    if (r.firstRunnerUp === candidateId) return 'firstRunnerUp'
    if (r.secondRunnerUp === candidateId) return 'secondRunnerUp'
    return 'eliminated'
  }
  if (r.top5 && r.top5.length > 0) return r.top5.includes(candidateId) ? 'inRace' : 'eliminated'
  if (r.top15 && r.top15.length > 0) return r.top15.includes(candidateId) ? 'inRace' : 'eliminated'
  return 'inRace'
}

/** Trophée gagné par un prono : or si élue, argent si 1re dauphine, bronze si 2e dauphine. */
export function trophyFor(
  pick: { candidateId: Pick['candidateId'] } | null,
  results: Results | null,
): Trophy | null {
  if (!pick || !results) return null
  if (results.winner && results.winner === pick.candidateId) return 'gold'
  if (results.firstRunnerUp && results.firstRunnerUp === pick.candidateId) return 'silver'
  if (results.secondRunnerUp && results.secondRunnerUp === pick.candidateId) return 'bronze'
  return null
}

export function isEliminated(status: CandidateStatus): boolean {
  return status === 'eliminated'
}

/** Durée approximative de l'émission (pour « En direct »). */
export const SHOW_DURATION_MS = 4 * 60 * 60 * 1000
/** Le badge « En direct » apparaît une heure avant le début de l'émission. */
export const LIVE_LEAD_MS = 60 * 60 * 1000

/**
 * true si l'émission est en cours ou commence dans l'heure (badge « En direct »).
 * Faux avant (répétition, pronos fermés en avance) et après la fin de l'émission.
 */
export function isShowLive(showAt: Date | null | undefined, now: Date): boolean {
  if (!showAt) return false
  const t = now.getTime() - showAt.getTime()
  return t >= -LIVE_LEAD_MS && t < SHOW_DURATION_MS
}
