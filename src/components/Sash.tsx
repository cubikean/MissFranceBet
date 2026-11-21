import type { CSSProperties } from 'react'
import './Sash.css'

export type SashVariant = 'default' | 'eliminated' | 'winner' | 'mine'
export type SashSize = 'sm' | 'md' | 'lg'

export interface SashProps {
  /** Texte de l'écharpe, en casse normale (« Bretagne », « Mon prono ») : les capitales viennent du CSS. */
  region: string
  /** default : bleu marine · eliminated : gris, barrée, décrochée · winner : or + liseré · mine : liseré Strass */
  variant?: SashVariant
  size?: SashSize
  /** Décalage (ms) de l'animation de changement d'état, pour enchaîner les écharpes (60 ms entre chaque). */
  delay?: number
  className?: string
}

const STATUS_TEXT: Partial<Record<SashVariant, string>> = {
  eliminated: ', éliminée',
  winner: ', élue',
}

/**
 * L'écharpe de Miss : élément signature de l'app (voir docs/DESIGN.md).
 * Bande en diagonale à -12°, nom de la région en capitales condensées.
 */
export function Sash({ region, variant = 'default', size = 'md', delay = 0, className }: SashProps) {
  const style = { '--sash-delay': `${delay}ms` } as CSSProperties
  const status = STATUS_TEXT[variant]
  return (
    <span
      className={['sash', `sash--${variant}`, `sash--${size}`, className].filter(Boolean).join(' ')}
      style={style}
    >
      <span className="sash__band">
        <span className="sash__text">{region}</span>
        {status && <span className="visually-hidden">{status}</span>}
      </span>
    </span>
  )
}
