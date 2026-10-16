import { applySub, matchSummary } from './match'
import { replay, teamOf, type AnnotatedEvent } from './rotation'
import { count, type Counts } from './stats'
import { onCourt } from './systems'
import { MATCH_TYPES, type Match, type MatchType } from './types'

/** One player's totals for a match or a whole season. */
export interface PlayerLine {
  playerId: string
  counts: Counts
  /** Sets the player was on the court for (MaxPreps "SP"). */
  setsPlayed: number
  /** Points we won while this player was serving. */
  servingPoints: number
}

export function addCounts(a: Counts, b: Counts): Counts {
  const sumMap = (x: Record<string, number>, y: Record<string, number>) => {
    const out = { ...x }
    for (const [k, v] of Object.entries(y)) out[k] = (out[k] ?? 0) + v
    return out
  }
  const out = { ...a, killTypes: sumMap(a.killTypes, b.killTypes), faultKinds: sumMap(a.faultKinds, b.faultKinds) }
  for (const key of Object.keys(a) as (keyof Counts)[]) {
    if (typeof a[key] === 'number') (out[key] as number) = (a[key] as number) + (b[key] as number)
  }
  return out
}

export const emptyCounts = (): Counts => count([])

/** Per-player lines for one match, plus every annotated event and the number of sets. */
export function matchLines(match: Match) {
  const lines = new Map<string, PlayerLine>()
  const line = (id: string) => {
    if (!lines.has(id)) lines.set(id, { playerId: id, counts: emptyCounts(), setsPlayed: 0, servingPoints: 0 })
    return lines.get(id)!
  }
  const allEvents: AnnotatedEvent[] = []

  for (const set of match.sets) {
    let setup = set.setup ?? match.setup
    const { events } = replay(set)
    allEvents.push(...events)

    // Everyone who stepped on the court this set: starters, libero, back-row subs, and anyone subbed in.
    const played = new Set<string>([...setup.slots.filter(Boolean), ...(setup.libero ? [setup.libero] : [])])
    for (const s of setup.subs ?? []) if (s.mode === 'backRow') played.add(s.in)

    for (const e of events) {
      if (e.code === 'sub' && e.playerId && e.out) {
        setup = applySub(setup, e.playerId, e.out)
        played.add(e.playerId)
        for (const s of setup.subs ?? []) if (s.mode === 'backRow') played.add(s.in)
        continue
      }
      if (e.playerId && teamOf(e) === 'us') played.add(e.playerId)
      if (e.winner === 'us' && e.before.serving === 'us') {
        const server = onCourt(setup, e.before.rotation, true)[0].playerId
        if (server) line(server).servingPoints++
      }
    }

    for (const id of played) line(id).setsPlayed++
    for (const id of played) {
      const mine = events.filter((e) => e.playerId === id && teamOf(e) === 'us')
      line(id).counts = addCounts(line(id).counts, count(mine))
    }
  }

  return { lines: [...lines.values()], events: allEvents, sets: match.sets.length }
}

/** Add up player lines across many matches. */
export function seasonLines(matches: Match[]) {
  const totals = new Map<string, PlayerLine>()
  let sets = 0
  const events: AnnotatedEvent[] = []
  for (const m of matches) {
    const r = matchLines(m)
    sets += r.sets
    events.push(...r.events)
    for (const l of r.lines) {
      const t = totals.get(l.playerId)
      totals.set(
        l.playerId,
        t
          ? { ...t, counts: addCounts(t.counts, l.counts), setsPlayed: t.setsPlayed + l.setsPlayed, servingPoints: t.servingPoints + l.servingPoints }
          : { ...l },
      )
    }
  }
  return { lines: [...totals.values()], events, sets }
}

export interface WinLoss {
  w: number
  l: number
}

/** Win–loss record over finished matches, overall and by match type, plus sets won and lost. */
export function record(matches: Match[]) {
  const overall: WinLoss = { w: 0, l: 0 }
  const byType = Object.fromEntries(MATCH_TYPES.map((t) => [t.id, { w: 0, l: 0 }])) as Record<MatchType, WinLoss>
  let setsWon = 0
  let setsLost = 0
  for (const m of matches) {
    const s = matchSummary(m)
    setsWon += s.won
    setsLost += s.lost
    if (!s.winner) continue
    const key = s.winner === 'us' ? 'w' : 'l'
    overall[key]++
    byType[m.type ?? 'other'][key]++
  }
  return { overall, byType, setsWon, setsLost }
}
