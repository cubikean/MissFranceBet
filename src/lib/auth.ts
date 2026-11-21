import { useSyncExternalStore } from 'react'
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from './firebase'
import { AppError } from './errors'

export interface AuthState {
  user: User | null
  /** true tant que Firebase n'a pas restauré la session */
  loading: boolean
  /** erreur éventuelle au retour d'un signInWithRedirect */
  error: Error | null
}

let state: AuthState = { user: null, loading: true, error: null }
const listeners = new Set<() => void>()
let started = false

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function start() {
  if (started) return
  started = true
  onAuthStateChanged(auth, (user) => setState({ user, loading: false }))
  getRedirectResult(auth).catch((error: Error) => setState({ error }))
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Utilisateur Firebase courant, en temps réel. */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state)
}

/** uid courant, ou erreur si personne n'est connecté (pour les fonctions d'écriture). */
export function requireUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new AppError('not-signed-in', 'Connecte-toi pour continuer.')
  return uid
}

/** Mobile ou app installée : la popup y est peu fiable (iOS standalone surtout). */
export function prefersRedirect(): boolean {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS
  return standalone || mobile
}

/** Google : redirect sur mobile/standalone, popup ailleurs (avec repli sur redirect si bloquée). */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  if (prefersRedirect()) {
    await signInWithRedirect(auth, provider)
    return
  }
  try {
    await signInWithPopup(auth, provider)
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider)
      return
    }
    throw error
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email.trim(), password)
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

/** Envoie l'email Firebase natif de réinitialisation (en français). */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim())
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth)
}
