import type { jsPDF as JsPDFType } from 'jspdf'
import {
  PHASES, SYSTEMS, defaultFormation, formationKey, onCourt, rotationNotes, type CourtSpot, type Phase, type TeamSetup,
} from './engine/systems'
import { HOME } from './engine/rotation'
import type { Player, Point } from './engine/types'

export interface RotationsPdfInput {
  teamName: string
  /** Saved rotation name, or a label like "Current lineup". */
  title: string
  setup: TeamSetup
  formations: Record<string, Point[]>
  players: Player[]
  pages: PdfPage[]
}

/** A PDF page: the basic rotation order, or one of the formations from the Rotations tab. */
export type PdfPage = 'rotation' | Phase

/** Pages offered for the PDF, in the order they print. Labels follow coaches' wording. */
export const PDF_PAGES: { id: PdfPage; label: string; help: string }[] = [
  {
    id: 'rotation', label: 'Rotation',
    help: 'Rotation order: where each player lines up in their spot, before anyone switches. Position 1 serves.',
  },
  { id: 'serve', label: 'Serve', help: PHASES.find((p) => p.id === 'serve')!.help },
  { id: 'receive', label: 'Serve receive', help: PHASES.find((p) => p.id === 'receive')!.help },
  { id: 'base', label: 'Base', help: PHASES.find((p) => p.id === 'base')!.help },
  { id: 'defL', label: 'Defense left', help: PHASES.find((p) => p.id === 'defL')!.help },
  { id: 'defM', label: 'Defense middle', help: PHASES.find((p) => p.id === 'defM')!.help },
  { id: 'defR', label: 'Defense right', help: PHASES.find((p) => p.id === 'defR')!.help },
]

// Letter page, in points.
const PAGE_W = 612
const PAGE_H = 792
const M = 36

const C = {
  text: '#0f172a',
  muted: '#64748b',
  line: '#e3e8ef',
  accent: '#1d4ed8',
  floor: '#e8a868',
  floorFront: '#dc9a5a',
  chip: '#1e3a8a',
  libero: '#9d174d',
  gold: '#f5b70a',
}

const POSITION_NAMES = ['Right back', 'Right front', 'Middle front', 'Left front', 'Left back', 'Middle back']

const playerLabel = (players: Player[], id: string | null | undefined) => {
  const p = players.find((x) => x.id === id)
  return p ? `#${p.number} ${p.name}` : '-'
}

/** One court diagram: net on top, attack line, and the six players at their spots. */
function drawCourt(doc: JsPDFType, x: number, y: number, size: number, court: CourtSpot[], spots: Point[], players: Player[], server: boolean) {
  doc.setFillColor(C.floor)
  doc.roundedRect(x, y, size, size, 4, 4, 'F')
  doc.setFillColor(C.floorFront)
  doc.rect(x, y, size, size / 3, 'F')
  doc.setDrawColor('#ffffff')
  doc.setLineWidth(1.5)
  doc.roundedRect(x + 1, y + 1, size - 2, size - 2, 3, 3, 'S')
  doc.setLineWidth(1)
  doc.setLineDashPattern([4, 3], 0)
  doc.line(x, y + size / 3, x + size, y + size / 3)
  doc.setLineDashPattern([], 0)
  doc.setDrawColor(C.text)
  doc.setLineWidth(4)
  doc.line(x, y + 1, x + size, y + 1)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor('#ffffff')
  doc.text('NET', x + size / 2, y + 9, { align: 'center' })

  const r = size * 0.075
  spots.forEach((s, i) => {
    const c = court[i]
    const p = players.find((pl) => pl.id === c?.playerId)
    const cx = x + s.x * size
    const cy = y + s.y * size
    doc.setFillColor(c?.libero ? C.libero : C.chip)
    if (i === 0 && server) {
      doc.setDrawColor(C.gold)
      doc.setLineWidth(2.5)
    } else {
      doc.setDrawColor('#ffffff')
      doc.setLineWidth(1.2)
    }
    doc.circle(cx, cy, r, 'FD')
    doc.setTextColor('#ffffff')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(r * 0.85)
    doc.text(p ? String(p.number) : '?', cx, cy + r * 0.3, { align: 'center' })
    // Name and role under the player, dark text on a light tag so it reads on the floor color.
    const role = c?.libero ? 'L' : c?.sub ? p?.role : c?.role
    const label = `${p?.name ?? '?'} · ${role ?? ''}`
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    const w = doc.getTextWidth(label) + 4
    doc.setFillColor('#ffffff')
    doc.roundedRect(cx - w / 2, cy + r + 1.5, w, 8, 2, 2, 'F')
    doc.setTextColor(C.text)
    doc.text(label, cx, cy + r + 7.3, { align: 'center' })
  })
}

function header(doc: JsPDFType, input: RotationsPdfInput, subtitle: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(C.text)
  doc.text(`${input.teamName} · ${input.title}`, M, M + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(C.muted)
  doc.text(`${input.setup.system} system · ${subtitle}`, M, M + 24)
  doc.setDrawColor(C.line)
  doc.setLineWidth(1)
  doc.line(M, M + 32, PAGE_W - M, M + 32)
}

function footer(doc: JsPDFType, page: number, total: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(C.muted)
  doc.text(`Made with Volley · ${new Date().toLocaleDateString()}`, M, PAGE_H - 20)
  doc.text(`Page ${page} of ${total}`, PAGE_W - M, PAGE_H - 20, { align: 'right' })
}

/** Page 1: who starts where, libero, subs, and how to read the diagrams. */
function lineupPage(doc: JsPDFType, input: RotationsPdfInput) {
  const { setup, players } = input
  const sys = SYSTEMS[setup.system]
  header(doc, input, 'Lineup')
  let y = M + 56

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(C.text)
  for (const line of doc.splitTextToSize(sys.about, PAGE_W - 2 * M)) {
    doc.text(line, M, y)
    y += 13
  }
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Starting lineup (rotation 1)', M, y)
  y += 16
  doc.setFontSize(9)
  doc.setTextColor(C.muted)
  doc.text('POSITION', M, y)
  doc.text('ROLE', M + 140, y)
  doc.text('PLAYER', M + 310, y)
  y += 6
  doc.setDrawColor(C.line)
  doc.line(M, y, PAGE_W - M, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(C.text)
  setup.slots.forEach((id, i) => {
    doc.text(`${i + 1} · ${POSITION_NAMES[i]}`, M, y)
    doc.text(sys.labels[i], M + 140, y)
    doc.text(playerLabel(players, id), M + 310, y)
    y += 18
  })
  if (setup.libero) {
    doc.text('Libero', M, y)
    doc.text('Replaces back-row middles', M + 140, y)
    doc.text(playerLabel(players, setup.libero), M + 310, y)
    y += 18
  }

  const subs = setup.subs ?? []
  if (subs.length) {
    y += 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Subs', M, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    for (const s of subs) {
      const when = s.mode === 'backRow' ? 'whenever they are in the back row' : 'ready to go in'
      doc.text(`${playerLabel(players, s.in)} for ${playerLabel(players, s.out)}, ${when}`, M, y)
      y += 18
    }
  }

  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('How to read the diagrams', M, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const legend = [
    'You are looking at our half of the court from behind our end line; the net is at the top.',
    'Each circle is a player with their jersey number; the tag shows their name and role.',
    'A gold ring marks the server. A pink circle is the libero.',
    'We rotate clockwise when we win the serve back: 2 to 1, 1 to 6, 6 to 5, 5 to 4, 4 to 3, 3 to 2.',
  ]
  for (const line of legend) {
    for (const part of doc.splitTextToSize(`•  ${line}`, PAGE_W - 2 * M)) {
      doc.text(part, M, y)
      y += 14
    }
  }
}

/** One page per phase: all six rotations in a 2 x 3 grid, each with its notes. */
function phasePage(doc: JsPDFType, input: RotationsPdfInput, page: PdfPage) {
  const info = PDF_PAGES.find((p) => p.id === page)!
  header(doc, input, info.label)
  doc.setFontSize(9)
  doc.setTextColor(C.muted)
  doc.text(info.help, M, M + 46)

  const colW = (PAGE_W - 2 * M) / 2
  const size = 170
  const rowH = 215
  const top = M + 60
  const weServe = page !== 'receive'
  // The rotation-order page shows the six rotating players in their spots, without libero or sub swaps.
  const setup = page === 'rotation' ? { ...input.setup, libero: null, subs: [] } : input.setup

  for (let rotation = 1; rotation <= 6; rotation++) {
    const col = (rotation - 1) % 2
    const row = Math.floor((rotation - 1) / 2)
    const x = M + col * colW
    const y = top + row * rowH
    const spots = page === 'rotation'
      ? HOME
      : input.formations[formationKey(input.setup.system, rotation, page)] ?? defaultFormation(input.setup.system, rotation, page)
    const court = onCourt(setup, rotation, weServe)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(C.text)
    doc.text(`Rotation ${rotation}`, x, y + 8)
    drawCourt(doc, x, y + 14, size, court, spots, input.players, page === 'serve' || page === 'rotation')

    // Notes to the right of the court.
    const notesX = x + size + 8
    const notesW = colW - size - 14
    let ny = y + 24
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(C.muted)
    for (const note of rotationNotes(input.setup, rotation, weServe, input.players)) {
      for (const part of doc.splitTextToSize(note, notesW)) {
        if (ny > y + 14 + size) break
        doc.text(part, notesX, ny)
        ny += 9
      }
      ny += 4
    }
  }
}

/** Build the rotation sheet PDF. jsPDF is passed in so it can be loaded only when needed. */
export function buildRotationsPdf(JsPDF: typeof JsPDFType, input: RotationsPdfInput): JsPDFType {
  const doc = new JsPDF({ unit: 'pt', format: 'letter' })
  doc.setProperties({ title: `${input.teamName} rotations - ${input.title}`, creator: 'Volley' })
  lineupPage(doc, input)
  for (const { id } of PDF_PAGES.filter((p) => input.pages.includes(p.id))) {
    doc.addPage()
    phasePage(doc, input, id)
  }
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    footer(doc, i, total)
  }
  return doc
}
