import { describe, expect, it, vi } from 'vitest'

vi.mock('./firebase', () => ({ app: {}, auth: {}, db: {}, usingEmulators: false }))

const { DELETE_PARTY_PHRASE, deletePhraseMatches } = await import('./admin')

describe('deletePhraseMatches', () => {
  it('accepte la phrase exacte', () => {
    expect(deletePhraseMatches(DELETE_PARTY_PHRASE)).toBe(true)
  })
  it('tolère majuscules et espaces en trop', () => {
    expect(deletePhraseMatches('  Je confirme  la SUPPRESSION de la party ')).toBe(true)
  })
  it('refuse une phrase incomplète ou différente', () => {
    expect(deletePhraseMatches('')).toBe(false)
    expect(deletePhraseMatches('je confirme')).toBe(false)
    expect(deletePhraseMatches('je confirme la suppression de la partie')).toBe(false)
  })
})
