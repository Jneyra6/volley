import { useRef, useState } from 'react'
import type { CourtSpot } from './engine/systems'
import type { Player, Point } from './engine/types'

interface Props {
  /** Who is in each position 1–6 (index 0 = position 1). */
  court: CourtSpot[]
  players: Player[]
  spots: Point[]
  server?: boolean // highlight position 1 as the server
  selected?: string | null
  onMove?: (index: number, p: Point) => void
  /** Called once when a drag ends, with the final spot. */
  onDrop?: (index: number, p: Point) => void
  onTap?: (playerId: string) => void
}

const W = 300
const H = 300

/** Our half of the court, net at the top. Players slide between spots and can be dragged when onMove is given. */
export function Court({ court, players, spots, server, selected, onMove, onDrop, onTap }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  // The ref drives the handlers (pointer events can arrive before a re-render); the state only styles the chip.
  const drag = useRef<{ index: number; last: Point | null } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const toPoint = (e: React.PointerEvent): Point => {
    const r = svg.current!.getBoundingClientRect()
    const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v))
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current.last = toPoint(e)
    onMove?.(drag.current.index, drag.current.last)
  }
  const stop = () => {
    const d = drag.current
    drag.current = null
    setDragging(null)
    if (d?.last) onDrop?.(d.index, d.last)
  }

  return (
    <svg
      ref={svg}
      className="court"
      viewBox={`0 0 ${W} ${H}`}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      <rect x="0" y="0" width={W} height={H} rx="6" className="court-floor" />
      <rect x="0" y="0" width={W} height={H / 3} className="court-front" />
      <line x1="0" y1={H / 3} x2={W} y2={H / 3} className="court-line" />
      <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="5" className="court-bounds" />
      <line x1="0" y1="2" x2={W} y2="2" className="court-net" />
      <text x={W / 2} y="18" className="court-label">NET</text>
      {spots.map((s, i) => {
        const c = court[i]
        const p = players.find((x) => x.id === c?.playerId)
        const cls = ['chip', i === 0 && server && 'server', c && c.playerId === selected && 'selected', c?.libero && 'libero']
          .filter(Boolean)
          .join(' ')
        return (
          <g
            key={i}
            className={cls}
            style={{
              transform: `translate(${s.x * W}px, ${s.y * H}px)`,
              transition: dragging === i ? 'none' : undefined,
            }}
            onPointerDown={(e) => {
              if (!onMove) return
              drag.current = { index: i, last: null }
              setDragging(i)
              svg.current?.setPointerCapture?.(e.pointerId)
            }}
            onClick={() => c && onTap?.(c.playerId)}
          >
            <circle r="24" />
            <text y="-2">{p ? `#${p.number}` : '?'}</text>
            <text y="12" className="chip-sub">{c?.libero ? 'L' : c?.sub ? p?.role : c?.role ?? ''} · {i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}
