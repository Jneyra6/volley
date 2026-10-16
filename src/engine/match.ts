import { pointWinner, replay, setWinner, teamOf } from './rotation'
import type { TeamSetup } from './systems'
import type { GameSet, Match, StatEvent, Team } from './types'

/** Sets go to 25; the deciding set (3rd of 3, 5th of 5) goes to 15. */
export const setTarget = (index: number, bestOf: 3 | 5) => (index === bestOf - 1 ? 15 : 25)

export function matchSummary(match: Match) {
  const sets = match.sets.map((s, i) => {
    const { state } = replay(s)
    return { us: state.us, them: state.them, winner: setWinner(state.us, state.them, setTarget(i, match.bestOf)) }
  })
  const won = sets.filter((s) => s.winner === 'us').length
  const lost = sets.filter((s) => s.winner === 'them').length
  const need = Math.ceil(match.bestOf / 2)
  const winner: Team | null = won >= need ? 'us' : lost >= need ? 'them' : null
  return { sets, won, lost, winner }
}

/** Net manual score changes in a set, per team. */
export function manualChanges(set: GameSet) {
  const out = { us: 0, them: 0, count: 0 }
  for (const e of set.events) {
    if (e.code !== 'adjust') continue
    out[teamOf(e)] += e.delta ?? 0
    out.count++
  }
  return out
}

/** Timeouts allowed per team per set (indoor rules: 2). */
export const TIMEOUTS_PER_SET = 2

export const timeoutsUsed = (set: GameSet, team: Team) =>
  set.events.filter((e) => e.code === 'timeout' && teamOf(e) === team).length

/** True once the ball is in play: something was recorded since the last point (timeouts and manual score changes don't count). */
export function rallyInProgress(events: StatEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    if (['timeout', 'adjust', 'sub'].includes(events[i].code)) continue
    return pointWinner(events[i]) === null
  }
  return false
}

/**
 * Apply a lineup change. If the incoming player is already in the lineup (or is the libero), the two swap
 * spots; otherwise the incoming player takes the outgoing player's slot and role for the rest of the set.
 */
export function applySub(setup: TeamSetup, playerIn: string, playerOut: string): TeamSetup {
  const slots = [...setup.slots]
  let libero = setup.libero
  const inSlot = slots.indexOf(playerIn)
  const outSlot = slots.indexOf(playerOut)
  if (outSlot >= 0 && inSlot >= 0) {
    slots[outSlot] = playerIn
    slots[inSlot] = playerOut
  } else if (outSlot >= 0) {
    slots[outSlot] = playerIn
    if (libero === playerIn) libero = playerOut
  } else if (libero === playerOut) {
    libero = playerIn
  }
  // A planned sub involving someone who left no longer applies.
  const subs = (setup.subs ?? []).filter((s) => slots.includes(s.out) && !slots.includes(s.in))
  return { ...setup, slots, libero, subs }
}

/** The lineup in effect right now: the match's starting setup with this set's subs applied in order. */
export function currentSetup(setup: TeamSetup, set: GameSet): TeamSetup {
  return set.events.filter((e) => e.code === 'sub' && e.playerId && e.out).reduce((s, e) => applySub(s, e.playerId!, e.out!), setup)
}

export const subsUsed = (set: GameSet) => set.events.filter((e) => e.code === 'sub').length
