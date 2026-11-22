import { useEffect } from 'react'
import './Toast.css'

/**
 * Message de confirmation éphémère (« Miss Bretagne choisie »), annoncé aux lecteurs d'écran.
 * Disparaît seul après `duration` ms ; `onDone` remet le message à null.
 */
export function Toast({
  message,
  onDone,
  duration = 3500,
}: {
  message: string | null
  onDone: () => void
  duration?: number
}) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDone, duration)
    return () => window.clearTimeout(t)
  }, [message, onDone, duration])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <p className="toast" key={message}>
          <span className="toast__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5 10 17.5 19 7" />
            </svg>
          </span>
          <span className="toast__text">{message}</span>
        </p>
      )}
    </div>
  )
}
