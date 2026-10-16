import { describe, expect, it } from 'vitest'
import { overlapViolations, rotate } from './rotation'
import { defaultFormation, onCourt, rotationNotes, slotAt, type System, type TeamSetup } from './systems'
import { matchSummary, setTarget } from './match'
import type { Match, Player } from './types'

// Slots: S, OH1, MB1, OPP, OH2, MB2 (5-1 order)
const setup: TeamSetup = { system: '5-1', slots: ['s', 'oh1', 'mb1', 'opp', 'oh2', 'mb2'], libero: 'lib' }
const players: Player[] = [
  { id: 's', number: 1, name: 'Ava', role: 'S' },
  { id: 'mb1', number: 7, name: 'Zoe', role: 'MB' },
  { id: 'mb2', number: 14, name: 'Nora', role: 'MB' },
  { id: 'lib', number: 3, name: 'Ella', role: 'L' },
]

describe('systems', () => {
  it('slotAt matches replay rotation', () => {
    let lineup = setup.slots
    for (let r = 1; r <= 6; r++) {
      expect([0, 1, 2, 3, 4, 5].map((i) => setup.slots[slotAt(i, r)])).toEqual(lineup)
      lineup = rotate(lineup)
    }
  })

  it('libero replaces the back-row middle', () => {
    const court = onCourt(setup, 1, false)
    expect(court[5]).toMatchObject({ playerId: 'lib', libero: true, replaced: 'mb2' }) // MB2 in position 6
    expect(court[2]).toMatchObject({ playerId: 'mb1', libero: false }) // MB1 front row
  })

  it('a middle serving from position 1 stays in', () => {
    // Rotation 3: MB1 (slot 2) is in position 1.
    expect(onCourt(setup, 3, true)[0]).toMatchObject({ playerId: 'mb1', libero: false })
    expect(onCourt(setup, 3, false)[0]).toMatchObject({ playerId: 'lib', libero: true })
    expect(rotationNotes(setup, 3, true, players).join(' ')).toContain('#7 Zoe serves')
  })

  it('6-2 back-row setter sets', () => {
    const notes = rotationNotes({ ...setup, system: '6-2', slots: ['s', 'oh1', 'mb1', 'mb2', 'oh2', 'mb2'] }, 1, false, players)
    expect(notes[0]).toMatch(/^#1 Ava sets from the back row/)
  })

  it('base puts the opposite on the right and the outside on the left', () => {
    const f = defaultFormation('5-1', 1, 'base')
    expect(f[3].x).toBeGreaterThan(0.7) // OPP in position 4 → right front
    expect(f[1].x).toBeLessThan(0.3) // OH1 in position 2 → left front
    expect(f[0].x).toBeGreaterThan(0.7) // setter in position 1 → right back
  })

  it('default receive and serve formations are legal in every rotation', () => {
    for (const system of ['5-1', '6-2', '4-2'] as System[]) {
      for (let r = 1; r <= 6; r++) {
        expect(overlapViolations(defaultFormation(system, r, 'receive'))).toEqual([])
        expect(overlapViolations(defaultFormation(system, r, 'serve'), true)).toEqual([])
      }
    }
  })
})

describe('match', () => {
  const pts = (us: number, them: number) => [
    ...Array.from({ length: us }, (_, i) => ({ id: `u${i}`, time: 0, code: 'kill', playerId: 'oh1' })),
    ...Array.from({ length: them }, (_, i) => ({ id: `t${i}`, time: 0, code: 'oppPoint', playerId: null })),
  ]
  const match = (bestOf: 3 | 5, scores: [number, number][]): Match => ({
    id: 'm', opponent: 'x', date: 0, bestOf, setup,
    sets: scores.map(([u, t]) => ({ lineup: setup.slots, firstServe: 'us', events: pts(u, t) })),
  })

  it('deciding set goes to 15', () => {
    expect(setTarget(2, 3)).toBe(15)
    expect(setTarget(2, 5)).toBe(25)
    expect(setTarget(4, 5)).toBe(15)
  })

  it('best of 3 ends at 2 sets won', () => {
    expect(matchSummary(match(3, [[25, 20], [20, 25]])).winner).toBe(null)
    const s = matchSummary(match(3, [[25, 20], [20, 25], [15, 13]]))
    expect(s).toMatchObject({ won: 2, lost: 1, winner: 'us' })
  })

  it('best of 5 needs 3', () => {
    expect(matchSummary(match(5, [[25, 20], [25, 20]])).winner).toBe(null)
  })
})
