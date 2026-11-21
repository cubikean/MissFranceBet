// Libellés et correspondances d'affichage partagés par les écrans joueur.
import type { CandidateStatus } from '../lib'
import type { SashVariant } from './Sash'

/** Variante d'écharpe pour un statut : or pour l'élue, grise pour une éliminée. */
export function sashVariant(status: CandidateStatus, mine = false): SashVariant {
  if (status === 'winner') return 'winner'
  if (status === 'eliminated') return 'eliminated'
  return mine ? 'mine' : 'default'
}

/** Libellé court du statut, en casse normale (null = rien à dire, pronos ouverts). */
export function statusLabel(status: CandidateStatus): string | null {
  switch (status) {
    case 'inRace':
      return 'En course'
    case 'eliminated':
      return 'Éliminée'
    case 'winner':
      return 'Élue'
    case 'firstRunnerUp':
      return '1re dauphine'
    case 'secondRunnerUp':
      return '2e dauphine'
    default:
      return null
  }
}

export const TROPHY_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const
export const TROPHY_LABEL = { gold: 'Élue', silver: '1re dauphine', bronze: '2e dauphine' } as const

export const PHASE_LABEL = {
  open: 'Pronos ouverts',
  closed: 'Pronos fermés',
  finished: 'Terminée',
} as const

/** Heure courte en français : « 21h04 ». */
export function formatTime(date: Date | null): string {
  if (!date) return ''
  const h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}h${m}`
}

/** Date et heure courtes : « sam. 12 déc. à 21h04 ». */
export function formatDateTime(date: Date | null): string {
  if (!date) return ''
  const day = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} à ${formatTime(date)}`
}
