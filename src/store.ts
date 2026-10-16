import { useEffect, useState } from 'react'
import { emptyRoot, migrate, type Data, type Root } from './teams'

export { newId } from './teams'
export type { Data } from './teams'

const KEY = 'volley-app-v3'
const OLD_KEY = 'volley-app-v2'

function load(): Root {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const root = JSON.parse(raw) as Root
      if (root.teams?.length) return root
    }
    const old = localStorage.getItem(OLD_KEY)
    if (old) return migrate(JSON.parse(old) as Partial<Data>)
  } catch {
    // Storage blocked or corrupt: start empty.
  }
  return emptyRoot()
}

/** All app data (every team), saved to the device after every change. */
export function useRoot() {
  const [root, setRoot] = useState<Root>(load)
  // Ask the browser to keep this app's data even when the phone cleans up website storage.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(root))
    } catch {
      // Ignore: the app still works for this session.
    }
  }, [root])
  return [root, setRoot] as const
}
