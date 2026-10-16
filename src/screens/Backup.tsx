import { useEffect, useRef, useState } from 'react'
import { downloadText } from '../download'
import type { Root } from '../teams'

const isRoot = (x: unknown): x is Root =>
  !!x && typeof x === 'object' && Array.isArray((x as Root).teams) && (x as Root).teams.length > 0 &&
  Array.isArray((x as Root).matches) && typeof (x as Root).activeTeamId === 'string'

/** Save everything (all teams, rotations, matches) to a file, or restore from one. Also how you move data to another device. */
export function Backup({ root, setRoot }: { root: Root; setRoot: (r: Root) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [protectedData, setProtectedData] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone

  useEffect(() => {
    navigator.storage?.persisted?.().then(setProtectedData).catch(() => setProtectedData(null))
  }, [])

  const save = () => {
    const d = new Date()
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    downloadText(`volley-backup-${day}.json`, JSON.stringify({ app: 'volley', version: 3, savedAt: d.toISOString(), data: root }), 'application/json')
    setMessage('Backup file saved. Keep it somewhere safe, like Files, iCloud Drive or email.')
  }

  const restore = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text())
      const data = parsed?.data ?? parsed
      if (!isRoot(data)) throw new Error('not a backup')
      const teams = data.teams.length
      const matches = data.matches.length
      if (!window.confirm(`Replace everything on this device with this backup (${teams} team${teams === 1 ? '' : 's'}, ${matches} match${matches === 1 ? '' : 'es'})?`)) return
      setRoot(data)
      setMessage(`Restored ${teams} team${teams === 1 ? '' : 's'} and ${matches} match${matches === 1 ? '' : 'es'}.`)
    } catch {
      setMessage('That file is not a Volley backup.')
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Backup</span>
        {protectedData && <span className="pill">Saved on this device</span>}
      </div>
      <p className="muted small">
        Your teams and matches are saved on this device automatically. Save a backup file now and then, and use it to
        move everything to another phone or iPad.
      </p>
      {!standalone && (
        <p className="empty">
          On iPhone, the Home Screen app and Safari keep separate data. Add Volley to your Home Screen and always open it
          from there.
        </p>
      )}
      <div className="export-buttons">
        <button className="primary" onClick={save}>Save backup</button>
        <button onClick={() => file.current?.click()}>Restore backup</button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) restore(f)
          e.target.value = ''
        }}
      />
      {message && <p className="small" role="status">{message}</p>}
    </div>
  )
}
