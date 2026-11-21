import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError } from './errors'
import { toDate, useSnapshot } from './live'
import type { Live, UserProfile } from './types'

export const USERNAME_MIN = 2
export const USERNAME_MAX = 20

/** Pseudo nettoyé : espaces en trop retirés. */
export function normalizeUsername(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Message d'erreur si le pseudo est invalide, sinon null (mêmes contraintes que les règles). */
export function usernameError(name: string): string | null {
  const n = normalizeUsername(name)
  const len = [...n].length
  if (len < USERNAME_MIN) return `Ton pseudo doit faire au moins ${USERNAME_MIN} caractères.`
  if (len > USERNAME_MAX) return `Ton pseudo doit faire au plus ${USERNAME_MAX} caractères.`
  if (n.includes('/')) return 'Ton pseudo ne peut pas contenir de « / ».'
  if (/^__.*__$/.test(n) || n === '.' || n === '..') return 'Choisis un autre pseudo.'
  return null
}

// ---------- Photo de profil ----------
// Pas de Firebase Storage (plan Blaze payant) : la photo est recadrée en carré, réduite et
// compressée dans le navigateur, puis rangée en data URL dans users/{uid}.photo (quelques
// dizaines de ko). Les règles imposent le format et PHOTO_MAX_CHARS.

/** Côté du carré, en pixels. */
export const PHOTO_SIZE = 256
/** Taille maximale de la data URL (aligné avec firestore.rules). */
export const PHOTO_MAX_CHARS = 100_000

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new AppError('photo-invalid', "Cette image ne s'ouvre pas. Essaie une photo en JPEG ou PNG."))
    }
    img.src = url
  })
}

/**
 * Transforme le fichier choisi en photo de profil : carré centré de PHOTO_SIZE px, WebP
 * (JPEG si le navigateur ne sait pas encoder en WebP, comme Safari), qualité réduite au besoin
 * pour tenir sous PHOTO_MAX_CHARS. Renvoie une data URL prête pour claimUsername / setProfilePhoto.
 */
export async function photoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new AppError('photo-invalid', 'Choisis une image (photo ou capture).')
  }
  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  if (!side) throw new AppError('photo-invalid', "Cette image ne s'ouvre pas. Essaie une autre photo.")
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_SIZE
  canvas.height = PHOTO_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AppError('photo-invalid', "Ton navigateur ne permet pas de préparer la photo.")
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  )
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    let data = canvas.toDataURL('image/webp', quality)
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', quality)
    if (data.length <= PHOTO_MAX_CHARS) return data
  }
  throw new AppError('photo-invalid', 'Cette photo est trop lourde. Essaie-en une autre.')
}

// ---------- Profil ----------

function toProfile(uid: string, d: DocumentData): UserProfile {
  return {
    uid,
    displayName: d.displayName,
    displayNameLower: d.displayNameLower,
    photo: typeof d.photo === 'string' ? d.photo : null,
    createdAt: toDate(d.createdAt),
  }
}

/**
 * Crée le profil (onboarding) ou change de pseudo, en réservant usernames/{pseudo en minuscules}
 * dans une transaction. Lève AppError('username-taken') si le pseudo est pris.
 * `photo` : data URL de photoFromFile, null = pas de photo ; undefined = inchangée (changement de pseudo).
 */
export async function claimUsername(displayName: string, photo?: string | null): Promise<void> {
  const uid = requireUid()
  const name = normalizeUsername(displayName)
  const invalid = usernameError(name)
  if (invalid) throw new AppError('username-invalid', invalid)
  const lower = name.toLowerCase()
  const nameRef = doc(db, 'usernames', lower)
  const userRef = doc(db, 'users', uid)

  await runTransaction(db, async (tx) => {
    const nameSnap = await tx.get(nameRef)
    const userSnap = await tx.get(userRef)
    if (nameSnap.exists() && nameSnap.data().uid !== uid) {
      throw new AppError('username-taken', `Le pseudo « ${name} » est déjà pris. Choisis-en un autre.`)
    }
    if (!userSnap.exists()) {
      tx.set(nameRef, { uid })
      tx.set(userRef, { displayName: name, displayNameLower: lower, photo: photo ?? null, createdAt: serverTimestamp() })
      return
    }
    const oldLower: string = userSnap.data().displayNameLower
    if (oldLower !== lower) {
      tx.delete(doc(db, 'usernames', oldLower))
      tx.set(nameRef, { uid })
    }
    tx.update(userRef, { displayName: name, displayNameLower: lower, ...(photo !== undefined && { photo }) })
  })
}

/** Change ou retire (null) la photo du profil courant. */
export async function setProfilePhoto(photo: string | null): Promise<void> {
  await updateDoc(doc(db, 'users', requireUid()), { photo })
}

/** Modifie pseudo et/ou photo du profil courant (le pseudo repasse par claimUsername). */
export async function updateProfile(
  current: UserProfile,
  patch: { displayName?: string; photo?: string | null },
): Promise<void> {
  if (patch.displayName !== undefined && normalizeUsername(patch.displayName) !== current.displayName) {
    await claimUsername(patch.displayName, patch.photo)
    return
  }
  if (patch.photo !== undefined && patch.photo !== current.photo) await setProfilePhoto(patch.photo)
}

/** Profil d'un utilisateur (par défaut : l'utilisateur connecté). null si pas encore créé. */
export function useProfile(uid?: string | null): Live<UserProfile | null> {
  const { user } = useAuth()
  const id = uid === undefined ? (user?.uid ?? null) : uid
  return useSnapshot<UserProfile | null>(
    id ? `users/${id}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'users', id!),
        (s) => next(s.exists() ? toProfile(s.id, s.data({ serverTimestamps: 'estimate' })) : null),
        fail,
      ),
    null,
  )
}

/**
 * Profils des uid donnés (membres d'une party, auteurs du journal…), indexés par uid.
 * Les règles interdisent de lister tous les profils (photos) : on les lit un par un.
 * Passe 'all' pour tout lister : réservé au super admin.
 */
export function useUsers(uids: readonly string[] | 'all'): Live<Record<string, UserProfile>> {
  const { user } = useAuth()
  const ids = uids === 'all' ? null : [...new Set(uids)].sort()
  const key = !user ? null : ids === null ? 'users:all' : `users:${ids.join(',')}`
  return useSnapshot<Record<string, UserProfile>>(
    key,
    (next, fail) => {
      if (ids === null) {
        return onSnapshot(
          collection(db, 'users'),
          (s) => next(Object.fromEntries(s.docs.map((d) => [d.id, toProfile(d.id, d.data())]))),
          fail,
        )
      }
      const profiles: Record<string, UserProfile> = {}
      let pending = ids.length
      if (pending === 0) next({})
      const unsubs = ids.map((id) => {
        let first = true
        return onSnapshot(
          doc(db, 'users', id),
          (s) => {
            if (s.exists()) profiles[id] = toProfile(id, s.data())
            else delete profiles[id]
            if (first) {
              first = false
              pending -= 1
            }
            if (pending === 0) next({ ...profiles })
          },
          fail,
        )
      })
      return () => unsubs.forEach((u) => u())
    },
    {},
  )
}
