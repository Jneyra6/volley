import { describe, expect, it } from 'vitest'
import { HOME, overlapViolations, replay, rotate, setWinner } from './rotation'
import { count, derive, fmt, teamRates } from './stats'
import type { GameSet, StatEvent } from './types'

const lineup = ['a', 'b', 'c', 'd', 'e', 'f'] // a in 1, b in 2, … f in 6
let n = 0
const ev = (code: string, playerId: string | null = null, rating?: number): StatEvent => ({
  id: String(n++), time: 0, code, playerId, rating,
})

describe('rotation', () => {
  it('rotates clockwise: 2→1, 1→6, …, 3→2', () => {
    expect(rotate(lineup)).toEqual(['b', 'c', 'd', 'e', 'f', 'a'])
  })

  it('only rotates when we win the serve back', () => {
    const set: GameSet = {
      lineup,
      firstServe: 'them',
      events: [ev('kill', 'd'), ev('ace', 'b'), ev('serveErr', 'b'), ev('oppError')],
    }
    const { state, events } = replay(set)
    expect(state).toMatchObject({ us: 3, them: 1, serving: 'us', rotation: 3 })
    expect(state.lineup).toEqual(['c', 'd', 'e', 'f', 'a', 'b'])
    expect(events[1].before.lineup[0]).toBe('b') // b served the ace
  })

  it('does not rotate when the opponent sides out', () => {
    const { state } = replay({ lineup, firstServe: 'us', events: [ev('oppPoint')] })
    expect(state).toMatchObject({ them: 1, serving: 'them', rotation: 1 })
  })

  it('rally actions do not score', () => {
    const { state } = replay({ lineup, firstServe: 'us', events: [ev('serve', 'a', 3), ev('dig', 'e')] })
    expect(state).toMatchObject({ us: 0, them: 0 })
  })

  it('needs the target and a 2-point lead to win a set', () => {
    expect(setWinner(25, 23, 25)).toBe('us')
    expect(setWinner(25, 24, 25)).toBe(null)
    expect(setWinner(14, 16, 15)).toBe('them')
  })
})

describe('overlap', () => {
  it('home spots are legal', () => {
    expect(overlapViolations(HOME)).toEqual([])
  })

  it('flags a front player behind their back partner', () => {
    const spots = HOME.map((p) => ({ ...p }))
    spots[2] = { x: 0.5, y: 0.9 } // position 3 behind position 6
    expect(overlapViolations(spots)).toContain('3 must be in front of 6')
  })

  it('exempts the server when serving', () => {
    const spots = HOME.map((p) => ({ ...p }))
    spots[0] = { x: 0.9, y: 0.99 }
    spots[1] = { x: 0.83, y: 0.995 } // 2 behind 1: only illegal when receiving
    expect(overlapViolations(spots)).toContain('2 must be in front of 1')
    expect(overlapViolations(spots, true)).toEqual([])
  })

  it('flags left–right order', () => {
    const spots = HOME.map((p) => ({ ...p }))
    spots[3] = { x: 0.6, y: 0.2 } // position 4 right of 3
    expect(overlapViolations(spots)).toContain('4 must be left of 3')
  })
})

describe('stats', () => {
  const set: GameSet = {
    lineup,
    firstServe: 'us',
    events: [
      ev('serve', 'a', 3), ev('kill', 'd'), // we score on serve
      ev('attackErr', 'd'), // they side out
      ev('pass', 'e', 3), ev('pass', 'e', 1), ev('attack', 'd'), ev('kill', 'd'), // we side out
      ev('receiveErr', 'e'),
    ],
  }
  const { events } = replay(set)

  it('computes hitting percentage', () => {
    const d = derive(count(events.filter((e) => e.playerId === 'd')))
    expect(d.hittingPct).toBeCloseTo((2 - 1) / 4)
    expect(fmt.hit(d.hittingPct)).toBe('.250')
  })

  it('counts receive errors as 0 passes', () => {
    const d = derive(count(events.filter((e) => e.playerId === 'e')))
    expect(d.passRating).toBeCloseTo((3 + 1 + 0) / 3)
  })

  it('computes side-out and point-scoring %', () => {
    const r = teamRates(events)
    // We served: kill (won), attackErr (lost), receiveErr (lost). They served: kill (won).
    expect(r.pointScoringPct).toBeCloseTo(1 / 3)
    expect(r.sideOutPct).toBe(1)
    expect(fmt.pct(r.sideOutPct)).toBe('100.0%')
    expect(fmt.pct(null)).toBe('-')
  })
})
