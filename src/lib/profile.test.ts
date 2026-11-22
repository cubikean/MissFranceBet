import { describe, expect, it, vi } from 'vitest'

vi.mock('./firebase', () => ({ app: {}, auth: {}, db: {}, usingEmulators: false }))

const { normalizeUsername, usernameError, USERNAME_MAX, USERNAME_MIN } = await import('./profile')

describe('normalizeUsername', () => {
  it('retire les espaces en trop', () => {
    expect(normalizeUsername('  Julie   B ')).toBe('Julie B')
  })
})

describe('usernameError', () => {
  it('accepte un pseudo normal', () => {
    expect(usernameError('Julie')).toBeNull()
    expect(usernameError('Hé 😎')).toBeNull()
  })
  it('vérifie la longueur (en caractères, espaces en trop retirés)', () => {
    expect(usernameError('J')).toMatch(String(USERNAME_MIN))
    expect(usernameError('  J  ')).toMatch(String(USERNAME_MIN))
    expect(usernameError('x'.repeat(USERNAME_MAX))).toBeNull()
    expect(usernameError('x'.repeat(USERNAME_MAX + 1))).toMatch(String(USERNAME_MAX))
  })
  it('refuse les pseudos impossibles comme id Firestore', () => {
    expect(usernameError('a/b')).toMatch('/')
    expect(usernameError('__ab__')).not.toBeNull()
    expect(usernameError('..')).not.toBeNull()
  })
})
