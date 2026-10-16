/**
 * Beta feedback goes to the "Volley beta feedback" Google Form (owned by the Volley account).
 * Answers are posted to the form's response endpoint; the entry numbers below are the form's field ids.
 */
const FORM_ID = '1FAIpQLSctIDRZKHjiuf6qdv4ufFJCMSYByUAUopIikaJYyJAaSr0dbQ'
export const FORM_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`
const RESPONSE_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`

const ENTRY = {
  rating: 'entry.341597994',
  coach: 'entry.865809298',
  working: 'entry.1328874938',
  confusing: 'entry.1356724543',
  ideas: 'entry.567472119',
  contact: 'entry.856811210',
  version: 'entry.987311070',
  device: 'entry.1231892265',
} as const

export const COACH_LEVELS = ['High school varsity', 'High school JV or freshman', 'Club', 'Middle school', 'Other']

export interface Feedback {
  rating?: number
  coach?: string
  working: string
  confusing: string
  ideas: string
  contact: string
}

export const isEmpty = (f: Feedback) =>
  !f.rating && !f.coach && ![f.working, f.confusing, f.ideas].some((t) => t.trim())

/** e.g. "iPhone · Home Screen app · 390×844" */
export function deviceSummary() {
  const ua = navigator.userAgent
  const kind = /iPad/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1) ? 'iPad'
    : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet')
    : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other'
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  return `${kind} · ${installed ? 'Home Screen app' : 'browser'} · ${screen.width}×${screen.height}`
}

const fields = (f: Feedback) => {
  const p = new URLSearchParams()
  if (f.rating) p.set(ENTRY.rating, String(f.rating))
  if (f.coach) p.set(ENTRY.coach, f.coach)
  if (f.working.trim()) p.set(ENTRY.working, f.working.trim())
  if (f.confusing.trim()) p.set(ENTRY.confusing, f.confusing.trim())
  if (f.ideas.trim()) p.set(ENTRY.ideas, f.ideas.trim())
  if (f.contact.trim()) p.set(ENTRY.contact, f.contact.trim())
  p.set(ENTRY.version, __APP_VERSION__)
  p.set(ENTRY.device, deviceSummary())
  return p
}

/** The Google Form with these answers filled in, for when sending from the app isn't possible. */
export const prefilledFormUrl = (f: Feedback) => `${FORM_URL}?usp=pp_url&${fields(f).toString()}`

/**
 * Post to Google Forms. The response is opaque (no-cors), so success means "the request went out";
 * a network failure throws, which is when we keep it for later.
 */
async function post(body: string) {
  await fetch(RESPONSE_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
}

// Feedback written without a connection waits here (this device only) and is sent when back online.
const QUEUE_KEY = 'volley-feedback-queue'
const readQueue = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
const writeQueue = (q: string[]) => {
  try {
    if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Storage unavailable: nothing more we can do.
  }
}

/** Send feedback now, or keep it to send later if the phone is offline. */
export async function sendFeedback(f: Feedback): Promise<'sent' | 'queued'> {
  const body = fields(f).toString()
  if (!navigator.onLine) {
    writeQueue([...readQueue(), body])
    return 'queued'
  }
  try {
    await post(body)
    return 'sent'
  } catch {
    writeQueue([...readQueue(), body])
    return 'queued'
  }
}

/** Try to send anything that was saved while offline. Safe to call any time. */
export async function flushFeedbackQueue() {
  if (!navigator.onLine) return
  const queue = readQueue()
  const left: string[] = []
  for (const body of queue) {
    try {
      await post(body)
    } catch {
      left.push(body)
    }
  }
  if (left.length !== queue.length) writeQueue(left)
}

export const queuedFeedbackCount = () => readQueue().length
