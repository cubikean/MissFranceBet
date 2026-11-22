import { useEffect } from 'react'
import './Toast.css'

export type ToastTone = 'success' | 'info'

/** Pastille du toast : coche verte (succès) ou « i » bleu marine (information). */
export function ToastIcon({ tone }: { tone: ToastTone }) {
  return (
    <span className="toast__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round">
        {tone === 'success' ? <path d="M5 12.5 10 17.5 19 7" /> : <path d="M12 11v6M12 7h.01" />}
      </svg>
    </span>
  )
}

/**
 * Message éphémère, annoncé aux lecteurs d'écran. `tone` : 'success' (« Miss Bretagne choisie »,
 * vert) ou 'info' (message neutre, « Tu ne fais plus partie de la party… »).
 * Disparaît seul après `duration` ms ; `onDone` remet le message à null.
 */
export function Toast({
  message,
  onDone,
  duration = 3500,
  tone = 'success',
}: {
  message: string | null
  onDone: () => void
  duration?: number
  tone?: ToastTone
}) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDone, duration)
    return () => window.clearTimeout(t)
  }, [message, onDone, duration])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <p className={`toast toast--${tone}`} key={message}>
          <ToastIcon tone={tone} />
          <span className="toast__text">{message}</span>
        </p>
      )}
    </div>
  )
}
