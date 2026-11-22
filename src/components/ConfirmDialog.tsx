import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Conséquences, en clair (« Tu ne verras plus les pronos de cette party. ») */
  children: ReactNode
  /** Le même verbe que le bouton qui a ouvert la fenêtre : « Quitter la party » */
  confirmLabel: string
  cancelLabel?: string
  /**
   * Double confirmation à la GitHub : le bouton reste désactivé tant que la saisie
   * ne correspond pas (`matches`). La phrase est affichée au-dessus du champ.
   */
  requirePhrase?: { phrase: string; matches: (typed: string) => boolean }
  /** Peut être async : la fenêtre affiche l'attente, puis l'erreur éventuelle, sans se fermer. */
  onConfirm: (typed: string) => void | Promise<void>
  onCancel: () => void
}

/**
 * Fenêtre de confirmation partagée (quitter, retirer, changer le code, supprimer…).
 * <dialog> natif : focus piégé, Échap = annuler, fond inerte.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Annuler',
  requirePhrase,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTyped('')
      setError(null)
      setBusy(false)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const allowed = !busy && (!requirePhrase || requirePhrase.matches(typed))

  async function confirm() {
    if (!allowed) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(typed)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <form
        method="dialog"
        className="confirm__body"
        onSubmit={(e) => {
          e.preventDefault()
          void confirm()
        }}
      >
        <h2 id={titleId} className="confirm__title">
          {title}
        </h2>
        <div className="confirm__text">{children}</div>

        {requirePhrase && (
          <div className="confirm__phrase">
            <label htmlFor={inputId}>
              Pour confirmer, recopie&nbsp;: <strong>{requirePhrase.phrase}</strong>
            </label>
            <input
              id={inputId}
              className="confirm__input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={busy}
            />
          </div>
        )}

        {error && (
          <p className="confirm__error" role="alert">
            {error}
          </p>
        )}

        <div className="confirm__actions">
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="submit" className="button" disabled={!allowed} aria-busy={busy}>
            {busy ? 'Un instant…' : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
