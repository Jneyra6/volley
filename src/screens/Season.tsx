import { useState } from 'react'
import { ATTACK_TYPES } from '../engine/actions'
import { downloadText } from '../download'
import { fileSlug, statSheet, toCsv } from '../engine/export'
import { matchSummary } from '../engine/match'
import { record, seasonLines } from '../engine/report'
import { fmt, teamRates } from '../engine/stats'
import { MATCH_TYPES, type MatchType } from '../engine/types'
import { newId, type Data } from '../store'
import { MatchMeta } from './MatchScreen'
import { StatTable } from './StatTable'

/** '' = every match, 'none' = matches with no season, otherwise a season id. */
type SeasonFilter = string

/** Totals across games: record, team rates and player stats, filtered by season and match type. */
export function Season({ data, setData, teamName }: { data: Data; setData: (f: (d: Data) => Data) => void; teamName: string }) {
  const [seasonId, setSeasonId] = useState<SeasonFilter>(() => data.seasons[data.seasons.length - 1]?.id ?? '')
  const [types, setTypes] = useState<MatchType[]>(MATCH_TYPES.map((t) => t.id))
  const [seasonOnly, setSeasonOnly] = useState(true)
  const [newSeason, setNewSeason] = useState('')

  const matches = data.matches
    .filter((m) => (seasonId === '' ? true : seasonId === 'none' ? !m.seasonId : m.seasonId === seasonId))
    .filter((m) => types.includes(m.type ?? 'other'))
    .filter((m) => !seasonOnly || m.countsInSeason !== false)
    .sort((a, b) => a.date - b.date)

  const totals = seasonLines(matches)
  const rec = record(matches)
  const rates = teamRates(totals.events)
  const ourKills = totals.lines.reduce<Record<string, number>>((acc, l) => {
    for (const [k, v] of Object.entries(l.counts.killTypes)) acc[k] = (acc[k] ?? 0) + v
    return acc
  }, {})
  const seasonName = seasonId === '' ? 'All seasons' : seasonId === 'none' ? 'No season' : data.seasons.find((s) => s.id === seasonId)?.name ?? ''

  const toggleType = (t: MatchType) => setTypes((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
  const addSeason = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newSeason.trim()
    if (!name) return
    const s = { id: newId(), name }
    setData((d) => ({ ...d, seasons: [...d.seasons, s] }))
    setSeasonId(s.id)
    setNewSeason('')
  }
  const exportCsv = () => {
    const filters = [
      ['Team', teamName],
      ['Season', seasonName],
      ['Match types', MATCH_TYPES.filter((t) => types.includes(t.id)).map((t) => t.label).join(', ')],
      ['Season games only', seasonOnly ? 'Yes' : 'No'],
      ['Record', `${rec.overall.w}-${rec.overall.l}`],
      ['Matches', matches.length],
      ['Sets', totals.sets],
      [],
    ]
    downloadText(`season-${fileSlug(teamName)}-${fileSlug(seasonName)}.csv`, toCsv([...filters, ...statSheet(totals.lines, data.players)]), 'text/csv')
  }

  return (
    <section>
      <div className="card">
        <label className="field">
          <span>Season</span>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            {data.seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="">All seasons</option>
            <option value="none">No season</option>
          </select>
        </label>
        <div className="filter-chips" role="group" aria-label="Match types">
          {MATCH_TYPES.map((t) => (
            <button key={t.id} className={types.includes(t.id) ? 'on' : ''} aria-pressed={types.includes(t.id)} onClick={() => toggleType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={seasonOnly} onChange={(e) => setSeasonOnly(e.target.checked)} />
          <span>Season games only <span className="muted small">· leaves out matches marked as not counting (like scrimmages)</span></span>
        </label>
        <form className="row inline-form" onSubmit={addSeason}>
          <input placeholder="New season, e.g. 2026 Fall" aria-label="New season name" value={newSeason} onChange={(e) => setNewSeason(e.target.value)} />
          <button type="submit" disabled={!newSeason.trim()}>Add season</button>
        </form>
      </div>

      {matches.length === 0 ? (
        <div className="card"><p className="empty">No matches fit these filters yet.</p></div>
      ) : (
        <>
          <div className="card">
            <div className="card-head">
              <span className="card-title">Record</span>
              <span className="muted small">{matches.length} matches · {totals.sets} sets</span>
            </div>
            <div className="stat-tiles">
              <div className="tile"><span className="eyebrow">Overall</span><b className="tabular">{rec.overall.w}–{rec.overall.l}</b></div>
              {MATCH_TYPES.filter((t) => rec.byType[t.id].w + rec.byType[t.id].l > 0).map((t) => (
                <div key={t.id} className="tile">
                  <span className="eyebrow">{t.label}</span>
                  <b className="tabular">{rec.byType[t.id].w}–{rec.byType[t.id].l}</b>
                </div>
              ))}
              <div className="tile"><span className="eyebrow">Sets</span><b className="tabular">{rec.setsWon}–{rec.setsLost}</b></div>
              <div className="tile"><span className="eyebrow">Side-out</span><b className="tabular">{fmt.pct(rates.sideOutPct)}</b></div>
              <div className="tile"><span className="eyebrow">Point-scoring</span><b className="tabular">{fmt.pct(rates.pointScoringPct)}</b></div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Player totals</div>
            <StatTable lines={totals.lines} players={data.players} />
          </div>

          {Object.keys(ourKills).length > 0 && (
            <div className="card">
              <div className="card-title">Kills by type</div>
              <div className="chips">
                {ATTACK_TYPES.filter(([k]) => ourKills[k]).map(([k, label]) => <span key={k}>{label} <b>{ourKills[k]}</b></span>)}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <span className="card-title">Matches</span>
              <span className="muted small">{matches.length}</span>
            </div>
            <ul className="list">
              {matches.map((m) => {
                const s = matchSummary(m)
                const badge = s.winner === 'us' ? 'W' : s.winner === 'them' ? 'L' : 'Live'
                return (
                  <li key={m.id}>
                    <span className="grow">
                      <span className="strong">vs {m.opponent}</span>
                      <MatchMeta match={m} />
                    </span>
                    <span className="tabular">{s.won}–{s.lost}</span>
                    <span className={`badge badge-${badge.toLowerCase()}`}>{badge}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="card">
            <div className="card-title">Export</div>
            <button className="primary block" onClick={exportCsv}>Season spreadsheet (.csv)</button>
            <p className="muted small">
              Totals for the matches shown above, with sets played and per-set numbers. MaxPreps takes stats one game at a time:
              export each game from the Game tab.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
