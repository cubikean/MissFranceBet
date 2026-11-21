import { FirebaseError } from 'firebase/app'

/** Erreur métier avec un message prêt à afficher. */
export class AppError extends Error {
  constructor(
    public readonly code: 'username-taken' | 'username-invalid' | 'wrong-code' | 'not-signed-in' | 'picks-closed' | 'party-invalid' | 'unknown-candidate',
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': "Cette adresse email n'est pas valide.",
  'auth/missing-email': 'Entre ton adresse email.',
  'auth/missing-password': 'Entre ton mot de passe.',
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/wrong-password': 'Email ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet email. Crée-en un.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet email. Connecte-toi.',
  'auth/weak-password': 'Mot de passe trop court : 6 caractères minimum.',
  'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion. Vérifie ton réseau et réessaie.',
  'auth/popup-closed-by-user': 'Connexion annulée.',
  'auth/cancelled-popup-request': 'Connexion annulée.',
  'auth/unauthorized-domain':
    "Ce domaine n'est pas autorisé dans Firebase Auth. Ajoute-le dans la console (Authentication > Paramètres).",
  'permission-denied': "Action refusée. Vérifie que les pronos sont ouverts et que tu as rejoint la party.",
  unavailable: 'Pas de connexion. Réessaie quand tu as du réseau.',
}

/** Message en français, à afficher tel quel, pour n'importe quelle erreur. */
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (error instanceof FirebaseError) return MESSAGES[error.code] ?? `Erreur inattendue (${error.code}). Réessaie.`
  return 'Erreur inattendue. Réessaie.'
}

export function isPermissionDenied(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === 'permission-denied'
}
