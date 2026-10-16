import { ATTACK_RESULTS, ATTACK_TYPES, FAULT_KINDS, SERVE_ERRORS } from '../engine/actions'
import type { Counts } from '../engine/stats'

/** Kills by type, and errors by what happened, for our team. Shared by the Game and Season tabs. */
export function Breakdowns({ counts: c }: { counts: Counts }) {
  const groups: [string, [string, string][], Record<string, number>][] = [
    ['Kills by type', ATTACK_TYPES, c.killTypes],
    ['Serve errors', SERVE_ERRORS, c.serveErrKinds],
    ['Attack errors', ATTACK_RESULTS, c.attackErrKinds],
    ['Faults', FAULT_KINDS, c.faultKinds],
  ]
  const shown = groups.filter(([, kinds, counts]) => kinds.some(([k]) => counts[k]))
  if (shown.length === 0 && c.whoseBall === 0) return null
  return (
    <div className="card">
      <div className="card-title">Kills and errors</div>
      {shown.map(([title, kinds, counts]) => (
        <div key={title} className="breakdown">
          <div className="subhead">{title}</div>
          <div className="chips">
            {kinds.filter(([k]) => counts[k]).map(([k, label]) => <span key={k}>{label} <b>{counts[k]}</b></span>)}
          </div>
        </div>
      ))}
      {c.whoseBall > 0 && (
        <div className="breakdown">
          <div className="subhead">Other errors</div>
          <div className="chips"><span>Whose ball? <b>{c.whoseBall}</b></span></div>
        </div>
      )}
    </div>
  )
}
