import type { TeamSetup } from './systems'


export type Role = 'S' | 'OH' | 'MB' | 'OPP' | 'L' | 'DS'

export interface Player {
  id: string
  number: number
  name: string
  role: Role
}

export type Team = 'us' | 'them'

/** Six player ids, index 0 = court position 1 (right back, server) … index 5 = position 6. */
export type Lineup = string[]

export type Family = 'earned' | 'error' | 'rally'

export interface ActionDef {
  code: string
  label: string
  family: Family
  group: 'serve' | 'receive' | 'attack' | 'block' | 'defense' | 'set' | 'fault' | 'timeout' | 'adjust' | 'sub'
}

/** One tap during a set. Everything else (score, rotation, stats) is derived by replaying these. */
export interface StatEvent {
  id: string
  time: number
  code: string
  /** Who did it. Missing only on events from older versions (then inferred from the code). */
  team?: Team
  /** Our player; null for the opponent. */
  playerId: string | null
  /** Pass/serve quality, 0–3, for rated rally actions. */
  rating?: number
  /** Attack type or fault kind, e.g. 'tip' or 'net'. */
  detail?: string
  /** Manual score change ('adjust' events): points added to `team`, can be negative. */
  delta?: number
  /** Lineup change ('sub' events): the player going out. playerId is the player coming in. */
  out?: string
}

export interface GameSet {
  lineup: Lineup
  firstServe: Team
  events: StatEvent[]
  /** Lineup this set started with, when it differs from the match's (e.g. a sub carried over from the last set). */
  setup?: TeamSetup
}

export type MatchType = 'region' | 'nonRegion' | 'tournament' | 'playoff' | 'scrimmage' | 'other'

export const MATCH_TYPES: { id: MatchType; label: string }[] = [
  { id: 'region', label: 'Region' },
  { id: 'nonRegion', label: 'Non-region' },
  { id: 'tournament', label: 'Tournament' },
  { id: 'playoff', label: 'Playoff' },
  { id: 'scrimmage', label: 'Scrimmage' },
  { id: 'other', label: 'Other' },
]

/** Scrimmages don't count toward the season by default; everything else does. */
export const countsByDefault = (type: MatchType) => type !== 'scrimmage'

export interface Match {
  id: string
  /** The team (from the Roster tab) that played this match. */
  teamId?: string
  opponent: string
  /** When the match starts (date and time, ms since epoch). */
  date: number
  /** Missing on matches from earlier versions: treated as 'other', counting toward the season. */
  type?: MatchType
  location?: string
  venue?: 'home' | 'away' | 'neutral'
  /** Tournament or event name, for tournament and playoff matches. */
  event?: string
  seasonId?: string
  /** Counts toward the season record and season stats. */
  countsInSeason?: boolean
  bestOf: 3 | 5
  setup: TeamSetup
  /** Saved rotation the match was started from, and its formations (used by the Match court). */
  planName?: string
  formations?: Record<string, Point[]>
  sets: GameSet[]
}

export interface Point {
  x: number
  y: number
}
