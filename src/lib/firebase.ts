import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const env = import.meta.env

export const usingEmulators = env.VITE_USE_EMULATORS === 'true'

const projectId = env.VITE_FIREBASE_PROJECT_ID || (usingEmulators ? 'demo-pronos-miss' : '')

if (!projectId) {
  console.error(
    'Firebase non configuré : copie .env.example en .env.local et remplis les VITE_FIREBASE_*.',
  )
}

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.web.app`,
  projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

// App Check (gratuit) : Firebase refuse les requêtes qui ne viennent pas de cette app (bots, scripts).
// Actif seulement si VITE_RECAPTCHA_SITE_KEY est renseignée ; l'appliquer se fait ensuite dans la
// console (App Check > Firestore > Appliquer). Désactivé avec les émulateurs.
// En local contre le vrai projet : VITE_APPCHECK_DEBUG=true, puis enregistre le jeton de débogage
// affiché dans la console du navigateur (console Firebase > App Check > Gérer les jetons de débogage).
if (!usingEmulators && env.VITE_RECAPTCHA_SITE_KEY) {
  if (env.VITE_APPCHECK_DEBUG === 'true') {
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
auth.languageCode = 'fr'

// Cache local persistant : l'app reste lisible hors ligne (PWA).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
