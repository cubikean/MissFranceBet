import { describe, expect, it } from 'vitest'
import { canReloadSilently } from './pwa'

describe('canReloadSilently', () => {
  it('recharge sur les écrans de consultation', () => {
    expect(canReloadSilently({ pathname: '/' })).toBe(true)
    expect(canReloadSilently({ pathname: '/soiree', focusedTag: 'BUTTON' })).toBe(true)
  })
  it('jamais pendant la saisie des résultats', () => {
    expect(canReloadSilently({ pathname: '/soiree/gestion' })).toBe(false)
    expect(canReloadSilently({ pathname: '/soiree/gestion/' })).toBe(false)
  })
  it('jamais avec un champ actif ou une fenêtre ouverte', () => {
    expect(canReloadSilently({ pathname: '/parties', focusedTag: 'INPUT' })).toBe(false)
    expect(canReloadSilently({ pathname: '/profil', focusedTag: 'textarea' })).toBe(false)
    expect(canReloadSilently({ pathname: '/parties', dialogOpen: true })).toBe(false)
  })
})
