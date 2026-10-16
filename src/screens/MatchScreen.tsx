import { useEffect, useState } from 'react'
import { Court } from '../Court'
import { ACTIONS, ACTION_BY_CODE, DETAILS, RATINGS, actionAllowed, detailLabel } from '../engine/actions'
import { TIMEOUTS_PER_SET, currentSetup, matchSummary, rallyInProgress, setTarget, subsUsed, timeoutsUsed } from '../engine/match'
import { replay, teamOf } from '../engine/rotation'
import { SYSTEMS, defaultFormation, formationKey, onCourt } from '../engine/systems'
import type { Match, StatEvent, Team } from '../engine/types'
import { newId, type Data } from '../store'
import { MatchDetailsForm, defaultDetails, typeLabel, type Details } from './MatchDetails'
import { SetupEditor, setupComplete } from './SetupEditor'

type SetData = (f: (d: Data) => Data) => void

export function MatchScreen({ data, setData, openId, setOpenId }: {
  data: Data
  setData: SetData
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  const match = data.matches.find((m) => m.id === openId)
  if (match) return <Live data={data} setData={setData} match={match} close={() => setOpenId(null)} />
  return <NewMatch data={data} setData={setData} open={setOpenId} />
}

function NewMatch({ data, setData, open }: { data: Data; setData: SetData; open: (id: string) => void }) {
  const [opponent, setOpponent] = useState('')
  const [bestOf, setBestOf] = useState<3 | 5>(3)
  const [firstServe, setFirstServe] = useState<Team>('us')
  const [details, setDetails] = useState<Details>(() => defaultDetails(data.seasons))
  /** A saved rotation's id, or '' for the current lineup on the Rotations tab. */
  const [planId, setPlanId] = useState(() => data.plans[0]?.id ?? '')
  const plan = data.plans.find((p) => p.id === planId)
  const setup = plan?.setup ?? data.setup
  const ready = opponent.trim() && setupComplete(setup)

  const create = () => {
    const m: Match = {
      id: newId(), opponent: opponent.trim(), ...details, bestOf, setup,
      planName: plan?.name, formations: plan?.formations,
      sets: [{ lineup: setup.slots, firstServe, events: [] }],
    }
    setData((d) => ({ ...d, matches: [m, ...d.matches] }))
    open(m.id)
  }

  return (
    <section>
      {data.matches.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Matches</span>
            <span className="muted small">{data.matches.length}</span>
          </div>
          <ul className="list">
            {[...data.matches].sort((a, b) => b.date - a.date).map((m) => {
              const s = matchSummary(m)
              const badge = s.winner === 'us' ? 'W' : s.winner === 'them' ? 'L' : 'Live'
              return (
                <li key={m.id}>
                  <button className="row-button" onClick={() => open(m.id)}>
                    <span className="grow">
                      <span className="strong">vs {m.opponent}</span>
                      <MatchMeta match={m} />
                    </span>
                    <span className="tabular">{s.won}–{s.lost}</span>
                    <span className={`badge badge-${badge.toLowerCase()}`}>{badge}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-title">New match</div>
        <input placeholder="Opponent" aria-label="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
        <MatchDetailsForm
          value={details}
          onChange={setDetails}
          seasons={data.seasons}
          onAddSeason={(season) => setData((d) => ({ ...d, seasons: [...d.seasons, season] }))}
        />
        <div className="field-row">
          <div className="seg">
            <button className={bestOf === 3 ? 'on' : ''} onClick={() => setBestOf(3)}>Best of 3</button>
            <button className={bestOf === 5 ? 'on' : ''} onClick={() => setBestOf(5)}>Best of 5</button>
          </div>
          <div className="seg">
            <button className={firstServe === 'us' ? 'on' : ''} onClick={() => setFirstServe('us')}>We serve</button>
            <button className={firstServe === 'them' ? 'on' : ''} onClick={() => setFirstServe('them')}>They serve</button>
          </div>
        </div>
        <label className="field">
          <span>Rotation</span>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {data.plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.setup.system})</option>)}
            <option value="">Current lineup (not saved)</option>
          </select>
        </label>
        {plan ? (
          <p className="muted small">
            Uses the saved lineup, subs and formations from “{plan.name}”. Edit it on the Rotations tab.
          </p>
        ) : (
          <details className="inset" open={!setupComplete(data.setup)}>
            <summary>
              <span>System and lineup</span>
              <span className="pill">{data.setup.system}</span>
            </summary>
            {data.players.length < 6 && <p className="empty">Add at least six players on the Roster tab first.</p>}
            <SetupEditor players={data.players} setup={data.setup} onChange={(s) => setData((d) => ({ ...d, setup: s }))} />
          </details>
        )}
        <button className="primary block" disabled={!ready} onClick={create}>Start match</button>
      </div>
    </section>
  )
}

function Live({ data, setData, match, close }: { data: Data; setData: SetData; match: Match; close: () => void }) {
  /** A player id, 'them' for the opponent, or null. */
  const [selected, setSelected] = useState<string | null>(null)
  /** Action waiting for its rating or "what kind?" answer. */
  const [pending, setPending] = useState<{ code: string; rating?: number } | null>(null)
  /** Button tapped once and waiting for a second tap to confirm (an action code or 'timeout-us' / 'timeout-them'). */
  const [armed, setArmed] = useState<string | null>(null)
  /** Events taken back with Undo, newest last, for Redo. Cleared by any new entry or a new set. */
  const [redo, setRedo] = useState<{ setIndex: number; events: StatEvent[] }>({ setIndex: -1, events: [] })
  /** When the current timeout's 60-second countdown ends. */
  const [timeoutEnds, setTimeoutEnds] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  /** Scoreboard edit mode, for sets that start at a set score or to fix the score. */
  const [editScore, setEditScore] = useState(false)
  const [editDetails, setEditDetails] = useState(false)
  /** Lineup change in progress: {} = choosing who comes in, { in } = choosing who they replace. */
  const [change, setChange] = useState<{ in?: string } | null>(null)
  useEffect(() => {
    if (!timeoutEnds) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [timeoutEnds])

  const setIndex = match.sets.length - 1
  const set = match.sets[setIndex]
  const { state, events } = replay(set)
  const summary = matchSummary(match)
  const setOver = summary.sets[setIndex].winner
  const weServe = state.serving === 'us'
  // Starting lineup for this set with every lineup change so far applied; it rotates like the original.
  const setup = currentSetup(set.setup ?? match.setup, set)
  const court = onCourt(setup, state.rotation, weServe)
  // Before the serve players stand in their serve / receive formation; once the rally is on they move to base.
  const inRally = rallyInProgress(set.events)
  const phase = inRally ? 'base' : weServe ? 'serve' : 'receive'
  // A match started from a saved rotation uses that rotation's formations; otherwise the team's current ones.
  const spots = (match.formations ?? data.formations)[formationKey(setup.system, state.rotation, phase)]
    ?? defaultFormation(setup.system, state.rotation, phase)
  const byId = (id: string | null) => data.players.find((p) => p.id === id)

  const updateMatch = (f: (m: Match) => Match) =>
    setData((d) => ({ ...d, matches: d.matches.map((m) => (m.id === match.id ? f(m) : m)) }))
  const updateSet = (events: StatEvent[]) =>
    updateMatch((m) => ({ ...m, sets: m.sets.map((s, i) => (i === setIndex ? { ...s, events } : s)) }))

  const side: Team = selected === 'them' ? 'them' : 'us'
  const isServer = selected !== null && selected === court[0].playerId

  const add = (e: StatEvent) => {
    updateSet([...set.events, e])
    setRedo({ setIndex, events: [] })
  }
  const record = (code: string, rating?: number, detail?: string) => {
    const e: StatEvent = { id: newId(), time: Date.now(), code, team: side, playerId: side === 'us' ? selected : null }
    if (rating !== undefined) e.rating = rating
    if (detail !== undefined) e.detail = detail
    add(e)
    setPending(null)
    if (ACTION_BY_CODE[code].family !== 'rally') setSelected(null)
  }
  /** First tap arms a button, second tap confirms. Returns true on the confirming tap. */
  const confirmTap = (key: string) => {
    if (armed !== key) {
      setArmed(key)
      return false
    }
    setArmed(null)
    return true
  }
  /** Confirmed actions ask for a rating and/or "what kind?" first when they need one. */
  const tap = (code: string) => {
    if (!confirmTap(code)) return
    if (RATINGS[code] || DETAILS[code]) setPending({ code })
    else record(code)
  }
  const select = (id: string) => {
    setSelected(id === selected ? null : id)
    setPending(null)
    setArmed(null)
    setChange(null)
  }

  const onCourtIds = court.map((c) => c.playerId)
  const bench = data.players.filter((p) => !onCourtIds.includes(p.id))
  /** Players holding a spot in the lineup right now (the six slots plus the libero). */
  const lineupIds = [...setup.slots, ...(setup.libero ? [setup.libero] : [])]
  const plannedFor = (inId: string) => setup.subs?.find((s) => s.mode === 'ready' && s.in === inId)?.out
  const startChange = (inId?: string) => {
    setSelected(null)
    setPending(null)
    setArmed(null)
    setChange(inId ? { in: inId } : {})
  }
  const makeChange = (inId: string, outId: string) => {
    add({ id: newId(), time: Date.now(), code: 'sub', team: 'us', playerId: inId, out: outId })
    setChange(null)
  }
  const roleOf = (id: string) => {
    if (id === setup.libero) return 'L'
    const slot = setup.slots.indexOf(id)
    return slot >= 0 ? SYSTEMS[setup.system].roles[slot] : byId(id)?.role ?? ''
  }

  const redoable = redo.setIndex === setIndex ? redo.events : []
  const undo = () => {
    const last = set.events[set.events.length - 1]
    updateSet(set.events.slice(0, -1))
    setRedo({ setIndex, events: [...redoable, last] })
    setArmed(null)
  }
  const redoLast = () => {
    const e = redoable[redoable.length - 1]
    updateSet([...set.events, e])
    setRedo({ setIndex, events: redoable.slice(0, -1) })
  }

  /** Manual scoreboard change: logged as its own event so Reports can show it apart from real points. */
  const adjust = (team: Team, delta: number) =>
    add({ id: newId(), time: Date.now(), code: 'adjust', team, playerId: null, delta })

  const timeouts = { us: timeoutsUsed(set, 'us'), them: timeoutsUsed(set, 'them') }
  const callTimeout = (team: Team) => {
    if (!confirmTap(`timeout-${team}`)) return
    add({ id: newId(), time: Date.now(), code: 'timeout', team, playerId: null })
    setTimeoutEnds(Date.now() + 60_000)
    setNow(Date.now())
  }
  const timeLeft = timeoutEnds ? Math.max(0, Math.ceil((timeoutEnds - now) / 1000)) : 0
  // The next set starts from the lineup as it stands now, so an injured player stays out.
  const nextSet = (firstServe: Team) =>
    updateMatch((m) => ({ ...m, sets: [...m.sets, { lineup: setup.slots, setup, firstServe, events: [] }] }))

  const locked = !!setOver

  return (
    <section>
      <div className="topbar">
        <button className="link back" onClick={close}>‹ Matches</button>
        <button className="link small" onClick={() => setEditDetails(!editDetails)}>{editDetails ? 'Done' : 'Match details'}</button>
      </div>
      <div className="match-meta">
        <span className="strong">vs {match.opponent}</span>
        <MatchMeta match={match} />
        <span>· Best of {match.bestOf}</span>
      </div>
      {editDetails && (
        <div className="card">
          <label className="field">
            <span>Opponent</span>
            <input value={match.opponent} onChange={(e) => updateMatch((m) => ({ ...m, opponent: e.target.value }))} />
          </label>
          <MatchDetailsForm
            value={match}
            onChange={(d) => updateMatch((m) => ({ ...m, ...d }))}
            seasons={data.seasons}
            onAddSeason={(season) => setData((d) => ({ ...d, seasons: [...d.seasons, season] }))}
          />
        </div>
      )}

      <div className="card scoreboard">
        <div className="score">
          {(['us', 'them'] as Team[]).map((t) => (
            <div key={t} className={`side ${state.serving === t ? 'serving' : ''}`} style={{ order: t === 'us' ? 0 : 2 }}>
              <span className="side-name">{t === 'us' ? 'Us' : match.opponent}</span>
              <b className="points">{state[t]}</b>
              <span className="serve-tag">{state.serving === t ? 'Serving' : '\u00a0'}</span>
              {editScore && (
                <span className="adjust">
                  <button aria-label={`${t} minus one`} disabled={state[t] === 0} onClick={() => adjust(t, -1)}>−</button>
                  <button aria-label={`${t} plus one`} onClick={() => adjust(t, 1)}>+</button>
                </span>
              )}
            </div>
          ))}
          <div className="score-mid" style={{ order: 1 }}>
            <span className="eyebrow">Set {setIndex + 1}</span>
            <span className="muted small">to {setTarget(setIndex, match.bestOf)} · Rot {state.rotation}</span>
            <button className="link small" onClick={() => setEditScore(!editScore)}>{editScore ? 'Done' : 'Edit score'}</button>
          </div>
        </div>
        <div className="sets">
          {summary.sets.map((s, i) => (
            <span key={i} className={i === setIndex ? 'current' : s.winner ?? ''}>
              S{i + 1} <span className="tabular">{s.us}–{s.them}</span>
            </span>
          ))}
          <span className="sets-total">Sets {summary.won}–{summary.lost}</span>
        </div>
        {editScore && (
          <p className="muted small center">
            Use − / + to set the score (for example a set that starts at 10–10). Changes don't count as points
            in stats and show as manual changes in Reports.
          </p>
        )}
      </div>

      {summary.winner ? (
        <div className="banner">{summary.winner === 'us' ? 'We won' : 'They won'} the match {summary.won}–{summary.lost}.</div>
      ) : setOver && (
        <div className="banner">
          <b>{setOver === 'us' ? 'We' : 'They'} won set {setIndex + 1}.</b> Start set {setIndex + 2}
          {setIndex + 1 === match.bestOf - 1 ? ' (deciding set to 15)' : ''}:
          <div className="row center">
            <button className="primary" onClick={() => nextSet('us')}>We serve</button>
            <button className="primary" onClick={() => nextSet('them')}>They serve</button>
          </div>
        </div>
      )}

      <div className="card entry-card">
        <p className="hint">
          {selected === 'them' ? 'Opponent selected' : selected ? `#${byId(selected)?.number} ${byId(selected)?.name} selected` : 'Pick a player or Opponent, then tap an action twice'}
        </p>
      <div className="entry">
        <div className="left">
        <div className="players">
          {court.map((c, i) => {
            const p = byId(c.playerId)
            return (
              <button
                key={i}
                className={c.playerId === selected ? 'on' : ''}
                onClick={() => select(c.playerId)}
              >
                <span className="pnum">{p ? p.number : '?'}</span>
                <span className="pname">{p?.name ?? '—'}</span>
                <span className="ppos">
                  {i === 0 && weServe ? '🏐 ' : ''}{c.libero ? 'L' : c.sub ? p?.role : c.role} · P{i + 1}
                </span>
              </button>
            )
          })}
          {bench.map((p) => {
            const planned = plannedFor(p.id)
            return (
              <button key={p.id} className={`bench ${change?.in === p.id ? 'on' : ''}`} onClick={() => startChange(p.id)}>
                <span className="pnum">{p.number}</span>
                <span className="pname">{p.name}</span>
                <span className="ppos">{planned ? `Ready · ${byId(planned)?.name ?? ''}` : `Bench · ${p.role}`}</span>
              </button>
            )
          })}
        </div>
        <div className="side-buttons">
          <button className={`them ${selected === 'them' ? 'on' : ''}`} onClick={() => select('them')}>
            Opponent{!weServe ? ' 🏐' : ''}
          </button>
          <button className={`swap ${change ? 'on' : ''}`} onClick={() => (change ? setChange(null) : startChange())}>
            ⇄ Lineup change
          </button>
        </div>
      </div>

        <div className="actions">
          {change && !change.in ? (
            <>
              <b className="full">Who is coming in?</b>
              {data.players.map((p) => (
                <button key={p.id} className="full" onClick={() => setChange({ in: p.id })}>
                  #{p.number} {p.name} <span className="muted small">{onCourtIds.includes(p.id) ? `on court · ${roleOf(p.id)}` : 'bench'}</span>
                </button>
              ))}
              <button className="link full" onClick={() => setChange(null)}>Cancel</button>
            </>
          ) : change?.in ? (
            <>
              <b className="full">#{byId(change.in)?.number} {byId(change.in)?.name} {lineupIds.includes(change.in) ? 'swaps spots with' : 'comes in for'}…</b>
              {lineupIds.filter((id) => id !== change.in).map((id) => (
                <button key={id} className={`full ${plannedFor(change.in!) === id ? 'planned' : ''}`} onClick={() => makeChange(change.in!, id)}>
                  #{byId(id)?.number} {byId(id)?.name} <span className="muted small">{roleOf(id)}{plannedFor(change.in!) === id ? ' · planned' : ''}</span>
                </button>
              ))}
              <p className="full muted small">They take over that spot and rotate with it for the rest of the set.</p>
              <button className="link full" onClick={() => setChange(null)}>Cancel</button>
            </>
          ) : pending && RATINGS[pending.code] && pending.rating === undefined ? (
            <>
              <b className="full">{ACTION_BY_CODE[pending.code].label}: how good was it?</b>
              {RATINGS[pending.code].map((r) => (
                <button
                  key={r.value}
                  className="full rating"
                  onClick={() => (DETAILS[pending.code] ? setPending({ ...pending, rating: r.value }) : record(pending.code, r.value))}
                >
                  <span className="rnum">{r.value}</span>
                  <span className="rlabel">{r.label}</span>
                  <span className="rhelp">{r.help}</span>
                </button>
              ))}
              <button className="link full" onClick={() => setPending(null)}>Cancel</button>
            </>
          ) : pending ? (
            <>
              <b className="full">{DETAILS[pending.code].prompt}</b>
              {DETAILS[pending.code].options.map(([value, label]) => (
                <button key={value} className="full" onClick={() => record(pending.code, pending.rating, value)}>{label}</button>
              ))}
              <button className="link full" onClick={() => setPending(null)}>Cancel</button>
            </>
          ) : (
            ACTIONS.map((a) => (
              <button
                key={a.code}
                className={`${a.family} ${armed === a.code ? 'armed' : ''}`}
                disabled={!selected || locked || !actionAllowed(a, side, state.serving, isServer)}
                onClick={() => tap(a.code)}
              >
                {armed === a.code ? `Confirm ${a.label.replace('…', '')}?` : a.label}
              </button>
            ))
          )}
        </div>
      </div>
      </div>

      {timeLeft > 0 && (
        <div className="banner">
          Timeout · <b>{timeLeft}s</b>{' '}
          <button className="link" onClick={() => setTimeoutEnds(null)}>Resume play</button>
        </div>
      )}

      <div className="toolbar">
        <button disabled={set.events.length === 0} onClick={undo}>↶ Undo</button>
        <button disabled={redoable.length === 0} onClick={redoLast}>Redo ↷</button>
        <span className="toolbar-gap" />
        {(['us', 'them'] as Team[]).map((t) => (
          <button
            key={t}
            className={armed === `timeout-${t}` ? 'armed' : ''}
            disabled={locked || timeouts[t] >= TIMEOUTS_PER_SET}
            onClick={() => callTimeout(t)}
          >
            {armed === `timeout-${t}` ? 'Confirm?' : `${t === 'us' ? 'Our' : 'Their'} T/O ${timeouts[t]}/${TIMEOUTS_PER_SET}`}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Rotation {state.rotation}</span>
          <span className="pill">{inRally ? 'Rally · base' : weServe ? 'Serving' : 'Receiving'}</span>
        </div>
        <div className="muted small">
          {match.planName ? `Rotation: ${match.planName}` : 'Team formations'} · Lineup changes this set: {subsUsed(set)}
        </div>
      <Court
        court={court}
        players={data.players}
        spots={spots}
        server={weServe && !inRally}
        selected={selected}
        onTap={select}
      />
      </div>

      <details className="card">
        <summary><span className="card-title">Rally log</span></summary>
        <ol className="log" reversed>
          {events.slice(-15).reverse().map((e) => {
            const p = byId(e.playerId)
            return (
              <li key={e.id}>
                {e.code === 'sub' ? `Lineup change: #${p?.number} ${p?.name} in for #${byId(e.out ?? null)?.number} ${byId(e.out ?? null)?.name}` :
                e.code === 'adjust' ? `Manual change: ${teamOf(e) === 'us' ? 'Us' : 'Them'} ${(e.delta ?? 0) > 0 ? '+' : ''}${e.delta}` : <>
                {e.code === 'timeout' ? (teamOf(e) === 'us' ? 'Our ' : 'Their ') : teamOf(e) === 'them' ? 'Opponent ' : p ? `#${p.number} ` : ''}
                {ACTION_BY_CODE[e.code]?.label.replace('…', '')}</>}
                {detailLabel(e.code, e.detail) ? `: ${detailLabel(e.code, e.detail)}` : ''}
                {e.rating !== undefined ? ` (${e.rating})` : ''}
                {e.winner && <span className={e.winner === 'us' ? 'ok' : 'bad'}> · point {e.winner}</span>}
              </li>
            )
          })}
        </ol>
      </details>
    </section>
  )
}

/** Type badge, date and time, and place for a match. */
export function MatchMeta({ match: m }: { match: Match }) {
  const when = new Date(m.date)
  return (
    <span className="match-meta">
      <span className={`type-badge ${m.type ?? 'other'}`}>{typeLabel(m.type)}{m.event ? ` · ${m.event}` : ''}</span>
      <span>{when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
      {(m.location || m.venue) && <span>· {[m.venue && m.venue[0].toUpperCase() + m.venue.slice(1), m.location].filter(Boolean).join(' · ')}</span>}
      {m.countsInSeason === false && <span>· not in season</span>}
    </span>
  )
}
