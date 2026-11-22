import { describe, expect, it } from 'vitest'
import { isSafePath } from './returnTo'

describe('isSafePath', () => {
  it('accepte un chemin de l’app', () => {
    expect(isSafePath('/rejoindre/K7QMZ3')).toBe(true)
    expect(isSafePath('/')).toBe(true)
  })
  it('refuse ce qui sortirait de l’app ou bouclerait', () => {
    expect(isSafePath('//evil.example')).toBe(false)
    expect(isSafePath('https://evil.example')).toBe(false)
    expect(isSafePath('rejoindre')).toBe(false)
    expect(isSafePath('/connexion')).toBe(false)
    expect(isSafePath(null)).toBe(false)
    expect(isSafePath(42)).toBe(false)
  })
})
