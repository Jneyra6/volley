import { HOME } from './rotation'
import type { Player, Point } from './types'

export type System = '5-1' | '6-2' | '4-2'
export type SlotRole = 'S' | 'OH' | 'MB' | 'OPP'

/**
 * A planned substitution. 'backRow': the sub automatically replaces the starter whenever the starter is
 * in the back row (a DS for an outside hitter). 'ready': a sub you plan to use; it shows as a one-tap swap in Match.
 */
export interface SubPlan {
  in: string
  out: string
  mode: 'backRow' | 'ready'
}

export interface TeamSetup {
  system: System
  /** Starting lineup by slot: index 0 = court position 1 in rotation 1. */
  slots: string[]
  libero: string | null
  subs?: SubPlan[]
}

export const SYSTEMS: Record<System, { roles: SlotRole[]; labels: string[]; about: string }> = {
  '5-1': {
    roles: ['S', 'OH', 'MB', 'OPP', 'OH', 'MB'],
    labels: ['Setter', 'Outside 1', 'Middle 1', 'Opposite', 'Outside 2', 'Middle 2'],
    about: 'One setter sets in all six rotations. The opposite lines up across from the setter.',
  },
  '6-2': {
    roles: ['S', 'OH', 'MB', 'S', 'OH', 'MB'],
    labels: ['Setter 1', 'Outside 1', 'Middle 1', 'Setter 2', 'Outside 2', 'Middle 2'],
    about: 'Two setters across from each other. Whoever is in the back row sets; the front-row setter hits right side, so there are always three front-row attackers.',
  },
  '4-2': {
    roles: ['S', 'OH', 'MB', 'S', 'OH', 'MB'],
    labels: ['Setter 1', 'Outside 1', 'Middle 1', 'Setter 2', 'Outside 2', 'Middle 2'],
    about: 'Two setters across from each other. Whoever is in the front row sets, so there are only two front-row attackers. Simplest system for beginners.',
  },
}

export const isFront = (i: number) => i >= 1 && i <= 3 // positions 2, 3, 4

/** Slot index sitting in court position i+1 during a rotation (1–6). */
export const slotAt = (i: number, rotation: number) => (i + rotation - 1) % 6

export interface CourtSpot {
  playerId: string
  role: SlotRole
  libero: boolean
  /** Player the libero or a back-row sub is replacing. */
  replaced?: string
  /** True when a planned back-row sub is in. */
  sub?: boolean
}

/** Who is physically on court in each position, with the libero swapped in for back-row middles. */
export function onCourt(setup: TeamSetup, rotation: number, weServe: boolean): CourtSpot[] {
  const { roles } = SYSTEMS[setup.system]
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const slot = slotAt(i, rotation)
    const playerId = setup.slots[slot]
    const role = roles[slot]
    const servingMiddle = i === 0 && weServe
    if (setup.libero && role === 'MB' && !isFront(i) && !servingMiddle) {
      return { playerId: setup.libero, role, libero: true, replaced: playerId }
    }
    const ds = !isFront(i) && setup.subs?.find((s) => s.mode === 'backRow' && s.out === playerId)
    if (ds) return { playerId: ds.in, role, libero: false, replaced: playerId, sub: true }
    return { playerId, role, libero: false }
  })
}

/** Plain-language notes for a rotation: who sets, libero swaps, what changes next. */
export function rotationNotes(setup: TeamSetup, rotation: number, weServe: boolean, players: Player[]): string[] {
  const name = (id: string | null | undefined) => {
    const p = players.find((x) => x.id === id)
    return p ? `#${p.number} ${p.name}` : '?'
  }
  const { roles } = SYSTEMS[setup.system]
  const at = (role: SlotRole) => [0, 1, 2, 3, 4, 5].filter((i) => roles[slotAt(i, rotation)] === role)
  const id = (i: number) => setup.slots[slotAt(i, rotation)]
  const notes: string[] = []

  const setters = at('S')
  if (setup.system === '5-1') {
    const s = setters[0]
    notes.push(isFront(s)
      ? `Setter ${name(id(s))} is front row: 2 front-row hitters, setter can dump.`
      : `Setter ${name(id(s))} is back row: 3 front-row hitters.`)
  } else {
    const back = setters.find((i) => !isFront(i))!
    const front = setters.find((i) => isFront(i))!
    if (setup.system === '6-2') {
      notes.push(`${name(id(back))} sets from the back row. ${name(id(front))} hits right side.`)
    } else {
      notes.push(`${name(id(front))} sets from the front row. ${name(id(back))} plays back-row defense.`)
    }
  }

  if (setup.libero) {
    for (const i of at('MB')) {
      if (isFront(i)) continue
      if (i === 0 && weServe) notes.push(`${name(id(i))} serves; the libero replaces them once we lose the serve.`)
      else notes.push(`Libero ${name(setup.libero)} is in for ${name(id(i))}.`)
    }
    const leaving = at('MB').find((i) => i === 4)
    if (leaving !== undefined) notes.push(`Next rotation ${name(id(leaving))} moves to the front row, so the libero comes out.`)
  }

  for (const plan of setup.subs ?? []) {
    if (plan.mode !== 'backRow') continue
    const i = [0, 1, 2, 3, 4, 5].find((n) => id(n) === plan.out)
    if (i === undefined) continue
    if (!isFront(i)) notes.push(`Sub ${name(plan.in)} is in for ${name(plan.out)} (back row).`)
    if (i === 4) notes.push(`Next rotation ${name(plan.out)} returns to the front row for ${name(plan.in)}.`)
    if (i === 1) notes.push(`Next rotation ${name(plan.in)} comes in for ${name(plan.out)} to serve.`)
  }
  return notes
}

export type Phase = 'receive' | 'serve' | 'base' | 'defL' | 'defM' | 'defR'

export const PHASES: { id: Phase; label: string; help: string }[] = [
  { id: 'receive', label: 'Receiving', help: 'Serve receive. Overlap rules apply until the ball is served.' },
  { id: 'serve', label: 'Serving', help: 'Our serve. Overlap rules apply until the ball is served; the server is exempt.' },
  { id: 'base', label: 'Base', help: 'Ball on their side: everyone in their spot, ready to read the attack.' },
  { id: 'defL', label: 'Def left', help: 'They attack toward our left side: left front and middle block, others dig.' },
  { id: 'defM', label: 'Def middle', help: 'Their middle attacks: our middle blocks, outsides pull off the net.' },
  { id: 'defR', label: 'Def right', help: 'They attack toward our right side (their outside hitter): right front and middle block.' },
]

export const overlapApplies = (p: Phase) => p === 'receive' || p === 'serve'

type Lane = 'L' | 'M' | 'R'
type LaneSpots = { front: Record<Lane, Point>; back: Record<Lane, Point> }

const spots = (f: [number, number][], b: [number, number][]): LaneSpots => {
  const pt = ([x, y]: [number, number]) => ({ x, y })
  return {
    front: { L: pt(f[0]), M: pt(f[1]), R: pt(f[2]) },
    back: { L: pt(b[0]), M: pt(b[1]), R: pt(b[2]) },
  }
}

const LANE_SPOTS: Record<'base' | 'defL' | 'defM' | 'defR', LaneSpots> = {
  base: spots([[0.2, 0.12], [0.5, 0.12], [0.8, 0.12]], [[0.15, 0.68], [0.5, 0.85], [0.85, 0.68]]),
  defR: spots([[0.15, 0.38], [0.68, 0.1], [0.84, 0.1]], [[0.12, 0.68], [0.55, 0.9], [0.88, 0.6]]),
  defL: spots([[0.16, 0.1], [0.32, 0.1], [0.85, 0.38]], [[0.12, 0.6], [0.45, 0.9], [0.88, 0.68]]),
  defM: spots([[0.2, 0.35], [0.5, 0.1], [0.8, 0.35]], [[0.15, 0.62], [0.5, 0.9], [0.85, 0.62]]),
}

/** After the serve, players switch to their specialty lane. */
function lane(role: SlotRole, front: boolean): Lane {
  if (role === 'S' || role === 'OPP') return 'R'
  if (role === 'OH') return front ? 'L' : 'M'
  return front ? 'M' : 'L' // MB in front, libero/MB in back
}

/** Default spot for each position (index 0 = position 1) in a phase. */
export function defaultFormation(system: System, rotation: number, phase: Phase): Point[] {
  if (phase === 'receive') {
    // A simple legal layout: front row a step off the net, back row spread to pass.
    return HOME.map((p, i) => ({ x: p.x, y: isFront(i) ? 0.3 : 0.72 }))
  }
  if (phase === 'serve') {
    return HOME.map((p, i) => (i === 0 ? { x: 0.83, y: 0.97 } : p))
  }
  const { roles } = SYSTEMS[system]
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const front = isFront(i)
    return LANE_SPOTS[phase][front ? 'front' : 'back'][lane(roles[slotAt(i, rotation)], front)]
  })
}

export const formationKey = (system: System, rotation: number, phase: Phase) => `${system}|${rotation}|${phase}`
