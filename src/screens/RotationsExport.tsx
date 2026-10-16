import { useEffect, useState } from 'react'
import type { jsPDF as JsPDFType } from 'jspdf'
import { PHASES, type Phase } from '../engine/systems'
import { fileSlug } from '../engine/export'
import { buildRotationsPdf } from '../rotationsPdf'
import type { Data } from '../store'
import { setupComplete } from './SetupEditor'

/** Make a PDF of the rotations (lineup page + one page per chosen formation) to send to players. */
export function RotationsExport({ data, teamName }: { data: Data; teamName: string }) {
  // Load the PDF library when this card first shows, so tapping Share can open the share sheet right away.
  const [JsPDF, setJsPDF] = useState<typeof JsPDFType | null>(null)
  useEffect(() => {
    import('jspdf').then((m) => setJsPDF(() => m.jsPDF)).catch(() => {})
  }, [])

  const [source, setSource] = useState('') // '' = current lineup, otherwise a saved rotation id
  const [phases, setPhases] = useState<Phase[]>(['receive', 'serve', 'base'])
  const [message, setMessage] = useState('')

  const plan = data.plans.find((p) => p.id === source)
  const setup = plan?.setup ?? data.setup
  const ready = !!JsPDF && setupComplete(setup) && phases.length > 0
  const title = plan?.name ?? 'Current lineup'
  const filename = `rotations-${fileSlug(teamName)}-${fileSlug(title)}.pdf`

  const make = () =>
    buildRotationsPdf(JsPDF!, {
      teamName, title, setup, formations: plan?.formations ?? data.formations, players: data.players,
      phases: PHASES.map((p) => p.id).filter((id) => phases.includes(id)),
    })

  const canShareFiles = typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] })

  const share = async () => {
    const file = new File([make().output('blob')], filename, { type: 'application/pdf' })
    try {
      await navigator.share({ files: [file], title: `${teamName} rotations` })
      setMessage('')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage('Sharing did not work here. Use Download PDF instead.')
    }
  }
  const download = () => {
    make().save(filename)
    setMessage('PDF saved.')
  }
  const toggle = (p: Phase) => setPhases((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]))

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Rotations PDF</span>
      </div>
      <p className="muted small">A lineup page, then one page per formation with all six rotations, to send to players.</p>
      {data.plans.length > 0 && (
        <label className="field">
          <span>Rotation</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Current lineup</option>
            {data.plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.setup.system})</option>)}
          </select>
        </label>
      )}
      <div className="filter-chips" role="group" aria-label="Formations to include">
        {PHASES.map((p) => (
          <button key={p.id} className={phases.includes(p.id) ? 'on' : ''} aria-pressed={phases.includes(p.id)} onClick={() => toggle(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {!setupComplete(setup) && <p className="empty">Fill in all six lineup spots first.</p>}
      <div className="export-buttons">
        {canShareFiles ? (
          <>
            <button className="primary" disabled={!ready} onClick={share}>Share PDF</button>
            <button disabled={!ready} onClick={download}>Download PDF</button>
          </>
        ) : (
          <button className="primary" style={{ gridColumn: '1 / -1' }} disabled={!ready} onClick={download}>Download PDF</button>
        )}
      </div>
      {message && <p className="small" role="status">{message}</p>}
    </div>
  )
}
