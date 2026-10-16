import { useState } from 'react'
import { Court } from '../Court'
import { overlapViolations } from '../engine/rotation'
import {
  PHASES, defaultFormation, formationKey, onCourt, overlapApplies, rotationNotes, type Phase,
} from '../engine/systems'
import type { Point } from '../engine/types'
import { newId, type Data } from '../store'
import { SetupEditor, setupComplete } from './SetupEditor'

/**
 * Step through the six rotations of a system in each phase. Dragged positions save as soon as you let go,
 * and the Match tab uses saved Serving / Receiving formations.
 */
export function Rotations({ data, setData }: { data: Data; setData: (f: (d: Data) => Data) => void }) {
  const { setup } = data
  const [rotation, setRotation] = useState(1)
  const [phase, setPhase] = useState<Phase>('receive')
  const [draft, setDraft] = useState<Point[] | null>(null) // positions while a drag is in progress

  const key = formationKey(setup.system, rotation, phase)
  const saved = data.formations[key]
  const spots = draft ?? saved ?? defaultFormation(setup.system, rotation, phase)
  const weServe = phase !== 'receive'
  const court = onCourt(setup, rotation, weServe)
  const notes = rotationNotes(setup, rotation, weServe, data.players)
  const info = PHASES.find((p) => p.id === phase)!
  const violations = overlapApplies(phase) ? overlapViolations(spots, phase === 'serve') : []

  const go = (r: number) => {
    setRotation(((r + 5) % 6) + 1)
    setDraft(null)
  }
  const pick = (p: Phase) => {
    setPhase(p)
    setDraft(null)
  }
  const save = (i: number, p: Point) => {
    const base = data.formations[key] ?? defaultFormation(setup.system, rotation, phase)
    setData((d) => ({ ...d, formations: { ...d.formations, [key]: Object.assign([...base], { [i]: p }) } }))
    setDraft(null)
  }
  const reset = () => {
    setData((d) => {
      const formations = { ...d.formations }
      delete formations[key]
      return { ...d, formations }
    })
    setDraft(null)
  }

  return (
    <section>
      <details className="card" open={!setupComplete(setup)}>
        <summary>
          <span className="card-title">System and lineup</span>
          <span className="pill">{setup.system}</span>
        </summary>
        <SetupEditor players={data.players} setup={setup} onChange={(s) => setData((d) => ({ ...d, setup: s }))} />
      </details>

      <SavedRotations data={data} setData={setData} />

      <div className="card">
        <div className="stepper">
          <button className="icon" onClick={() => go(rotation - 1)} aria-label="Previous rotation">‹</button>
          <div>
            <div className="eyebrow">Rotation</div>
            <div className="stepper-value">{rotation} <span className="muted">/ 6</span></div>
          </div>
          <button className="icon" onClick={() => go(rotation + 1)} aria-label="Next rotation">›</button>
        </div>
        <div className="seg wrap">
          {PHASES.map((p) => (
            <button key={p.id} className={p.id === phase ? 'on' : ''} onClick={() => pick(p.id)}>{p.label}</button>
          ))}
        </div>
        <p className="muted small">{info.help}</p>

        <Court
          court={court}
          players={data.players}
          spots={spots}
          server={phase === 'serve'}
          onMove={(i, p) => setDraft(Object.assign([...spots], { [i]: p }))}
          onDrop={save}
        />

        <div className="row between">
          <span className="muted small">
            {saved ? 'Your formation (saved)' : 'Default formation · drag players to change it'}
            {saved && overlapApplies(phase) ? ' · used in Match' : ''}
          </span>
          <button className="link" disabled={!saved} onClick={reset}>Reset</button>
        </div>

        {overlapApplies(phase) &&
          (violations.length === 0 ? (
            <p className="status ok">✓ Legal at the moment of serve</p>
          ) : (
            <ul className="status bad">{violations.map((v) => <li key={v}>Overlap: {v}</li>)}</ul>
          ))}
      </div>

      {setupComplete(setup) && notes.length > 0 && (
        <div className="card">
          <div className="card-title">In this rotation</div>
          <ul className="notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

/** Save the whole rotation (system, lineup, libero, subs, every formation) under a name, and load it back. */
function SavedRotations({ data, setData }: { data: Data; setData: (f: (d: Data) => Data) => void }) {
  const [name, setName] = useState('')
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setData((d) => {
      const existing = d.plans.find((p) => p.name.toLowerCase() === n.toLowerCase())
      const plan = { id: existing?.id ?? newId(), name: n, setup: d.setup, formations: d.formations }
      return { ...d, plans: existing ? d.plans.map((p) => (p.id === existing.id ? plan : p)) : [...d.plans, plan] }
    })
    setName('')
  }
  const load = (id: string) =>
    setData((d) => {
      const plan = d.plans.find((p) => p.id === id)!
      return { ...d, setup: plan.setup, formations: plan.formations }
    })
  const remove = (id: string) => setData((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) }))

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Saved rotations</span>
        <span className="muted small">{data.plans.length}</span>
      </div>
      {data.plans.length === 0 ? (
        <p className="empty">Save this lineup, its subs and all your formations to pick it when you start a match.</p>
      ) : (
        <ul className="list">
          {data.plans.map((p) => (
            <li key={p.id}>
              <span className="grow strong">{p.name}</span>
              <span className="pill">{p.setup.system}</span>
              <button className="link small" onClick={() => load(p.id)}>Load</button>
              <button className="link quiet" aria-label={`Delete ${p.name}`} onClick={() => remove(p.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <form className="row inline-form" onSubmit={save}>
        <input placeholder="Name, e.g. 5-1 Starters" aria-label="Rotation name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary" disabled={!name.trim()}>Save</button>
      </form>
      <p className="muted small">Saving with an existing name updates that rotation.</p>
    </div>
  )
}
