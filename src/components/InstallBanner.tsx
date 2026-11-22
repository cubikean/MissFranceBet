import { useState } from 'react'
import { promptInstall, useInstallPrompt } from '../lib'
import './InstallBanner.css'

const DISMISS_KEY = 'pronos-miss:install-dismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS
  )
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // stockage indisponible : le bandeau reviendra au prochain chargement
  }
}

/**
 * Bandeau « Installer l'app » : prompt natif sur Android (beforeinstallprompt, capté dès le
 * chargement dans main.tsx), tuto en 3 étapes sur iOS Safari. Masqué en mode installé et une fois fermé.
 */
export function InstallBanner() {
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed())
  const [ios] = useState(isIos)
  const { prompt, installed } = useInstallPrompt()

  function close() {
    rememberDismiss()
    setHidden(true)
  }

  async function install() {
    if ((await promptInstall()) === 'accepted') close()
  }

  // Ni iOS ni prompt natif disponible (desktop, Firefox…) : rien à proposer.
  if (hidden || installed || (!ios && !prompt)) return null

  return (
    <aside className="install" aria-labelledby="install-title">
      <div className="install__head">
        <h2 id="install-title" className="install__title">
          Installe l'app sur ton téléphone
        </h2>
        <button type="button" className="install__close" onClick={close} aria-label="Fermer le bandeau d'installation">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      {ios ? (
        <ol className="install__steps">
          <li>Ouvre cette page dans Safari.</li>
          <li>
            Touche le bouton Partager
            <svg className="install__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
            </svg>
          </li>
          <li>Choisis «&nbsp;Sur l'écran d'accueil&nbsp;», puis «&nbsp;Ajouter&nbsp;».</li>
        </ol>
      ) : (
        <>
          <p>Tu la retrouveras sur ton écran d'accueil le soir de l'émission.</p>
          <button type="button" className="button" onClick={() => void install()}>
            Installer l'app
          </button>
        </>
      )}
    </aside>
  )
}
