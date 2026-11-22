import { useState } from 'react'
import { applyUpdate, useUpdateReady } from '../lib'
import { ToastIcon } from './Toast'
import './Toast.css'

/**
 * « Nouvelle version disponible » après un déploiement, avec un bouton « Mettre à jour ».
 * Reste affiché tant qu'on n'a pas mis à jour : c'est une action, pas une simple confirmation.
 */
export function UpdateToast() {
  const ready = useUpdateReady()
  const [busy, setBusy] = useState(false)

  function update() {
    setBusy(true)
    void applyUpdate()
    // Filet : si le nouveau service worker ne prend pas la main, on recharge quand même.
    window.setTimeout(() => window.location.reload(), 4000)
  }

  return (
    <div className="toast-region toast-region--top" role="status" aria-live="polite">
      {ready && (
        <div className="toast toast--info toast--action">
          <ToastIcon tone="info" />
          <span className="toast__text">Nouvelle version disponible</span>
          <button type="button" className="toast__button" disabled={busy} onClick={update}>
            {busy ? 'Un instant…' : 'Mettre à jour'}
          </button>
        </div>
      )}
    </div>
  )
}
