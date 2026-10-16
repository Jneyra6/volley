import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CHANGELOG } from './changelog'
import { FeedbackForm } from './FeedbackForm'
import { shareVolley, siteUrl } from './site'

type Section = { id: string; title: string; points: string[] }

/** Short how-to for each part of the app. Keep it in coach language. */
const GUIDE: Section[] = [
  {
    id: 'start', title: 'Getting started',
    points: [
      'New to Volley? See what it does on the home page: jneyra6.github.io/volley/about.',
      'Roster: add your players (up to 14) with their jersey numbers and positions.',
      'Rotations: pick your system (5-1, 6-2 or 4-2), fill in the starting lineup and libero, then arrange formations.',
      'Match: start a match and tap stats as you play. Game and Season show the reports.',
      'Use the team menu in the top corner to switch between teams.',
      'Volley is in beta: tap Send feedback (or the Feedback tab here) to tell us what works and what to add.',
    ],
  },
  {
    id: 'Roster', title: 'Roster and teams',
    points: [
      'Add a player with their number, name and position, then tap Add. A team can have up to 14 players, each with their own jersey number.',
      'Removing a player who has played in a match moves them to Former players, so their stats stay in reports and exports. Tap Restore to bring them back.',
      'Teams: add a team (for example JV and Varsity), rename it, or delete it. Each team has its own roster, rotations and matches.',
      'Backup: Save backup makes a file with everything; Restore backup brings it back on this or another device.',
      'On iPhone, the Home Screen app and Safari keep separate data, so always open Volley from the Home Screen icon.',
    ],
  },
  {
    id: 'Rotations', title: 'Rotations',
    points: [
      'System and lineup: choose the system, who starts in each spot, the libero, and any subs.',
      'Subs: "Back row only" swaps a sub in whenever that starter is in the back row (like a DS). "Ready" is a sub you plan to use in a match.',
      'Use ‹ › to step through rotations 1 to 6, and the buttons to switch between Receiving, Serving, Base and the defenses.',
      'Move a player by dragging, or tap a player and then tap where they go. It saves when you let go.',
      'Receiving and Serving are checked for overlap; a red box explains what to fix.',
      'Saved rotations: name and save the whole setup to pick it when you start a match.',
      'Rotations PDF: choose the pages and tap Share PDF to send it to players.',
    ],
  },
  {
    id: 'Match', title: 'Match',
    points: [
      'New match: enter the opponent, match type, date and time, location, season, best of 3 or 5, and who serves first.',
      'Tap a player (or Opponent), then tap an action twice: once to pick it and again to confirm.',
      'Serve buttons only work for the server; receive buttons only for the team receiving.',
      'Some actions ask for a rating or what kind (tip, dump, net fault and so on); each choice explains itself.',
      'Serve errors ask whether the serve went into the net, long or wide. Attack errors ask the kind of attack, then whether it was blocked, out or into the net.',
      'Whose ball? is for when two players both go for the ball and then both stop. Pick a player to charge it to them, or tap it with nobody picked for a team error.',
      'Undo and Redo fix mistakes. Timeouts count up to 2 per team per set.',
      'Edit score lets you change the scoreboard (for example a set that starts at 10–10); it shows as a manual change in reports.',
      'Lineup change: tap a bench player, then who they replace. They take that spot for the rest of the set, even if someone gets hurt.',
    ],
  },
  {
    id: 'Game', title: 'Game report',
    points: [
      'Pick a match to see set scores, side-out and point-scoring %, and each player\'s stats.',
      'MaxPreps file: in MaxPreps, open that game, choose to import stats, and pick the .txt file. Jersey numbers must match your MaxPreps roster exactly.',
      'Spreadsheet: opens in Excel, Numbers or Google Sheets.',
    ],
  },
  {
    id: 'Season', title: 'Season',
    points: [
      'Pick a season, which match types to include, and whether to count only season games.',
      'Shows the record overall and by type, sets won and lost, and player totals with per-set numbers.',
      'Season spreadsheet exports the totals for whatever is selected.',
    ],
  },
  {
    id: 'terms', title: 'Stat abbreviations',
    points: [
      'SP sets played · K kills · E attack errors · TA total attacks · Hit% (kills − errors) ÷ attacks',
      'A assists · SA service aces · SE serve errors · Srv pts points won on that player\'s serve',
      'Pass rating 0–3 (3 is perfect) · D digs · BS blocks',
      'Side-out %: points won when the other team served. Point-scoring %: points won on our serve.',
    ],
  },
]

const SEEN_KEY = 'volley-updates-seen'
const latest = CHANGELOG[0].id

/** True when there's an update the user hasn't looked at yet (remembered on this device only). */
function useUnseen() {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY)
    } catch {
      return latest
    }
  })
  const markSeen = () => {
    setSeen(latest)
    try {
      localStorage.setItem(SEEN_KEY, latest)
    } catch {
      // Ignore: the dot just shows again next time.
    }
  }
  return [seen !== latest, markSeen] as const
}

const formatDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

/** "?" button in the header that opens Help and What's new. */
export function HelpButton({ tab }: { tab: string }) {
  const [open, setOpen] = useState<null | 'help' | 'new' | 'feedback'>(null)
  const [unseen, markSeen] = useUnseen()
  const [shareMsg, setShareMsg] = useState('')
  const share = async () => {
    const r = await shareVolley()
    setShareMsg(r === 'copied' ? 'Link copied. Paste it in a text or email.' : r === 'failed' ? `Share this link: ${siteUrl()}` : '')
  }
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    if (open === 'new') markSeen()
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button className="help-button" aria-label={unseen ? 'Help and updates (new update)' : 'Help and updates'} onClick={() => setOpen('help')}>
        ?
        {unseen && <span className="dot" aria-hidden="true" />}
      </button>
      {/* Rendered on <body>: the header's blur would otherwise trap a fixed-position panel inside it. */}
      {open && createPortal(
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Help" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <div className="seg">
                <button className={open === 'help' ? 'on' : ''} onClick={() => setOpen('help')}>Help</button>
                <button className={open === 'new' ? 'on' : ''} onClick={() => setOpen('new')}>
                  What's new{unseen && <span className="dot inline" aria-hidden="true" />}
                </button>
                <button className={open === 'feedback' ? 'on' : ''} onClick={() => setOpen('feedback')}>Feedback</button>
              </div>
              <button className="icon close" aria-label="Close" onClick={() => setOpen(null)}>×</button>
            </div>

            <div className="sheet-body">
              {open !== 'feedback' && (
                <div className="share-card">
                  <div>
                    <b>Volley is in beta</b>
                    <span className="muted small">Tell us what to improve, or send it to another coach.</span>
                  </div>
                  <div className="share-actions">
                    <button className="primary" onClick={() => setOpen('feedback')}>Send feedback</button>
                    <button onClick={share}>Share Volley</button>
                  </div>
                </div>
              )}
              {shareMsg && <p className="small" role="status">{shareMsg}</p>}
              {open === 'feedback' ? (
                <FeedbackForm />
              ) : open === 'help' ? (
                GUIDE.map((s) => (
                  <details key={s.id} className="inset" open={s.id === tab}>
                    <summary><span>{s.title}{s.id === tab ? ' · this tab' : ''}</span></summary>
                    <ul className="notes">{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  </details>
                ))
              ) : (
                <>
                <p className="muted small">You're on version {__APP_VERSION__}. Updates install when you tap Update on the bar that appears.</p>
                <ol className="timeline">
                  {CHANGELOG.map((r) => (
                    <li key={r.id}>
                      <span className="eyebrow">{formatDate(r.date)}</span>
                      <b>{r.title}</b>
                      <ul className="notes">{r.items.map((i) => <li key={i}>{i}</li>)}</ul>
                    </li>
                  ))}
                </ol>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
