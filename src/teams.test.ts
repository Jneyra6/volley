import { describe, expect, it } from 'vitest'
import type { Match } from './engine/types'
import { activeTeam, applyView, migrate, newSquad, teamView, type Root } from './teams'

const match = (id: string, teamId?: string): Match => ({
  id, teamId, opponent: 'x', date: 0, bestOf: 3,
  setup: { system: '5-1', slots: [], libero: null }, sets: [],
})

describe('teams', () => {
  it('migrates single-team data into "My Team"', () => {
    const root = migrate({ players: [{ id: 'p', number: 1, name: 'Ava', role: 'S' }], matches: [match('m')] })
    expect(root.teams).toHaveLength(1)
    expect(activeTeam(root)).toMatchObject({ name: 'My Team', players: [{ name: 'Ava' }] })
    expect(root.matches[0].teamId).toBe(root.teams[0].id)
  })

  it('shows and edits only the active team', () => {
    const a = { ...newSquad('A'), id: 'a' }
    const b = { ...newSquad('B'), id: 'b' }
    const root: Root = { teams: [a, b], activeTeamId: 'b', matches: [match('m1', 'a'), match('m2', 'b')] }

    const view = teamView(root)
    expect(view.matches.map((m) => m.id)).toEqual(['m2'])

    const next = applyView(root, {
      ...view,
      players: [{ id: 'p', number: 7, name: 'Zoe', role: 'MB' }],
      matches: [match('m3'), ...view.matches],
    })
    expect(next.teams.find((t) => t.id === 'a')!.players).toEqual([])
    expect(next.teams.find((t) => t.id === 'b')!.players).toHaveLength(1)
    expect(next.matches.map((m) => [m.id, m.teamId])).toEqual([['m3', 'b'], ['m2', 'b'], ['m1', 'a']])
  })
})
