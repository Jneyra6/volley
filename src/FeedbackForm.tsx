import { useState } from 'react'
import { COACH_LEVELS, isEmpty, prefilledFormUrl, sendFeedback, type Feedback } from './feedback'

const blank: Feedback = { working: '', confusing: '', ideas: '', contact: '' }

/** Beta feedback: rating, coach level, three open questions and optional contact. Goes to the Google Form. */
export function FeedbackForm() {
  const [f, setF] = useState<Feedback>(blank)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'queued'>('idle')
  const set = (patch: Partial<Feedback>) => setF((x) => ({ ...x, ...patch }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEmpty(f)) return
    setState('sending')
    setState(await sendFeedback(f))
    setF(blank)
  }

  if (state === 'sent' || state === 'queued') {
    return (
      <div className="feedback-done">
        <b>Thank you!</b>
        <p className="muted small">
          {state === 'sent'
            ? 'Your feedback was sent. It really helps shape Volley.'
            : "You're offline, so it's saved on this phone and will send automatically when you're back online."}
        </p>
        <button className="link" onClick={() => setState('idle')}>Send more feedback</button>
      </div>
    )
  }

  return (
    <form className="feedback" onSubmit={submit}>
      <p className="muted small">Volley is in beta. Tell us what works, what's confusing, and what you'd add. Every question is optional.</p>

      <fieldset>
        <legend>How would you rate Volley so far?</legend>
        <div className="rating-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} className={f.rating === n ? 'on' : ''} aria-pressed={f.rating === n} onClick={() => set({ rating: f.rating === n ? undefined : n })}>
              {n}
            </button>
          ))}
        </div>
        <div className="rating-ends muted small"><span>Not useful yet</span><span>Love it</span></div>
      </fieldset>

      <fieldset>
        <legend>What do you coach?</legend>
        <div className="filter-chips">
          {COACH_LEVELS.map((c) => (
            <button type="button" key={c} className={f.coach === c ? 'on' : ''} aria-pressed={f.coach === c} onClick={() => set({ coach: f.coach === c ? undefined : c })}>
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>What's working well?</span>
        <textarea rows={3} value={f.working} onChange={(e) => set({ working: e.target.value })} />
      </label>
      <label className="field">
        <span>What's confusing or not working?</span>
        <textarea rows={3} value={f.confusing} onChange={(e) => set({ confusing: e.target.value })} />
      </label>
      <label className="field">
        <span>What would you add or change?</span>
        <textarea rows={3} value={f.ideas} onChange={(e) => set({ ideas: e.target.value })} />
      </label>
      <label className="field">
        <span>Name and email (optional, if you'd like a reply)</span>
        <input value={f.contact} onChange={(e) => set({ contact: e.target.value })} autoComplete="name email" />
      </label>

      <p className="muted small">Your app version and device type are included to help track down bugs.</p>
      <button type="submit" className="primary block" disabled={isEmpty(f) || state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
      <a className="small center" href={prefilledFormUrl(f)} target="_blank" rel="noopener">Open the feedback form in your browser instead</a>
    </form>
  )
}
