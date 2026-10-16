import { useState } from 'react'
import { ATTACK_TYPES, FAULT_KINDS } from '../engine/actions'
import { manualChanges } from '../engine/match'
import { replay, teamOf, type AnnotatedEvent } from '../engine/rotation'
import { count, fmt, teamRates, type Counts } from '../engine/stats'
import { downloadText } from '../download'
import { fileSlug, matchInfoRows, maxPrepsFile, statSheet, toCsv } from '../engine/export'
import { matchLines } from '../engine/report'
import type { Data } from '../store'
import { MatchMeta } from './MatchScreen'
import { StatTable } from './StatTable'

/** Report for one game: scores, team rates, player stats, and exports (MaxPreps and spreadsheet). */
export function Reports({ data, teamName }: { data: Data; teamName: string }) {
  const sorted = [...data.matches].sort((a, b) => b.date - a.date)
  const [matchId, setMatchId] = useState(sorted[0]?.id ?? '')
  const match = data.matches.find((m) => m.id === matchId)
  if (!match) return <section><div className="card"><div className="card-title">Game report</div><p className="empty">Record a match for this team first.</p></div></section>

  const report = matchLines(match)
  const d = new Date(match.date)
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const base = `${day}-${fileSlug(match.opponent)}`
  const exportMaxPreps = () => downloadText(`maxpreps-${base}.txt`, maxPrepsFile(report.lines, data.players))
  const exportCsv = () =>
    downloadText(`stats-${base}.csv`, toCsv([...matchInfoRows(match, teamName), ...statSheet(report.lines, data.players)]), 'text/csv')

  const events: AnnotatedEvent[] = match.sets.flatMap((s) => replay(s).events)
  const team = teamRates(events)
  const used = (c: Counts) => Object.values(c).some((v) => typeof v === 'number' && v > 0)
  const rows = [
    ...data.players.map((p) => ({ id: p.id, label: `#${p.number} ${p.name}`, c: count(events.filter((e) => e.playerId === p.id)) })),
    { id: 'them', label: 'Opponent', c: count(events.filter((e) => teamOf(e) === 'them')) },
  ].filter(({ c }) => used(c))
  const ours = count(events.filter((e) => teamOf(e) === 'us'))

  const byRotation = [1, 2, 3, 4, 5, 6].map((r) => {
    const inRot = events.filter((e) => e.before.rotation === r && e.winner)
    return { r, won: inRot.filter((e) => e.winner === 'us').length, lost: inRot.filter((e) => e.winner === 'them').length }
  })

  return (
    <section>
      <div className="card">
        <select aria-label="Match" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
          {sorted.map((m) => (
            <option key={m.id} value={m.id}>vs {m.opponent} · {new Date(m.date).toLocaleDateString()}</option>
          ))}
        </select>
        <MatchMeta match={match} />
        <div className="stat-tiles">
          {match.sets.map((s, i) => {
            const { state } = replay(s)
            return (
              <div key={i} className="tile">
                <span className="eyebrow">Set {i + 1}</span>
                <b className="tabular">{state.us}–{state.them}</b>
              </div>
            )
          })}
          <div className="tile">
            <span className="eyebrow">Side-out</span>
            <b className="tabular">{fmt.pct(team.sideOutPct)}</b>
          </div>
          <div className="tile">
            <span className="eyebrow">Point-scoring</span>
            <b className="tabular">{fmt.pct(team.pointScoringPct)}</b>
          </div>
        </div>
        <ManualChanges sets={match.sets.map(manualChanges)} />
      </div>

      <div className="card">
        <div className="card-title">Players</div>
        <StatTable lines={report.lines} players={data.players} opponent={rows.find((r) => r.id === 'them')?.c} />
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Export</span>
        </div>
        <div className="export-buttons">
          <button className="primary" onClick={exportMaxPreps}>MaxPreps file (.txt)</button>
          <button onClick={exportCsv}>Spreadsheet (.csv)</button>
        </div>
        <p className="muted small">
          In MaxPreps, open this game, choose to import stats, and pick the .txt file. Jersey numbers must match your
          MaxPreps roster exactly. The spreadsheet opens in Excel, Numbers or Google Sheets.
        </p>
      </div>

      {(Object.keys(ours.killTypes).length > 0 || Object.keys(ours.faultKinds).length > 0) && (
        <div className="card">
          <Breakdown title="Our kills by type" kinds={ATTACK_TYPES} counts={ours.killTypes} />
          <Breakdown title="Our faults" kinds={FAULT_KINDS} counts={ours.faultKinds} />
        </div>
      )}

      <div className="card">
      <div className="card-title">By rotation</div>
      <table>
        <thead><tr><th>Rotation</th><th>Won</th><th>Lost</th><th>+/−</th></tr></thead>
        <tbody>
          {byRotation.map(({ r, won, lost }) => (
            <tr key={r}><td>{r}</td><td>{won}</td><td>{lost}</td><td className={won - lost < 0 ? 'neg' : won - lost > 0 ? 'pos' : ''}>{won - lost > 0 ? '+' : ''}{won - lost}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  )
}

function Breakdown({ title, kinds, counts }: { title: string; kinds: [string, string][]; counts: Record<string, number> }) {
  const shown = kinds.filter(([k]) => counts[k])
  if (shown.length === 0) return null
  return (
    <>
      <div className="card-title">{title}</div>
      <div className="chips">
        {shown.map(([k, label]) => <span key={k}>{label} <b>{counts[k]}</b></span>)}
      </div>
    </>
  )
}

/** Score changes made by hand on the scoreboard, kept apart from points won in rallies. */
function ManualChanges({ sets }: { sets: ReturnType<typeof manualChanges>[] }) {
  const changed = sets.map((c, i) => ({ ...c, set: i + 1 })).filter((c) => c.count > 0)
  if (changed.length === 0) return null
  const fmtDelta = (n: number) => (n > 0 ? `+${n}` : String(n))
  return (
    <>
      <div className="subhead">Manual changes</div>
      <ul className="notes">
        {changed.map((c) => (
          <li key={c.set}>
            Set {c.set}: Us {fmtDelta(c.us)}, Them {fmtDelta(c.them)}
            <span className="muted"> ({c.count} edit{c.count === 1 ? '' : 's'})</span>
          </li>
        ))}
      </ul>
      <p className="muted small">Set scores include these; player and team stats only count real rallies.</p>
    </>
  )
}
