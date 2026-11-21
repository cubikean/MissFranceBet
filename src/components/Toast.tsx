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
          {message}
        </p>
      )}
    </div>
  )
}
