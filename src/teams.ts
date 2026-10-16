import type { TeamSetup } from './engine/systems'
import type { Match, Player, Point } from './engine/types'

/** A whole rotation saved under a name: system, lineup, libero, subs and every formation. */
export interface SavedPlan {
  id: string
  name: string
  setup: TeamSetup
  formations: Record<string, Point[]>
}

export interface Season {
  id: string
  name: string
}

/** One of your teams: its own roster, lineup and saved formations. */
export interface Squad {
  id: string
  name: string
  players: Player[]
  setup: TeamSetup
  /** Custom formations saved from the Rotations tab, keyed by formationKey(). */
  formations: Record<string, Point[]>
  plans?: SavedPlan[]
  seasons?: Season[]
  /** Removed players who still have stats in past matches, kept so reports and exports don't lose them. */
  archived?: Player[]
}

/** Everything the app stores. Matches belong to a team through match.teamId. */
export interface Root {
  teams: Squad[]
  activeTeamId: string
  matches: Match[]
}

/** What each screen works with: the active team's data and only its matches. */
export interface Data {
  players: Player[]
  matches: Match[]
  setup: TeamSetup
  formations: Record<string, Point[]>
  plans: SavedPlan[]
  seasons: Season[]
  archived: Player[]
}

export const newId = () => Math.random().toString(36).slice(2, 10)

export const newSquad = (name: string): Squad => ({
  id: newId(),
  name,
  players: [],
  setup: { system: '5-1', slots: ['', '', '', '', '', ''], libero: null },
  formations: {},
})

export const emptyRoot = (): Root => {
  const team = newSquad('My Team')
  return { teams: [team], activeTeamId: team.id, matches: [] }
}

/** Turn single-team data from earlier versions into one team called "My Team". */
export function migrate(old: Partial<Data>): Root {
  const team: Squad = {
    ...newSquad('My Team'),
    players: old.players ?? [],
    ...(old.setup ? { setup: old.setup } : {}),
    formations: old.formations ?? {},
  }
  return { teams: [team], activeTeamId: team.id, matches: (old.matches ?? []).map((m) => ({ ...m, teamId: team.id })) }
}

export const activeTeam = (root: Root) => root.teams.find((t) => t.id === root.activeTeamId) ?? root.teams[0]

export function teamView(root: Root): Data {
  const t = activeTeam(root)
  return {
    players: t.players, setup: t.setup, formations: t.formations, plans: t.plans ?? [], seasons: t.seasons ?? [], archived: t.archived ?? [],
    matches: root.matches.filter((m) => m.teamId === t.id),
  }
}

/** Write a changed team view back: team fields into the team, its matches replacing the old ones. */
export function applyView(root: Root, view: Data): Root {
  const t = activeTeam(root)
  return {
    ...root,
    teams: root.teams.map((x) =>
      x.id === t.id ? { ...x, players: view.players, setup: view.setup, formations: view.formations, plans: view.plans, seasons: view.seasons, archived: view.archived } : x,
    ),
    matches: [...view.matches.map((m) => ({ ...m, teamId: t.id })), ...root.matches.filter((m) => m.teamId !== t.id)],
  }
}

/** Everyone who has played for the team: current roster plus archived players, for reports and exports. */
export const everyone = (d: Data) => [...d.players, ...d.archived]

/** True if the player appears anywhere in this team's matches (stats, lineups or subs). */
export function hasMatchHistory(d: Data, playerId: string) {
  return d.matches.some(
    (m) =>
      m.setup.slots.includes(playerId) || m.setup.libero === playerId ||
      m.sets.some((s) => s.events.some((e) => e.playerId === playerId || e.out === playerId) || s.setup?.slots.includes(playerId)),
  )
}
