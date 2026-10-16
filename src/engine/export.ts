import { matchSummary } from './match'
import type { PlayerLine } from './report'
import { derive } from './stats'
import { MATCH_TYPES, type Match, type Player } from './types'

/**
 * MaxPreps stat import file (girls/boys volleyball), per MaxPreps' "File Export Specifications":
 * a .txt file, pipe-delimited, line 1 = field names with Jersey first, then one line per athlete.
 * Field names must match MaxPreps exactly. We only declare fields we actually track, so an import
 * never overwrites other MaxPreps fields (block assists, ball-handling attempts) with blanks.
 */
export const MAXPREPS_FIELDS: [string, (l: PlayerLine) => number][] = [
  ['MatchGamesPlayed', (l) => l.setsPlayed],
  ['TotalServes', (l) => l.counts.serveAttempts],
  ['ServingAces', (l) => l.counts.aces],
  ['ServingErrors', (l) => l.counts.serveErrs],
  ['ServingPoints', (l) => l.servingPoints],
  ['AttacksAttempts', (l) => l.counts.attackAttempts],
  ['AttacksKills', (l) => l.counts.kills],
  ['AttacksErrors', (l) => l.counts.attackErrs],
  ['ServingReceivedSuccess', (l) => l.counts.passAttempts - l.counts.receiveErrs],
  ['ServingReceivedErrors', (l) => l.counts.receiveErrs],
  ['BlocksSolo', (l) => l.counts.blocks],
  ['BlocksErrors', (l) => l.counts.blockErrs],
  ['Assists', (l) => l.counts.assists],
  ['Digs', (l) => l.counts.digs],
  ['DigsErrors', (l) => l.counts.digErrs],
]

export function maxPrepsFile(lines: PlayerLine[], players: Player[]): string {
  const rows = lines
    .filter((l) => l.setsPlayed > 0)
    .map((l) => ({ l, p: players.find((p) => p.id === l.playerId) }))
    .filter((r) => r.p)
    .sort((a, b) => a.p!.number - b.p!.number)
    .map(({ l, p }) => [String(p!.number), ...MAXPREPS_FIELDS.map(([, f]) => String(f(l)))].join('|'))
  return [['Jersey', ...MAXPREPS_FIELDS.map(([name]) => name)].join('|'), ...rows].join('\r\n') + '\r\n'
}

/** CSV cell: quote when needed, double inner quotes. */
const cell = (v: string | number) => {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'

const r2 = (v: number | null, digits: number) => (v === null ? '' : v.toFixed(digits))

/** Full player stat sheet (one row per player) for a match or a season. */
export function statSheet(lines: PlayerLine[], players: Player[]): (string | number)[][] {
  const head = [
    '#', 'Player', 'Pos', 'SP', 'K', 'K/S', 'E', 'TA', 'Hit%', 'A', 'A/S', 'SA', 'SE', 'Srv%', 'Srv pts',
    'Serve rating', 'Rec', 'RE', 'Pass rating', 'D', 'D/S', 'DE', 'BS', 'BE', 'B/S', 'Faults',
  ]
  const rows = lines
    .map((l) => ({ l, p: players.find((p) => p.id === l.playerId) }))
    .filter((r) => r.p && r.l.setsPlayed > 0)
    .sort((a, b) => a.p!.number - b.p!.number)
    .map(({ l, p }) => {
      const c = l.counts
      const d = derive(c)
      const per = (n: number) => (l.setsPlayed ? (n / l.setsPlayed).toFixed(2) : '')
      return [
        p!.number, p!.name, p!.role, l.setsPlayed, c.kills, per(c.kills), c.attackErrs, c.attackAttempts,
        r2(d.hittingPct, 3), c.assists, per(c.assists), c.aces, c.serveErrs, d.servePct === null ? '' : (d.servePct * 100).toFixed(1),
        l.servingPoints, r2(d.serveRating, 2), c.passAttempts, c.receiveErrs, r2(d.passRating, 2), c.digs, per(c.digs),
        c.digErrs, c.blocks, c.blockErrs, per(c.blocks), c.otherErrs,
      ]
    })
  return [head, ...rows]
}

/** Header block describing a match, for the top of a game CSV. */
export function matchInfoRows(m: Match, teamName: string): (string | number)[][] {
  const s = matchSummary(m)
  const type = MATCH_TYPES.find((t) => t.id === (m.type ?? 'other'))!.label
  return [
    ['Team', teamName],
    ['Opponent', m.opponent],
    ['Date', new Date(m.date).toLocaleString()],
    ['Type', type + (m.event ? ` · ${m.event}` : '')],
    ['Location', [m.venue && m.venue[0].toUpperCase() + m.venue.slice(1), m.location].filter(Boolean).join(' · ')],
    ['Result', `${s.winner === 'us' ? 'W' : s.winner === 'them' ? 'L' : 'In progress'} ${s.won}-${s.lost}`],
    ['Sets', s.sets.map((x) => `${x.us}-${x.them}`).join(', ')],
    [],
  ]
}

/** Safe file name piece: no quotes or parentheses (MaxPreps rejects them). */
export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'match'
