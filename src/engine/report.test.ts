import { describe, expect, it } from 'vitest'
import { maxPrepsFile, statSheet, toCsv } from './export'
import { matchLines, record, seasonLines } from './report'
import type { TeamSetup } from './systems'
import type { Match, Player, StatEvent } from './types'

const setup: TeamSetup = { system: '5-1', slots: ['s', 'oh1', 'mb1', 'opp', 'oh2', 'mb2'], libero: 'lib' }
const players: Player[] = [
  ['s', 1, 'S'], ['oh1', 4, 'OH'], ['mb1', 7, 'MB'], ['opp', 9, 'OPP'], ['oh2', 11, 'OH'], ['mb2', 14, 'MB'], ['lib', 3, 'L'], ['bench', 5, 'OH'],
].map(([id, number, role]) => ({ id: id as string, number: number as number, name: String(id), role: role as Player['role'] }))

let n = 0
const ev = (code: string, team: 'us' | 'them', playerId: string | null = null, extra: Partial<StatEvent> = {}): StatEvent =>
  ({ id: String(n++), time: 0, code, team, playerId, ...extra })

/** We serve first; s (position 1) serves an ace, oh1 kills, they side out, then bench comes in for oh1. */
const match = (type: Match['type'] = 'region', winSets = 2): Match => ({
  id: 'm' + n++, opponent: 'Eagles', date: 0, bestOf: 3, type, setup,
  sets: Array.from({ length: winSets }, () => ({
    lineup: setup.slots, firstServe: 'us' as const,
    events: [
      ev('ace', 'us', 's'), ev('serve', 'us', 's', { rating: 2 }), ev('kill', 'us', 'oh1'),
      ev('kill', 'them'), ev('sub', 'us', 'bench', { out: 'oh1' }), ev('pass', 'us', 'lib', { rating: 3 }), ev('dig', 'us', 'lib'),
      ...Array.from({ length: 25 }, () => ev('oppError', 'them')),
    ],
  })),
})

describe('match report', () => {
  const r = matchLines(match())
  const get = (id: string) => r.lines.find((l) => l.playerId === id)!

  it('counts sets played, including subs', () => {
    expect(get('s').setsPlayed).toBe(2)
    expect(get('bench').setsPlayed).toBe(2)
    expect(get('lib').setsPlayed).toBe(2)
  })

  it('credits serving points to the server', () => {
    // Per set: s serves the ace and the kill point (2). Later points come after the side-out and rotation.
    expect(get('s').servingPoints).toBe(4)
  })

  it('adds stats across sets', () => {
    expect(get('oh1').counts.kills).toBe(2)
    expect(get('lib').counts.digs).toBe(2)
  })
})

describe('season totals and record', () => {
  const matches = [match('region'), match('nonRegion'), match('scrimmage', 1)]
  it('adds matches together', () => {
    const s = seasonLines(matches.slice(0, 2))
    expect(s.sets).toBe(4)
    expect(s.lines.find((l) => l.playerId === 'oh1')!.counts.kills).toBe(4)
  })
  it('keeps a record overall and by type, counting only finished matches', () => {
    const rec = record(matches)
    expect(rec.overall).toEqual({ w: 2, l: 0 }) // the 1-set scrimmage is unfinished in a best of 3
    expect(rec.byType.region).toEqual({ w: 1, l: 0 })
    expect(rec.setsWon).toBe(5)
  })
})

describe('exports', () => {
  const lines = matchLines(match()).lines

  it('writes a MaxPreps pipe file with Jersey first and exact field names', () => {
    const rows = maxPrepsFile(lines, players).trim().split('\r\n')
    expect(rows[0]).toBe(
      'Jersey|MatchGamesPlayed|TotalServes|ServingAces|ServingErrors|ServingPoints|AttacksAttempts|AttacksKills|AttacksErrors|' +
        'ServingReceivedSuccess|ServingReceivedErrors|BlocksSolo|BlocksErrors|Assists|Digs|DigsErrors',
    )
    expect(rows.find((r) => r.startsWith('1|'))).toBe('1|2|4|2|0|4|0|0|0|0|0|0|0|0|0|0')
    expect(rows.find((r) => r.startsWith('3|'))).toBe('3|2|0|0|0|0|0|0|0|2|0|0|0|0|2|0')
    expect(rows.every((r) => !r.includes(','))).toBe(true)
  })

  it('writes a CSV with quoted cells when needed', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"']])).toBe('a,"b,c","say ""hi"""\r\n')
    expect(statSheet(lines, players)[0].slice(0, 5)).toEqual(['#', 'Player', 'Pos', 'SP', 'K'])
  })
})
