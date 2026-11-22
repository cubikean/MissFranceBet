import { describe, expect, it } from 'vitest'
import { clearDraft, draftKey, podiumDraft, readDraft, subsetDraft, writeDraft, type DraftStorage } from './resultsDraft'

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('brouillon des résultats', () => {
  const key = draftKey('p1', 'top15')

  it('une clé par party et par étape', () => {
    expect(draftKey('p1', 'top15')).not.toBe(draftKey('p1', 'top5'))
    expect(draftKey('p1', 'top15')).not.toBe(draftKey('p2', 'top15'))
  })

  it('relit le brouillon commencé sur la même version des résultats', () => {
    const s = memoryStorage()
    writeDraft(s, key, 1000, ['a', 'b'])
    expect(readDraft(s, key, 1000)).toEqual(['a', 'b'])
  })

  it('oublie le brouillon si les résultats serveur ont changé', () => {
    const s = memoryStorage()
    writeDraft(s, key, 1000, ['a'])
    expect(readDraft(s, key, 2000)).toBeNull()
    expect(s.data.has(key)).toBe(false)
  })

  it('efface, et supporte un stockage absent ou cassé', () => {
    const s = memoryStorage()
    writeDraft(s, key, 1, ['a'])
    clearDraft(s, key)
    expect(readDraft(s, key, 1)).toBeNull()
    expect(readDraft(null, key, 1)).toBeNull()
    s.setItem(key, '{pas du json')
    expect(readDraft(s, key, 1)).toBeNull()
    const broken: DraftStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(() => writeDraft(broken, key, 1, [])).not.toThrow()
    expect(() => clearDraft(broken, key)).not.toThrow()
    expect(readDraft(broken, key, 1)).toBeNull()
  })

  it('valide un brouillon de top : ids connus, sans doublon, taille max', () => {
    const allowed = new Set(['a', 'b', 'c'])
    expect(subsetDraft(['a', 'z', 'a', 'b', 3], allowed, 5)).toEqual(['a', 'b'])
    expect(subsetDraft(['a', 'b', 'c'], allowed, 2)).toEqual(['a', 'b'])
    expect(subsetDraft('a', allowed, 2)).toBeNull()
  })

  it('valide un brouillon de podium : trois places, ids connus, sans doublon', () => {
    const allowed = new Set(['a', 'b', 'c'])
    expect(podiumDraft(['a', null, 'c'], allowed)).toEqual(['a', null, 'c'])
    expect(podiumDraft(['a', 'a', 'z'], allowed)).toEqual(['a', null, null])
    expect(podiumDraft(['a', 'b'], allowed)).toBeNull()
  })
})
