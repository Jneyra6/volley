import { ACTION_BY_CODE } from './actions'
import type { GameSet, Lineup, Point, StatEvent, Team } from './types'

export const other = (t: Team): Team => (t === 'us' ? 'them' : 'us')

/** Clockwise rotation: the player in 2 moves to 1, 1 to 6, 6 to 5, … 3 to 2. */
export function rotate(lineup: Lineup): Lineup {
  return lineup.map((_, i) => lineup[(i + 1) % 6])
}

/** Who did it: the event's team, or for old events the opponent if it used an opp* code. */
export const teamOf = (e: StatEvent): Team => e.team ?? (e.code.startsWith('opp') ? 'them' : 'us')

/** Which team wins the rally because of this event, or null if the rally continues. */
export function pointWinner(e: StatEvent): Team | null {
  const a = ACTION_BY_CODE[e.code]
  if (!a || a.family === 'rally') return null
  return a.family === 'earned' ? teamOf(e) : other(teamOf(e))
}

export interface RallyState {
  us: number
  them: number
  serving: Team
  lineup: Lineup
  /** 1–6: which of our six rotations we are in, counted from the starting lineup. */
  rotation: number
}

export interface AnnotatedEvent extends StatEvent {
  /** State at the moment the event happened. */
  before: RallyState
  winner: Team | null
}

/** Replay a set's events to get the current score/rotation and each event's context. */
export function replay(set: GameSet): { state: RallyState; events: AnnotatedEvent[] } {
  let state: RallyState = {
    us: 0,
    them: 0,
    serving: set.firstServe,
    lineup: set.lineup,
    rotation: 1,
  }
  const events: AnnotatedEvent[] = []
  for (const e of set.events) {
    const winner = pointWinner(e)
    events.push({ ...e, before: state, winner })
    if (e.code === 'sub' && e.playerId && e.out) {
      const inId = e.playerId, outId = e.out
      const lineup = state.lineup.map((id) => (id === outId ? inId : id === inId ? outId : id))
      state = { ...state, lineup }
      continue
    }
    if (e.code === 'adjust') {
      const t = teamOf(e)
      state = { ...state, [t]: Math.max(0, state[t] + (e.delta ?? 0)) }
      continue
    }
    if (!winner) continue
    const next = { ...state, [winner]: state[winner] + 1 }
    if (winner !== state.serving) {
      // Side-out: the receiving team wins the serve and rotates.
      next.serving = winner
      if (winner === 'us') {
        next.lineup = rotate(state.lineup)
        next.rotation = (state.rotation % 6) + 1
      }
    }
    state = next
  }
  return { state, events }
}

export function setWinner(us: number, them: number, target: number): Team | null {
  if (Math.max(us, them) < target || Math.abs(us - them) < 2) return null
  return us > them ? 'us' : 'them'
}

/**
 * Home spots for positions 1–6, seen from behind our own baseline.
 * x: 0 = left sideline, 1 = right. y: 0 = net, 1 = end line.
 */
export const HOME: Point[] = [
  { x: 0.83, y: 0.75 }, // 1 right back
  { x: 0.83, y: 0.2 }, // 2 right front
  { x: 0.5, y: 0.2 }, // 3 middle front
  { x: 0.17, y: 0.2 }, // 4 left front
  { x: 0.17, y: 0.75 }, // 5 left back
  { x: 0.5, y: 0.75 }, // 6 middle back
]

/**
 * Overlap rule at the moment of serve. spots[i] is where the player in position i+1 stands.
 * Each front-row player must be closer to the net than their back-row partner, and
 * each row must keep its left–right order. Returns a message per violation.
 * When serving, the server (position 1) is exempt, so rules involving 1 are skipped.
 */
export function overlapViolations(spots: Point[], serving = false): string[] {
  const p = (n: number) => spots[n - 1]
  const skip = ([a, b]: number[]) => serving && (a === 1 || b === 1)
  const out: string[] = []
  for (const pair of [[4, 5], [3, 6], [2, 1]]) {
    const [front, back] = pair
    if (!skip(pair) && p(front).y >= p(back).y) out.push(`${front} must be in front of ${back}`)
  }
  for (const pair of [[4, 3], [3, 2], [5, 6], [6, 1]]) {
    const [left, right] = pair
    if (!skip(pair) && p(left).x >= p(right).x) out.push(`${left} must be left of ${right}`)
  }
  return out
}
