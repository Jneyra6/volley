import { useState } from 'react'
import type { Player, Role } from '../engine/types'
import { newId, type Data } from '../store'
import { newSquad, type Root } from '../teams'
import { Backup } from './Backup'

/** Most players a team can carry. */
export const MAX_PLAYERS = 14

const ROLES: [Role, string][] = [
  ['S', 'Setter'], ['OH', 'Outside'], ['MB', 'Middle'], ['OPP', 'Opposite'], ['L', 'Libero'], ['DS', 'Defensive spec.'],
]

export function Roster({ data, setData, root, setRoot, switchTeam }: {
  data: Data
  setData: (f: (d: Data) => Data) => void
  root: Root
  setRoot: (f: (r: Root) => Root) => void
  switchTeam: (id: string) => void
}) {
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('OH')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(number)
    if (isNaN(n) || !name.trim() || data.players.length >= MAX_PLAYERS) return
    const p: Player = { id: newId(), number: n, name: name.trim(), role }
    setData((d) => ({ ...d, players: [...d.players, p].sort((a, b) => a.number - b.number) }))
    setNumber('')
    setName('')
  }

  return (
    <section>
      <TeamManager root={root} setRoot={setRoot} switchTeam={switchTeam} />
      <div className="card">
        <div className="card-head">
          <span className="card-title">Roster</span>
          <span className="muted small">{data.players.length} / {MAX_PLAYERS} players</span>
        </div>
        <form className="player-form" onSubmit={add}>
          <input className="num" inputMode="numeric" placeholder="#" aria-label="Jersey number" value={number} onChange={(e) => setNumber(e.target.value)} />
          <input placeholder="Player name" aria-label="Player name" value={name} onChange={(e) => setName(e.target.value)} />
          <select aria-label="Position" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map(([r, label]) => <option key={r} value={r}>{label}</option>)}
          </select>
          <button type="submit" className="primary" disabled={data.players.length >= MAX_PLAYERS}>Add</button>
        </form>
        {data.players.length >= MAX_PLAYERS && (
          <p className="empty">The roster is full ({MAX_PLAYERS} players). Remove a player to add someone new.</p>
        )}
        {data.players.length === 0 && <p className="empty">Add at least six players to set a lineup.</p>}
        <ul className="list">
          {data.players.map((p) => (
          <li key={p.id}>
            <span className="jersey">{p.number}</span>
            <span className="grow">{p.name}</span>
            <span className={`role role-${p.role}`}>{p.role}</span>
            <button
              className="link quiet"
              aria-label={`Remove ${p.name}`}
              onClick={() =>
                setData((d) => ({
                  ...d,
                  players: d.players.filter((x) => x.id !== p.id),
                  // Take them out of the lineup too.
                  setup: {
                    ...d.setup,
                    slots: d.setup.slots.map((id) => (id === p.id ? '' : id)),
                    libero: d.setup.libero === p.id ? null : d.setup.libero,
                  },
                }))
              }
            >
              Remove
            </button>
          </li>
          ))}
        </ul>
      </div>
      <Backup root={root} setRoot={(r) => setRoot(() => r)} />
    </section>
  )
}

/** Pick, create, rename and delete teams. Each team keeps its own roster, lineup, formations and matches. */
function TeamManager({ root, setRoot, switchTeam }: {
  root: Root
  setRoot: (f: (r: Root) => Root) => void
  switchTeam: (id: string) => void
}) {
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const active = root.teams.find((t) => t.id === root.activeTeamId) ?? root.teams[0]

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const team = newSquad(newName.trim())
    setRoot((r) => ({ ...r, teams: [...r.teams, team] }))
    switchTeam(team.id)
    setNewName('')
  }
  const rename = (e: React.FormEvent) => {
    e.preventDefault()
    const name = renaming?.trim()
    if (name) setRoot((r) => ({ ...r, teams: r.teams.map((t) => (t.id === active.id ? { ...t, name } : t)) }))
    setRenaming(null)
  }
  const remove = () => {
    const matches = root.matches.filter((m) => m.teamId === active.id).length
    const msg = `Delete ${active.name}? Its roster, lineup, formations and ${matches} match(es) will be removed from this device.`
    if (!window.confirm(msg)) return
    const rest = root.teams.filter((t) => t.id !== active.id)
    setRoot((r) => ({ ...r, teams: rest, matches: r.matches.filter((m) => m.teamId !== active.id) }))
    switchTeam(rest[0].id)
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Teams</span>
      </div>
      <div className="team-chips">
        {root.teams.map((t) => (
          <button key={t.id} className={t.id === active.id ? 'on' : ''} onClick={() => switchTeam(t.id)}>
            {t.name} <span className="count">{t.players.length}</span>
          </button>
        ))}
      </div>
      {renaming !== null ? (
        <form className="row" onSubmit={rename}>
          <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Team name" />
          <button type="submit">Save</button>
          <button type="button" className="link" onClick={() => setRenaming(null)}>Cancel</button>
        </form>
      ) : (
        <div className="row">
          <button className="link" onClick={() => setRenaming(active.name)}>Rename {active.name}</button>
          {root.teams.length > 1 && <button className="link danger" onClick={remove}>Delete team</button>}
        </div>
      )}
      <form className="row inline-form" onSubmit={create}>
        <input placeholder="New team name, e.g. 16U Gold" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" disabled={!newName.trim()}>Add team</button>
      </form>
    </div>
  )
}
