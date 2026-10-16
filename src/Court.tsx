import { useEffect, useRef, useState } from 'react'
import type { CourtSpot } from './engine/systems'
import type { Player, Point } from './engine/types'

interface Props {
  /** Who is in each position 1–6 (index 0 = position 1). */
  court: CourtSpot[]
  players: Player[]
  spots: Point[]
  server?: boolean // highlight position 1 as the server
  selected?: string | null
  /** Makes players movable. Called once when a move ends (drag released, or tap-to-place), with the final spot. */
  onDrop?: (index: number, p: Point) => void
  onTap?: (playerId: string) => void
}

const W = 300
const H = 300
/** A finger has to travel this far (screen px) before a press becomes a drag, so taps stay taps. */
const DRAG_SLOP = 6

interface Drag {
  index: number
  pointerId: number
  startX: number
  startY: number
  /** Where on the chip it was grabbed, so the chip stays under the finger instead of jumping to it. */
  offset: Point
  moved: boolean
  last: Point | null
}

/**
 * Our half of the court, net at the top. Players slide between spots. When onDrop is given they can be moved
 * two ways: drag them, or tap a player and then tap the spot where they should go (easier with a finger).
 */
export function Court({ court, players, spots, server, selected, onDrop, onTap }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  // The ref drives the handlers (pointer events can arrive before a re-render); state only styles the chips.
  const drag = useRef<Drag | null>(null)
  /** Player elements, moved directly while dragging so the screen doesn't redraw on every finger movement. */
  const chipEls = useRef<(SVGGElement | null)[]>([])
  /** Player picked by a tap, waiting for a tap on the court to move there. */
  const [picked, setPicked] = useState<number | null>(null)
  const editable = !!onDrop

  // iPhones don't reliably honor touch-action on SVG, so stop the page scrolling or zooming while a player is held.
  useEffect(() => {
    const el = svg.current
    if (!el || !editable) return
    const block = (e: TouchEvent) => {
      if (drag.current) e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [editable])

  const toPoint = (clientX: number, clientY: number): Point => {
    const r = svg.current!.getBoundingClientRect()
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height }
  }
  const clamp = (p: Point): Point => ({ x: Math.min(0.96, Math.max(0.04, p.x)), y: Math.min(0.97, Math.max(0.04, p.y)) })

  const start = (e: React.PointerEvent, i: number) => {
    if (!editable) return
    e.stopPropagation()
    const at = toPoint(e.clientX, e.clientY)
    drag.current = {
      index: i, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
      offset: { x: spots[i].x - at.x, y: spots[i].y - at.y }, moved: false, last: null,
    }
    svg.current?.setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    const el = chipEls.current[d.index]
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_SLOP) return
      d.moved = true
      el?.classList.add('dragging')
      setPicked(null)
    }
    const at = toPoint(e.clientX, e.clientY)
    d.last = clamp({ x: at.x + d.offset.x, y: at.y + d.offset.y })
    if (el) el.style.transform = `translate(${d.last.x * W}px, ${d.last.y * H}px)`
  }
  const end = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    drag.current = null
    chipEls.current[d.index]?.classList.remove('dragging')
    if (d.moved) {
      if (d.last) onDrop?.(d.index, d.last)
    } else if (!cancelled) {
      // A tap on a player picks them (tap again to put them back down).
      setPicked((p) => (p === d.index ? null : d.index))
    }
  }
  /** Tap on open court while a player is picked: move them there. */
  const place = (e: React.PointerEvent) => {
    if (picked === null || drag.current) return
    const p = clamp(toPoint(e.clientX, e.clientY))
    onDrop?.(picked, p)
    setPicked(null)
  }

  return (
    <svg
      ref={svg}
      className={`court ${picked !== null ? 'placing' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      onPointerDown={place}
      onPointerMove={move}
      onPointerUp={(e) => end(e)}
      onPointerCancel={(e) => end(e, true)}
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
        const cls = [
          'chip', i === 0 && server && 'server', c && c.playerId === selected && 'selected', c?.libero && 'libero',
          picked === i && 'picked',
        ].filter(Boolean).join(' ')
        return (
          <g
            key={i}
            ref={(el) => { chipEls.current[i] = el }}
            className={cls}
            style={{ transform: `translate(${s.x * W}px, ${s.y * H}px)` }}
            onPointerDown={(e) => start(e, i)}
            onClick={() => !editable && c && onTap?.(c.playerId)}
          >
            {/* Bigger invisible touch target than the visible chip. */}
            <circle r="34" className="hit" />
            <circle r="24" cy="2" className="shadow" />
            <circle r="24" className="disc" />
            <text y="-2">{p ? `#${p.number}` : '?'}</text>
            <text y="12" className="chip-sub">{c?.libero ? 'L' : c?.sub ? p?.role : c?.role ?? ''} · {i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}
