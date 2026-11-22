import { Component, type ErrorInfo, type ReactNode } from 'react'
import '../styles/ui.css'
import './ErrorBoundary.css'

const RELOAD_KEY = 'pronos-miss:auto-reload-at'
const RELOAD_GUARD_MS = 10_000

/**
 * Recharge la page, une fois : si un rechargement automatique a déjà eu lieu il y a moins de
 * 10 s, on s'abstient (évite une boucle si le problème persiste). Renvoie true si on recharge.
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_GUARD_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // stockage indisponible : on recharge quand même
  }
  window.location.reload()
  return true
}

/** Filet de sécurité global : un écran clair plutôt qu'une page blanche si un écran plante. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] écran planté', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page crash stack" aria-labelledby="crash-title">
        <h1 id="crash-title">Oups, quelque chose a planté</h1>
        <p>L'écran n'a pas pu s'afficher. Recharge l'app&nbsp;: ton prono et ta party sont bien enregistrés.</p>
        <button type="button" className="button button--action crash__button" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </main>
    )
  }
}
