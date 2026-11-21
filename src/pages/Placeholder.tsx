import type { ReactNode } from 'react'

/** Page provisoire : à remplacer par le vrai écran (voir docs/SPEC.md, section Écrans). */
export function Placeholder({ title, route, children }: { title: string; route: string; children?: ReactNode }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="muted">
        Écran <code>{route}</code> à construire.
      </p>
      {children}
    </section>
  )
}
