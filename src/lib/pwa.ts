// PWA : mise à jour de l'app après un déploiement, et invite d'installation native (Android).
// Pas de Firebase ici. L'enregistrement du service worker se fait dans main.tsx (virtual:pwa-register),
// qui branche ces petits stores.
import { useSyncExternalStore } from 'react'

function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
}

// ---------- Mise à jour ----------

/** Une heure : fréquence de vérification d'une nouvelle version quand l'app reste ouverte. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000

/** Fonction qui active la nouvelle version (le service worker en attente) puis recharge la page. */
const updateStore = createStore<(() => Promise<void>) | null>(null)

/** Appelé quand une nouvelle version est installée et attend : `apply` l'active et recharge. */
export function setUpdateReady(apply: () => Promise<void>): void {
  updateStore.set(apply)
}

/** true quand une nouvelle version attend (afficher « Nouvelle version disponible »). */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(updateStore.subscribe, () => updateStore.get() !== null, () => false)
}

/** Active la nouvelle version et recharge la page. Sans effet s'il n'y en a pas. */
export async function applyUpdate(): Promise<void> {
  await updateStore.get()?.()
}

/**
 * Peut-on recharger sans prévenir (au retour au premier plan) ? Jamais sur la saisie des
 * résultats, ni quand un champ de saisie a le focus ou qu'une fenêtre de confirmation est ouverte.
 */
export function canReloadSilently(context: { pathname: string; focusedTag?: string | null; dialogOpen?: boolean }): boolean {
  if (context.pathname.startsWith('/soiree/gestion')) return false
  if (context.dialogOpen) return false
  if (context.focusedTag && /^(INPUT|TEXTAREA|SELECT)$/i.test(context.focusedTag)) return false
  return true
}

function currentContext() {
  return {
    pathname: window.location.pathname,
    focusedTag: document.activeElement?.tagName ?? null,
    dialogOpen: !!document.querySelector('dialog[open]'),
  }
}

/**
 * Cherche une nouvelle version au retour au premier plan et toutes les heures. Si une version
 * attend déjà au retour au premier plan et qu'aucune saisie n'est en cours, recharge tout de suite
 * (une PWA iOS reprise depuis l'arrière-plan ne recharge jamais d'elle-même).
 */
export function watchForUpdates(registration: ServiceWorkerRegistration): () => void {
  const check = () => {
    if (navigator.onLine === false) return
    registration.update().catch(() => undefined) // hors ligne, serveur injoignable : on réessaiera
  }
  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return
    if (updateStore.get() && canReloadSilently(currentContext())) {
      void applyUpdate()
      return
    }
    check()
  }
  document.addEventListener('visibilitychange', onVisibility)
  const timer = window.setInterval(check, UPDATE_CHECK_MS)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.clearInterval(timer)
  }
}

// ---------- Installation (Android, Chrome) ----------

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const installStore = createStore<{ prompt: BeforeInstallPromptEvent | null; installed: boolean }>({
  prompt: null,
  installed: false,
})

let capturing = false

/**
 * Capte `beforeinstallprompt` dès le chargement (main.tsx) : l'événement arrive souvent à la
 * première visite, avant la connexion, donc avant que le bandeau d'installation soit monté.
 */
export function captureInstallPrompt(): void {
  if (capturing || typeof window === 'undefined') return
  capturing = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installStore.set({ ...installStore.get(), prompt: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => installStore.set({ prompt: null, installed: true }))
}

/** Invite native disponible (null sinon) et installation faite pendant cette visite. */
export function useInstallPrompt(): { prompt: BeforeInstallPromptEvent | null; installed: boolean } {
  return useSyncExternalStore(installStore.subscribe, installStore.get, installStore.get)
}

/** Affiche l'invite native. Renvoie le choix, ou null si aucune invite n'est disponible. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  const { prompt } = installStore.get()
  if (!prompt) return null
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  // Une invite ne sert qu'une fois.
  installStore.set({ prompt: null, installed: outcome === 'accepted' || installStore.get().installed })
  return outcome
}
