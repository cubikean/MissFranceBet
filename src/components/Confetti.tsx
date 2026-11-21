import { useState, type CSSProperties } from 'react'
import './Confetti.css'

const COLORS = ['var(--color-or)', 'var(--color-strass)', 'var(--color-echarpe)', 'var(--color-satin)']
const COUNT = 48

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Une seule pluie de confettis (podium final). Rien si `prefers-reduced-motion`. */
export function Confetti() {
  // Positions tirées une fois au montage : la pluie ne se rejoue pas à chaque rendu.
  const [pieces] = useState(() =>
    reducedMotion()
      ? []
      : Array.from({ length: COUNT }, (_, i) => ({
          left: Math.random() * 100,
          delay: Math.random() * 700,
          duration: 2200 + Math.random() * 1600,
          drift: (Math.random() - 0.5) * 120,
          spin: 360 + Math.random() * 720,
          color: COLORS[i % COLORS.length],
        })),
  )
  if (pieces.length === 0) return null
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti__piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
