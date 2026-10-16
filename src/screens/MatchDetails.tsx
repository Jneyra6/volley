import { useState } from 'react'
import { MATCH_TYPES, countsByDefault, type Match, type MatchType } from '../engine/types'
import { newId } from '../store'
import type { Season } from '../teams'

export type Details = Pick<Match, 'type' | 'date' | 'location' | 'venue' | 'event' | 'seasonId' | 'countsInSeason'>

/** "2026-10-15T18:30" for a datetime-local input, in local time. */
const toLocalInput = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const typeLabel = (t?: MatchType) => MATCH_TYPES.find((x) => x.id === (t ?? 'other'))!.label

export const defaultDetails = (seasons: Season[]): Details => ({
  type: 'region',
  date: Date.now(),
  location: '',
  venue: 'home',
  event: '',
  seasonId: seasons[seasons.length - 1]?.id,
  countsInSeason: true,
})

/** Match type, date and time, place, tournament name, season, and whether it counts toward the season. */
export function MatchDetailsForm({ value, onChange, seasons, onAddSeason }: {
  value: Details
  onChange: (d: Details) => void
  seasons: Season[]
  onAddSeason: (s: Season) => void
}) {
  const [newSeason, setNewSeason] = useState<string | null>(null)
  const set = (patch: Partial<Details>) => onChange({ ...value, ...patch })
  const type = value.type ?? 'other'

  const addSeason = () => {
    const name = newSeason?.trim()
    if (!name) return
    const s = { id: newId(), name }
    onAddSeason(s)
    set({ seasonId: s.id })
    setNewSeason(null)
  }

  return (
    <div className="details-form">
      <label className="field">
        <span>Match type</span>
        <select value={type} onChange={(e) => {
          const t = e.target.value as MatchType
          set({ type: t, countsInSeason: countsByDefault(t) })
        }}>
          {MATCH_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      {(type === 'tournament' || type === 'playoff') && (
        <label className="field">
          <span>{type === 'tournament' ? 'Tournament name' : 'Playoff round or event'}</span>
          <input value={value.event ?? ''} placeholder={type === 'tournament' ? 'e.g. Fall Classic' : 'e.g. Region semifinal'}
            onChange={(e) => set({ event: e.target.value })} />
        </label>
      )}
      <label className="field">
        <span>Date and time</span>
        <input type="datetime-local" value={toLocalInput(value.date)}
          onChange={(e) => e.target.value && set({ date: new Date(e.target.value).getTime() })} />
      </label>
      <label className="field">
        <span>Location</span>
        <input value={value.location ?? ''} placeholder="Gym or school" onChange={(e) => set({ location: e.target.value })} />
      </label>
      <div className="seg">
        {(['home', 'away', 'neutral'] as const).map((v) => (
          <button key={v} className={value.venue === v ? 'on' : ''} onClick={() => set({ venue: v })}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Season</span>
        {newSeason === null ? (
          <select value={value.seasonId ?? ''} onChange={(e) => (e.target.value === '+' ? setNewSeason('') : set({ seasonId: e.target.value || undefined }))}>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="">No season</option>
            <option value="+">+ New season…</option>
          </select>
        ) : (
          <span className="row inline-form">
            <input autoFocus placeholder="e.g. 2026 Fall" value={newSeason} onChange={(e) => setNewSeason(e.target.value)} />
            <button className="primary" disabled={!newSeason.trim()} onClick={addSeason}>Add</button>
            <button className="link" onClick={() => setNewSeason(null)}>Cancel</button>
          </span>
        )}
      </label>
      <label className="check">
        <input type="checkbox" checked={value.countsInSeason ?? true} onChange={(e) => set({ countsInSeason: e.target.checked })} />
        <span>
          Counts toward the season record and stats
          <span className="muted small"> · scrimmages are off by default</span>
        </span>
      </label>
    </div>
  )
}
