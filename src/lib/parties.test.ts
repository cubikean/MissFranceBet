import { describe, expect, it, vi } from 'vitest'

// Pas de Firebase dans les tests unitaires : seules les fonctions pures sont testées.
vi.mock('./firebase', () => ({ app: {}, auth: {}, db: {}, usingEmulators: false }))

const { CODE_ALPHABET, CODE_LENGTH, codeError, generateCode, isValidCode, normalizeCode } = await import('./parties')

describe('normalizeCode', () => {
  it('retire espaces et tirets, passe en majuscules', () => {
    expect(normalizeCode(' k7q-mz3 ')).toBe('K7QMZ3')
    expect(normalizeCode('k7 qm z3')).toBe('K7QMZ3')
    expect(normalizeCode('')).toBe('')
  })
})

describe('isValidCode', () => {
  it('accepte 6 caractères de l’alphabet', () => {
    expect(isValidCode('K7QMZ3')).toBe(true)
  })
  it('refuse la mauvaise longueur, les minuscules et les caractères ambigus', () => {
    expect(isValidCode('K7QMZ')).toBe(false)
    expect(isValidCode('K7QMZ34')).toBe(false)
    expect(isValidCode('k7qmz3')).toBe(false)
    for (const c of ['0', 'O', '1', 'I', 'L']) expect(isValidCode(`K7QMZ${c}`)).toBe(false)
  })
})

describe('codeError', () => {
  it('ne dit rien pour un code valide, même mal saisi', () => {
    expect(codeError('k7q mz3')).toBeNull()
  })
  it('explique que 0, O, 1, I et L n’existent pas', () => {
    expect(codeError('CB5GK0')).toMatch(/jamais 0, O, 1, I ni L/)
    expect(codeError('cb5gko')).toMatch(/jamais/)
    expect(codeError('ABCDE1')).toMatch(/jamais/)
  })
  it('rappelle la longueur sinon', () => {
    expect(codeError('ABC')).toMatch(/6\u00a0caractères/)
    expect(codeError('ABCDEFG')).toMatch(/6\u00a0caractères/)
    expect(codeError('ABC#EF')).toMatch(/6\u00a0caractères/)
  })
})

describe('generateCode', () => {
  it('tire un code valide', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true)
      expect(isValidCode(code)).toBe(true)
    }
  })
})
