import { describe, expect, it } from 'vitest'
import { applySub, currentSetup } from './match'
import { replay } from './rotation'
import { onCourt, rotationNotes, type TeamSetup } from './systems'
import type { GameSet, StatEvent } from './types'

const setup: TeamSetup = {
  system: '5-1',
  slots: ['s', 'oh1', 'mb1', 'opp', 'oh2', 'mb2'],
  libero: 'lib',
  subs: [{ in: 'ds', out: 'oh2', mode: 'backRow' }],
}
const sub = (inId: string, out: string): StatEvent => ({ id: inId + out, time: 0, code: 'sub', team: 'us', playerId: inId, out })

describe('planned back-row subs', () => {
  it('the DS replaces the outside only in the back row', () => {
    // Rotation 1: oh2 (slot 4) is in position 5, back row.
    expect(onCourt(setup, 1, false)[4]).toMatchObject({ playerId: 'ds', sub: true, replaced: 'oh2' })
    // Rotation 2: oh2 is in position 4, front row.
    expect(onCourt(setup, 2, false)[3].playerId).toBe('oh2')
  })

  it('notes say when the DS comes in and goes out', () => {
    const players = [{ id: 'ds', number: 2, name: 'Dee', role: 'DS' as const }, { id: 'oh2', number: 11, name: 'Emma', role: 'OH' as const }]
    expect(rotationNotes(setup, 1, false, players).join(' ')).toContain('Next rotation #11 Emma returns to the front row')
  })
})

describe('in-match lineup changes', () => {
  it("a bench player takes the injured player's slot for the rest of the set", () => {
    const next = applySub(setup, 'bench', 'oh1')
    expect(next.slots).toEqual(['s', 'bench', 'mb1', 'opp', 'oh2', 'mb2'])
    // Two rotations later the bench player has rotated with the slot.
    expect(onCourt(next, 3, false).map((c) => c.playerId)).toContain('bench')
  })

  it('two players on court swap spots', () => {
    expect(applySub(setup, 'opp', 'oh1').slots).toEqual(['s', 'opp', 'mb1', 'oh1', 'oh2', 'mb2'])
  })

  it('replacing the libero changes the libero', () => {
    expect(applySub(setup, 'lib2', 'lib').libero).toBe('lib2')
  })

  it('drops a planned sub whose player left', () => {
    expect(applySub(setup, 'bench', 'oh2').subs).toEqual([])
  })

  it("applies all of a set's subs in order and keeps the score untouched", () => {
    const set: GameSet = { lineup: setup.slots, firstServe: 'us', events: [sub('bench', 'oh1'), { id: 'k', time: 0, code: 'kill', team: 'us', playerId: 'bench' }] }
    expect(currentSetup(setup, set).slots[1]).toBe('bench')
    expect(replay(set).state).toMatchObject({ us: 1, them: 0, lineup: ['s', 'bench', 'mb1', 'opp', 'oh2', 'mb2'] })
  })
})
