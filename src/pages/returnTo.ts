// Page où revenir après la connexion ou l'onboarding (ex. le lien d'invitation /rejoindre/<code>).
// RequireAuth et RequireProfile la passent dans location.state.from. Elle est aussi gardée en
// sessionStorage, car un signInWithRedirect (Google sur mobile) recharge la page et perd le state.

const KEY = 'pronos-miss:return-to'

function isSafePath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && path !== '/connexion'
}

/** Lit la destination (state, sinon sessionStorage) et la mémorise pour survivre à un redirect. */
export function readReturnTo(state: unknown): string | null {
  const fromState = (state as { from?: unknown } | null)?.from
  if (isSafePath(fromState)) {
    try {
      sessionStorage.setItem(KEY, fromState)
    } catch {
      // stockage indisponible : seul le state servira
    }
    return fromState
  }
  try {
    const stored = sessionStorage.getItem(KEY)
    return isSafePath(stored) ? stored : null
  } catch {
    return null
  }
}

/** Oublie la destination une fois qu'on y est allé. */
export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // rien à faire
  }
}
