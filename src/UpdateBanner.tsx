import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

/**
 * Keeps the installed app current. Phones often resume a Home Screen app instead of reopening it, so we also
 * check for a new version whenever the app comes back to the front, and hourly while it's open. A new version
 * waits for the user to tap Update, so it never reloads in the middle of a match.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      setInterval(check, HOUR)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
      window.addEventListener('online', check)
    },
  })

  if (!needRefresh) return null
  return (
    <div className="update-banner" role="status">
      <span>A new version of Volley is ready.</span>
      <button className="link small" onClick={() => setNeedRefresh(false)}>Later</button>
      <button className="primary" onClick={() => updateServiceWorker(true)}>Update</button>
    </div>
  )
}
