import type { PlayerLine } from '../engine/report'
import { derive, fmt, type Counts } from '../engine/stats'
import type { Player } from '../engine/types'

/** Player stat table shared by the Game and Season tabs. Per-set numbers use sets played (SP). */
export function StatTable({ lines, players, opponent }: { lines: PlayerLine[]; players: Player[]; opponent?: Counts }) {
  const rows = lines
    .map((l) => ({ l, p: players.find((p) => p.id === l.playerId) }))
    .filter((r) => r.p && r.l.setsPlayed > 0)
    .sort((a, b) => a.p!.number - b.p!.number)
  const per = (n: number, sp: number) => (sp ? (n / sp).toFixed(2) : '-')

  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Player</th><th>SP</th><th>K</th><th>K/S</th><th>E</th><th>TA</th><th>Hit%</th><th>A</th><th>SA</th><th>SE</th>
            <th>Srv pts</th><th>Pass</th><th>D</th><th>D/S</th><th>BS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ l, p }) => {
            const c = l.counts
            const d = derive(c)
            return (
              <tr key={l.playerId}>
                <td>#{p!.number} {p!.name}</td>
                <td>{l.setsPlayed}</td><td>{c.kills}</td><td>{per(c.kills, l.setsPlayed)}</td><td>{c.attackErrs}</td>
                <td>{c.attackAttempts}</td><td>{fmt.hit(d.hittingPct)}</td><td>{c.assists}</td><td>{c.aces}</td><td>{c.serveErrs}</td>
                <td>{l.servingPoints}</td><td>{fmt.rating(d.passRating)}</td><td>{c.digs}</td><td>{per(c.digs, l.setsPlayed)}</td><td>{c.blocks}</td>
              </tr>
            )
          })}
          {opponent && (
            <tr className="opp">
              <td>Opponent</td><td>-</td><td>{opponent.kills}</td><td>-</td><td>{opponent.attackErrs}</td><td>{opponent.attackAttempts}</td>
              <td>{fmt.hit(derive(opponent).hittingPct)}</td><td>{opponent.assists}</td><td>{opponent.aces}</td><td>{opponent.serveErrs}</td>
              <td>-</td><td>{fmt.rating(derive(opponent).passRating)}</td><td>{opponent.digs}</td><td>-</td><td>{opponent.blocks}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted small">
        SP sets played · K kills · E attack errors · TA attempts · A assists · SA aces · SE serve errors · Srv pts points won on
        their serve · Pass 0–3 rating · D digs · BS blocks
      </p>
    </div>
  )
}
