import { useId, useRef, useState } from 'react'
import { errorMessage, photoFromFile } from '../lib'
import { Avatar } from './Avatar'
import './PhotoPicker.css'

/**
 * Photo de profil facultative : aperçu rond, « Choisir une photo » (galerie ou appareil photo),
 * « Retirer la photo ». La photo est recadrée et compressée dans le navigateur (photoFromFile).
 */
export function PhotoPicker({
  value,
  name,
  onChange,
  disabled,
}: {
  /** data URL actuelle, null = pas de photo */
  value: string | null
  /** pseudo, pour l'initiale de l'aperçu */
  name: string
  onChange: (photo: string | null) => void
  disabled?: boolean
}) {
  const browseRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const browseId = useId()
  const cameraId = useId()
  // capture="user" n'ouvre l'appareil photo que sur mobile ; sur ordinateur il ouvrirait
  // l'explorateur de fichiers, d'où un seul bouton « Parcourir » sans écran tactile.
  const [canCapture] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await photoFromFile(file))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      if (browseRef.current) browseRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  return (
    <fieldset className="photo-picker" disabled={disabled || busy}>
      <legend className="photo-picker__legend">
        Ta photo <span className="muted">(facultatif)</span>
      </legend>
      <div className="photo-picker__row">
        <Avatar size="lg" photo={value} name={name} />
        <div className="photo-picker__actions">
          {busy && (
            <p className="muted" role="status">
              Préparation de la photo…
            </p>
          )}
          <input
            ref={browseRef}
            id={browseId}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <label htmlFor={browseId} className="button button--ghost photo-picker__choose">
            Parcourir
          </label>
          {canCapture && (
            <>
              <input
                ref={cameraRef}
                id={cameraId}
                type="file"
                accept="image/*"
                capture="user"
                className="visually-hidden"
                onChange={(e) => void pick(e.target.files?.[0])}
              />
              <label htmlFor={cameraId} className="button button--ghost photo-picker__choose">
                Prendre une photo
              </label>
            </>
          )}
          {value && (
            <button type="button" className="button button--ghost" onClick={() => onChange(null)}>
              Retirer la photo
            </button>
          )}
        </div>
      </div>
      <p className="muted photo-picker__help">
        Sans photo, tes amis verront l'initiale de ton pseudo. Elle n'est visible que des joueurs de tes parties.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
