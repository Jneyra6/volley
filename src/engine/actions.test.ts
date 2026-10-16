import { describe, expect, it } from 'vitest'
import { ACTION_BY_CODE, actionAllowed } from './actions'
import { manualChanges, rallyInProgress, timeoutsUsed } from './match'
import { replay } from './rotation'
import { count, teamRates } from './stats'
import type { StatEvent, Team } from './types'

const allowed = (code: string, side: Team, serving: Team, isServer = false) =>
  actionAllowed(ACTION_BY_CODE[code], side, serving, isServer)

let n = 0
const ev = (code: string, team: Team, extra: Partial<StatEvent> = {}): StatEvent => ({
  id: String(n++), time: 0, code, team, playerId: team === 'us' ? 'p' : null, ...extra,
})

describe('who can do what', () => {
  it('only our server can ace when we serve', () => {
    expect(allowed('ace', 'us', 'us', true)).toBe(true)
    expect(allowed('ace', 'us', 'us', false)).toBe(false)
    expect(allowed('serveErr', 'us', 'them', true)).toBe(false)
    expect(allowed('ace', 'them', 'us')).toBe(false)
  })

  it('the opponent can ace only on their serve', () => {
    expect(allowed('ace', 'them', 'them')).toBe(true)
  })

  it('only the receiving team can pass or make a receive error', () => {
    expect(allowed('pass', 'us', 'them')).toBe(true)
    expect(allowed('receiveErr', 'us', 'us')).toBe(false)
    expect(allowed('pass', 'them', 'us')).toBe(true)
  })

  it('rally actions are open to everyone', () => {
    expect(allowed('kill', 'them', 'us')).toBe(true)
    expect(allowed('fault', 'us', 'them')).toBe(true)
  })
})

describe('opponent actions use the same buttons', () => {
  const lineup = ['a', 'b', 'c', 'd', 'e', 'f']

  it('scores by who did it', () => {
    const { state } = replay({
      lineup,
      firstServe: 'us',
      events: [ev('kill', 'them'), ev('attackErr', 'them'), ev('fault', 'them', { detail: 'net' }), ev('ace', 'us')],
    })
    expect(state).toMatchObject({ us: 3, them: 1 })
  })

  it('old Their point / Their error events still count', () => {
    const { state } = replay({
      lineup,
      firstServe: 'us',
      events: [{ id: 'x', time: 0, code: 'oppPoint', playerId: null }, { id: 'y', time: 0, code: 'oppError', playerId: null }],
    })
    expect(state).toMatchObject({ us: 1, them: 1 })
  })

  it('counts kill types and fault kinds', () => {
    const { events } = replay({
      lineup,
      firstServe: 'us',
      events: [
        ev('kill', 'us', { detail: 'tip' }), ev('kill', 'us', { detail: 'tip' }), ev('kill', 'us', { detail: 'free' }),
        ev('fault', 'us', { detail: 'net' }),
      ],
    })
    const c = count(events)
    expect(c.killTypes).toEqual({ tip: 2, free: 1 })
    expect(c.faultKinds).toEqual({ net: 1 })
    expect(c.kills).toBe(3)
  })
})

describe('timeouts', () => {
  it('are counted per team and never score or rotate', () => {
    const set = {
      lineup: ['a', 'b', 'c', 'd', 'e', 'f'],
      firstServe: 'them' as Team,
      events: [ev('timeout', 'us'), ev('timeout', 'them'), ev('timeout', 'us')],
    }
    expect(timeoutsUsed(set, 'us')).toBe(2)
    expect(timeoutsUsed(set, 'them')).toBe(1)
    expect(replay(set).state).toMatchObject({ us: 0, them: 0, serving: 'them', rotation: 1 })
    expect(count(replay(set).events).otherErrs).toBe(0)
  })
})

describe('rally state', () => {
  it('is in progress after a rally action, not after a point or before the serve', () => {
    expect(rallyInProgress([])).toBe(false)
    expect(rallyInProgress([ev('serve', 'them', { rating: 2 })])).toBe(true)
    expect(rallyInProgress([ev('serve', 'them'), ev('pass', 'us'), ev('kill', 'us')])).toBe(false)
    expect(rallyInProgress([ev('kill', 'us'), ev('timeout', 'them')])).toBe(false)
    expect(rallyInProgress([ev('pass', 'us'), ev('timeout', 'them')])).toBe(true)
  })
})

describe('manual score changes', () => {
  const set = {
    lineup: ['a', 'b', 'c', 'd', 'e', 'f'],
    firstServe: 'us' as Team,
    events: [
      ...Array.from({ length: 10 }, () => ev('adjust', 'us', { delta: 1 })),
      ...Array.from({ length: 11 }, () => ev('adjust', 'them', { delta: 1 })),
      ev('adjust', 'them', { delta: -1 }),
      ev('kill', 'us'),
    ],
  }

  it('move the score without changing serve, rotation or stats', () => {
    const { state, events } = replay({ ...set, events: set.events.slice(0, -1) })
    expect(state).toMatchObject({ us: 10, them: 10, serving: 'us', rotation: 1 })
    expect(teamRates(events)).toEqual({ sideOutPct: null, pointScoringPct: null })
  })

  it('count toward the set score and are summarized per team', () => {
    expect(replay(set).state).toMatchObject({ us: 11, them: 10 })
    expect(manualChanges(set)).toEqual({ us: 10, them: 10, count: 22 })
    expect(rallyInProgress(set.events.slice(0, -1))).toBe(false)
  })
})
