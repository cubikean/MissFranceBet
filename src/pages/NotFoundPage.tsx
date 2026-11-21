import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="page" aria-labelledby="notfound-title">
      <h1 id="notfound-title">Page introuvable</h1>
      <p className="muted">Cette page n'existe pas. Reviens à l'accueil.</p>
      <p style={{ marginTop: 'var(--space-5)' }}>
        <Link to="/" className="button">
          Retour à l'accueil
        </Link>
      </p>
    </section>
  )
}
