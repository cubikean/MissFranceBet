// Brouillon de saisie des résultats, gardé dans sessionStorage : il survit à un changement
// d'onglet ou à iOS qui tue l'app pendant l'annonce. Une clé par party et par étape. Le brouillon
// porte la version des résultats serveur sur laquelle il a été commencé : si elle a changé
// (enregistrement, effacement, autre appareil), il est oublié.

export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function draftKey(partyId: string, step: string): string {
  return `pronos-miss:results-draft:${partyId}:${step}`
}

/** sessionStorage, ou null s'il est indisponible (navigation privée stricte, aperçu). */
export function sessionDraftStorage(): DraftStorage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Le brouillon s'il a été commencé sur la même version des résultats, sinon null (et il est oublié). */
export function readDraft(storage: DraftStorage | null, key: string, version: number): unknown {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: unknown; draft?: unknown }
    if (parsed.version !== version) {
      storage.removeItem(key)
      return null
    }
    return parsed.draft ?? null
  } catch {
    return null
  }
}

export function writeDraft(storage: DraftStorage | null, key: string, version: number, draft: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify({ version, draft }))
  } catch {
    // stockage plein ou indisponible : le brouillon reste en mémoire seulement
  }
}

export function clearDraft(storage: DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // rien à faire
  }
}

/** Brouillon d'une étape top 15 / top 5 : des ids connus, sans doublon, au plus `size`. */
export function subsetDraft(value: unknown, allowed: ReadonlySet<string>, size: number): string[] | null {
  if (!Array.isArray(value)) return null
  const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))]
  return ids.slice(0, size)
}

/** Brouillon du podium : trois places, chacune un id connu ou null, sans doublon. */
export function podiumDraft(value: unknown, allowed: ReadonlySet<string>): (string | null)[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null
  const seen = new Set<string>()
  return value.map((id) => {
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) return null
    seen.add(id)
    return id
  })
}
