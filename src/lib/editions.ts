// Éditions embarquées dans l'app (src/data/editions/<id>/edition.json) : pas de Firestore.
// Ajouter une année = ajouter son dossier de données puis redéployer (voir AGENTS.md §10).
import type { Edition, EditionFile } from './types'

const files = import.meta.glob<EditionFile>('../data/editions/*/edition.json', {
  eager: true,
  import: 'default',
})

const EDITIONS: Edition[] = Object.values(files)
  .map((f) => ({ id: f.editionId, title: f.title, showAt: new Date(f.showAt) }))
  .sort((a, b) => b.showAt.getTime() - a.showAt.getTime())

/** Toutes les éditions embarquées, la plus récente en premier. */
export function listEditions(): Edition[] {
  return EDITIONS
}

/** Édition en cours = la plus récente embarquée (null si aucune donnée). */
export function currentEdition(): Edition | null {
  return EDITIONS[0] ?? null
}

/** Une édition par id (null si elle n'est pas embarquée). */
export function getEdition(editionId: string | null | undefined): Edition | null {
  return EDITIONS.find((e) => e.id === editionId) ?? null
}
