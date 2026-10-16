import { useState } from 'react'
import { MatchScreen } from './screens/MatchScreen'
import { Reports } from './screens/Reports'
import { Roster } from './screens/Roster'
import { Rotations } from './screens/Rotations'
import { Season } from './screens/Season'
import { useRoot } from './store'
import { activeTeam, applyView, teamView, type Data, type Root } from './teams'

const TABS = ['Roster', 'Rotations', 'Match', 'Game', 'Season'] as const
type Tab = (typeof TABS)[number]

/** Simple line icons for the tab bar (24px grid, drawn with currentColor). */
const ICONS: Record<Tab, React.ReactNode> = {
  Roster: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.8-3.3 3.2-5 6-5s5.2 1.7 6 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.4.2 4.2 1.7 5 4.3" /></>,
  Rotations: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v4.5h-4.5" /></>,
  // Volleyball: the same mark as the app icon, scaled from its 300px drawing into the 24px grid.
  Match: (
    <g transform="translate(12 12) scale(0.0567)">
      <circle r="150" vectorEffect="non-scaling-stroke" />
      {[0, 120, 240].map((r) => (
        <g key={r} transform={`rotate(${r})`}>
          <path d="M0 0 A150 150 0 0 1 130 -75" vectorEffect="non-scaling-stroke" />
          <path d="M-62 -36 A210 210 0 0 1 75 -130" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </g>
  ),
  Game: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4" /></>,
  Season: <><path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="6" rx="1" /><rect x="10.5" y="6" width="3" height="11" rx="1" /><rect x="15.5" y="13" width="3" height="4" rx="1" /></>,
}

const TITLES: Record<Tab, string> = { Roster: 'Roster', Rotations: 'Rotations', Match: 'Match', Game: 'Game report', Season: 'Season' }

export default function App() {
  const [root, setRoot] = useRoot()
  const data = teamView(root)
  // Screens edit the active team's view; changes are written back into that team.
  const setData = (f: (d: Data) => Data) => setRoot((r) => applyView(r, f(teamView(r))))
  const [tab, setTab] = useState<Tab>(() => (data.players.length >= 6 ? 'Match' : 'Roster'))
  const [openMatch, setOpenMatch] = useState<string | null>(null)

  const switchTeam = (id: string) => {
    setRoot((r: Root) => ({ ...r, activeTeamId: id }))
    setOpenMatch(null)
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <svg viewBox="0 0 24 24" className="brand-mark" aria-hidden="true">{ICONS.Match}</svg>
          <div>
            <div className="brand-name">Volley</div>
            <div className="brand-sub">{TITLES[tab]}</div>
          </div>
        </div>
        <label className="team-switch">
          <span className="sr-only">Team</span>
          <select value={activeTeam(root).id} onChange={(e) => switchTeam(e.target.value)}>
            {root.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </header>
      {/* Keyed by team so each tab starts fresh when you switch teams. */}
      <main key={activeTeam(root).id}>
        {tab === 'Roster' && <Roster data={data} setData={setData} root={root} setRoot={setRoot} switchTeam={switchTeam} />}
        {tab === 'Rotations' && <Rotations data={data} setData={setData} />}
        {tab === 'Match' && <MatchScreen data={data} setData={setData} openId={openMatch} setOpenId={setOpenMatch} />}
        {tab === 'Game' && <Reports data={data} teamName={activeTeam(root).name} />}
        {tab === 'Season' && <Season data={data} setData={setData} teamName={activeTeam(root).name} />}
      </main>
      <nav>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)} aria-current={t === tab ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[t]}</svg>
            <span>{t}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
