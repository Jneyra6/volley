import { useEffect, useState } from 'react'

/** Chrome / Edge / Android fire this when the app can be installed with a button. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'volley-install-dismissed'
const WEEK = 7 * 24 * 60 * 60 * 1000

/** Opened from the Home Screen / installed app rather than a browser tab. */
export const isInstalledApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: fullscreen)').matches ||
  (navigator as { standalone?: boolean }).standalone === true

/** iPhone or iPad (iPadOS reports itself as a Mac with touch). */
const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

const isPhoneOrTablet = () => isIOS() || /Android/.test(navigator.userAgent) || window.matchMedia?.('(pointer: coarse)').matches

const recentlyDismissed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < WEEK
  } catch {
    return false
  }
}

/** Shown only in a browser tab: how to add Volley to the Home Screen, with a backup reminder if data exists here. */
export function InstallPrompt({ hasData }: { hasData: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => isInstalledApp() || recentlyDismissed())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // We show our own banner and button instead of the browser's mini bar.
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const ios = isIOS()
  // On a computer, only offer it when the browser can actually install the app.
  if (hidden || (!isPhoneOrTablet() && !installEvent)) return null

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Ignore: the banner just shows again next visit.
    }
  }
  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setHidden(true)
    setInstallEvent(null)
  }

  return (
    <div className="install-banner" role="region" aria-label="Install Volley">
      <div className="install-head">
        <img src="./icon-192.png" alt="" width="40" height="40" />
        <div>
          <b>Add Volley to your Home Screen</b>
          <span className="muted small">Opens full screen, works offline in the gym, and keeps your data safest.</span>
        </div>
      </div>

      {installEvent ? null : ios ? (
        <ol className="install-steps">
          <li>
            Tap <b>Share</b>
            <svg viewBox="0 0 24 24" className="share-icon" aria-label="Share icon"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
            {' '}at the bottom of Safari (or top right on iPad).
          </li>
          <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          <li>Open Volley from the new icon from now on.</li>
        </ol>
      ) : (
        <ol className="install-steps">
          <li>Open your browser menu (<b>⋮</b>).</li>
          <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
        </ol>
      )}

      {hasData && (
        <p className="install-warning">
          {ios ? 'On iPhone, the Home Screen app has its own storage. ' : ''}
          To bring the teams you've entered here, go to <b>Roster → Save backup</b> first, then <b>Restore backup</b> in the app.
        </p>
      )}

      <div className="install-actions">
        <button className="link small" onClick={dismiss}>Not now</button>
        {installEvent && <button className="primary" onClick={install}>Install</button>}
      </div>
    </div>
  )
}
