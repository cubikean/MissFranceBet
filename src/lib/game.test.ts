import { describe, expect, it } from 'vitest'
import { candidateStatus, EMPTY_RESULTS, isShowLive, trophyFor } from './game'
import type { Results } from './types'

const open = { status: 'open' as const }
const closed = { status: 'closed' as const }
const finished = { status: 'finished' as const }

const top15 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o']
const withTop15: Results = { ...EMPTY_RESULTS, top15 }
const withTop5: Results = { ...withTop15, top5: ['a', 'b', 'c', 'd', 'e'] }
const withPodium: Results = { ...withTop5, winner: 'c', firstRunnerUp: 'a', secondRunnerUp: 'e' }

describe('candidateStatus', () => {
  it('est neutre tant que les pronos sont ouverts, même avec des résultats', () => {
    expect(candidateStatus('a', open, withPodium)).toBe('neutral')
    expect(candidateStatus('a', null, null)).toBe('neutral')
  })

  it('met tout le monde en course après la fermeture, avant le top 15', () => {
    expect(candidateStatus('z', closed, null)).toBe('inRace')
    expect(candidateStatus('z', closed, EMPTY_RESULTS)).toBe('inRace')
    expect(candidateStatus('z', closed, { ...EMPTY_RESULTS, top15: [] })).toBe('inRace')
  })

  it('élimine les absentes du top 15', () => {
    expect(candidateStatus('a', closed, withTop15)).toBe('inRace')
    expect(candidateStatus('z', closed, withTop15)).toBe('eliminated')
  })

  it('élimine les absentes du top 5', () => {
    expect(candidateStatus('b', closed, withTop5)).toBe('inRace')
    expect(candidateStatus('o', closed, withTop5)).toBe('eliminated')
    expect(candidateStatus('z', closed, withTop5)).toBe('eliminated')
  })

  it('donne le podium et élimine les autres', () => {
    expect(candidateStatus('c', finished, withPodium)).toBe('winner')
    expect(candidateStatus('a', finished, withPodium)).toBe('firstRunnerUp')
    expect(candidateStatus('e', finished, withPodium)).toBe('secondRunnerUp')
    expect(candidateStatus('b', finished, withPodium)).toBe('eliminated')
    expect(candidateStatus('z', closed, withPodium)).toBe('eliminated')
  })
})

describe('trophyFor', () => {
  it('donne or, argent, bronze selon le podium', () => {
    expect(trophyFor({ candidateId: 'c' }, withPodium)).toBe('gold')
    expect(trophyFor({ candidateId: 'a' }, withPodium)).toBe('silver')
    expect(trophyFor({ candidateId: 'e' }, withPodium)).toBe('bronze')
  })

  it('ne donne rien sinon', () => {
    expect(trophyFor({ candidateId: 'b' }, withPodium)).toBeNull()
    expect(trophyFor(null, withPodium)).toBeNull()
    expect(trophyFor({ candidateId: 'c' }, null)).toBeNull()
    expect(trophyFor({ candidateId: 'c' }, withTop5)).toBeNull()
    expect(trophyFor({ candidateId: 'c' }, EMPTY_RESULTS)).toBeNull()
  })
})

describe('isShowLive', () => {
  const showAt = new Date('2026-12-12T21:10:00+01:00')
  const at = (iso: string) => new Date(iso)

  it('est faux bien avant l’émission (répétition, pronos fermés en avance)', () => {
    expect(isShowLive(showAt, at('2026-11-29T21:00:00+01:00'))).toBe(false)
    expect(isShowLive(showAt, at('2026-12-12T20:09:00+01:00'))).toBe(false)
  })
  it('est vrai une heure avant et pendant l’émission', () => {
    expect(isShowLive(showAt, at('2026-12-12T20:10:00+01:00'))).toBe(true)
    expect(isShowLive(showAt, at('2026-12-12T21:10:00+01:00'))).toBe(true)
    expect(isShowLive(showAt, at('2026-12-13T01:09:00+01:00'))).toBe(true)
  })
  it('est faux après la fin, ou sans date', () => {
    expect(isShowLive(showAt, at('2026-12-13T01:10:00+01:00'))).toBe(false)
    expect(isShowLive(null, at('2026-12-12T21:10:00+01:00'))).toBe(false)
  })
})
