import { useState } from 'react'
import { SYSTEMS, type SubPlan, type System, type TeamSetup } from '../engine/systems'
import type { Player } from '../engine/types'

export const setupComplete = (s: TeamSetup) => s.slots.length === 6 && s.slots.every(Boolean)

/** Pick the system, then a player for each role slot and an optional libero. */
export function SetupEditor({ players, setup, onChange }: {
  players: Player[]
  setup: TeamSetup
  onChange: (s: TeamSetup) => void
}) {
  const sys = SYSTEMS[setup.system]
  const used = [...setup.slots, setup.libero]
  const options = (current: string | null) =>
    players.map((p) => (
      <option key={p.id} value={p.id} disabled={used.includes(p.id) && p.id !== current}>
        #{p.number} {p.name} ({p.role})
      </option>
    ))

  return (
    <div>
      <div className="seg">
        {(Object.keys(SYSTEMS) as System[]).map((s) => (
          <button key={s} className={s === setup.system ? 'on' : ''} onClick={() => onChange({ ...setup, system: s })}>
            {s}
          </button>
        ))}
      </div>
      <p className="muted small">{sys.about}</p>
      <div className="lineup">
        {sys.labels.map((label, i) => (
          <label key={i}>
            <span>{label} · starts in position {i + 1}</span>
            <select
              value={setup.slots[i] ?? ''}
              onChange={(e) => onChange({ ...setup, slots: Object.assign([...setup.slots], { [i]: e.target.value }) })}
            >
              <option value="">—</option>
              {options(setup.slots[i])}
            </select>
          </label>
        ))}
        <label>
          <span>Libero (replaces back-row middles)</span>
          <select value={setup.libero ?? ''} onChange={(e) => onChange({ ...setup, libero: e.target.value || null })}>
            <option value="">No libero</option>
            {options(setup.libero)}
          </select>
        </label>
      </div>
      <SubsEditor players={players} setup={setup} onChange={onChange} />
    </div>
  )
}

/** Planned subs for bench players: a back-row specialist, or a sub you have ready for the match. */
function SubsEditor({ players, setup, onChange }: { players: Player[]; setup: TeamSetup; onChange: (s: TeamSetup) => void }) {
  const subs = setup.subs ?? []
  const starters = setup.slots.filter(Boolean)
  const bench = players.filter((p) => !starters.includes(p.id) && p.id !== setup.libero)
  const [plan, setPlan] = useState<SubPlan>({ in: '', out: '', mode: 'backRow' })
  if (bench.length === 0) return null

  const label = (id: string) => {
    const p = players.find((x) => x.id === id)
    return p ? `#${p.number} ${p.name}` : '?'
  }
  const add = () => {
    if (!plan.in || !plan.out) return
    onChange({ ...setup, subs: [...subs.filter((s) => s.in !== plan.in), plan] })
    setPlan({ in: '', out: '', mode: plan.mode })
  }

  return (
    <div className="subs">
      <div className="subhead">Subs</div>
      <p className="muted small">
        <b>Back row only</b>: the sub replaces the starter every time they rotate to the back row (like a DS for an
        outside hitter). <b>Ready</b>: a sub you plan to use; it shows as a one-tap swap in Match.
      </p>
      {subs.length > 0 && (
        <ul className="list">
          {subs.map((s) => (
            <li key={s.in}>
              <span className="grow">
                {label(s.in)} <span className="muted">for</span> {label(s.out)}
              </span>
              <span className="role">{s.mode === 'backRow' ? 'Back row' : 'Ready'}</span>
              <button className="link quiet" aria-label={`Remove sub ${label(s.in)}`}
                onClick={() => onChange({ ...setup, subs: subs.filter((x) => x !== s) })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sub-form">
        <select aria-label="Sub coming in" value={plan.in} onChange={(e) => setPlan({ ...plan, in: e.target.value })}>
          <option value="">Sub in…</option>
          {bench.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name} ({p.role})</option>)}
        </select>
        <select aria-label="Starter going out" value={plan.out} onChange={(e) => setPlan({ ...plan, out: e.target.value })}>
          <option value="">For…</option>
          {starters.map((id) => <option key={id} value={id}>{label(id)}</option>)}
        </select>
        <select aria-label="When" value={plan.mode} onChange={(e) => setPlan({ ...plan, mode: e.target.value as SubPlan['mode'] })}>
          <option value="backRow">Back row only</option>
          <option value="ready">Ready</option>
        </select>
        <button disabled={!plan.in || !plan.out} onClick={add}>Add sub</button>
      </div>
    </div>
  )
}
