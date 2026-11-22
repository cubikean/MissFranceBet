import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource/bricolage-grotesque/400.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/barlow-condensed/700.css'
import './styles/tokens.css'
import './styles/base.css'
import { App } from './App'
import { ErrorBoundary, reloadOnce } from './components/ErrorBoundary'
import { captureInstallPrompt, setUpdateReady, watchForUpdates } from './lib/pwa'

// Invite d'installation Android : à capter dès le chargement, avant la connexion.
captureInstallPrompt()

// Un fichier JS d'une ancienne version a disparu après un déploiement : on recharge.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnce()
})

// Service worker : la nouvelle version attend, l'app propose de mettre à jour (UpdateToast).
const updateSW = registerSW({
  onNeedRefresh() {
    setUpdateReady(() => updateSW(true))
  },
  onRegisteredSW(_url, registration) {
    if (registration) watchForUpdates(registration)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
