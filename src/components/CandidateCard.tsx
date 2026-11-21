import { Link } from 'react-router'
import { missLabel, type Candidate, type CandidateStatus } from '../lib'
import { Sash } from './Sash'
import { sashVariant, statusLabel } from './display'
import './CandidateCard.css'

/**
 * Carte d'une candidate : portrait (recadré par le haut), nom, région, statut.
 * Partagée par la grille /candidates et l'accueil (mon prono).
 * `sash` : 'corner' = petite écharpe « Mon prono » en haut à gauche (grille) ;
 * 'band' = écharpe sur toute la largeur, au centre de la photo (mise en avant, accueil).
 */
export function CandidateCard({
  candidate,
  status = 'neutral',
  mine = false,
  showStatus = false,
  sash = 'corner',
  className,
}: {
  candidate: Candidate
  status?: CandidateStatus
  mine?: boolean
  showStatus?: boolean
  sash?: 'corner' | 'band'
  className?: string
}) {
  const label = showStatus ? statusLabel(status) : null
  return (
    <Link
      to={`/candidates/${candidate.id}`}
      className={[
        'candidate-card',
        mine && 'candidate-card--mine',
        status === 'eliminated' && 'candidate-card--out',
        status === 'winner' && 'candidate-card--winner',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="candidate-card__photo">
        <img src={candidate.photo} alt="" loading="lazy" decoding="async" width="600" height="1066" />
        {mine && sash === 'corner' && (
          <Sash region="Mon prono" variant="mine" size="sm" className="candidate-card__sash" />
        )}
        {mine && sash === 'band' && (
          <Sash region="Mon prono" variant={sashVariant(status, true)} size="lg" className="candidate-card__band" />
        )}
      </span>
      <span className="candidate-card__name">{candidate.name}</span>
      <span className="candidate-card__region">
        {missLabel(candidate)}
        {label && <span className="candidate-card__status">, {label.toLowerCase()}</span>}
        {mine && <span className="visually-hidden">, ton prono</span>}
      </span>
    </Link>
  )
}
