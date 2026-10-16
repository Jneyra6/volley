import type { AnnotatedEvent } from './rotation'

export interface Counts {
  kills: number
  attackErrs: number
  attackAttempts: number
  aces: number
  serveErrs: number
  serveAttempts: number
  servePoints: number // sum of 1–3 ratings plus 4 per ace
  passAttempts: number
  passPoints: number // sum of 0–3 ratings; receive errors count as 0
  receiveErrs: number
  digs: number
  digErrs: number
  blocks: number
  blockErrs: number
  assists: number
  otherErrs: number
  /** Kills by attack type, e.g. { spike: 4, tip: 2 }. */
  killTypes: Record<string, number>
  /** Faults by kind, e.g. { net: 1 }. */
  faultKinds: Record<string, number>
  /** Serve errors by kind, e.g. { net: 2, long: 1 }. */
  serveErrKinds: Record<string, number>
  /** Attack errors by result, e.g. { blocked: 3, out: 1 }. */
  attackErrKinds: Record<string, number>
  /** "Whose ball?" errors. */
  whoseBall: number
}

const empty = (): Counts => ({
  kills: 0, attackErrs: 0, attackAttempts: 0,
  aces: 0, serveErrs: 0, serveAttempts: 0, servePoints: 0,
  passAttempts: 0, passPoints: 0, receiveErrs: 0,
  digs: 0, digErrs: 0, blocks: 0, blockErrs: 0, assists: 0, otherErrs: 0,
  killTypes: {}, faultKinds: {}, serveErrKinds: {}, attackErrKinds: {}, whoseBall: 0,
})

export function count(events: AnnotatedEvent[]): Counts {
  const c = empty()
  for (const e of events) {
    switch (e.code) {
      case 'kill':
        c.kills++; c.attackAttempts++
        if (e.detail) c.killTypes[e.detail] = (c.killTypes[e.detail] ?? 0) + 1
        break
      case 'attackErr':
        c.attackErrs++; c.attackAttempts++
        if (e.how) c.attackErrKinds[e.how] = (c.attackErrKinds[e.how] ?? 0) + 1
        break
      case 'attack': c.attackAttempts++; break
      case 'ace': c.aces++; c.serveAttempts++; c.servePoints += 4; break
      case 'serveErr':
        c.serveErrs++; c.serveAttempts++
        if (e.detail) c.serveErrKinds[e.detail] = (c.serveErrKinds[e.detail] ?? 0) + 1
        break
      case 'whoseBall': c.whoseBall++; c.otherErrs++; break
      case 'serve': c.serveAttempts++; c.servePoints += e.rating ?? 2; break
      case 'pass': c.passAttempts++; c.passPoints += e.rating ?? 2; break
      case 'receiveErr': c.receiveErrs++; c.passAttempts++; break
      case 'dig': c.digs++; break
      case 'digErr': c.digErrs++; break
      case 'block': c.blocks++; break
      case 'blockErr': c.blockErrs++; break
      case 'assist': c.assists++; break
      case 'setErr': c.otherErrs++; break
      case 'fault':
        c.otherErrs++
        if (e.detail) c.faultKinds[e.detail] = (c.faultKinds[e.detail] ?? 0) + 1
        break
    }
  }
  return c
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null)

/** Derived numbers; null means "not enough data" and should show as "-". */
export function derive(c: Counts) {
  return {
    hittingPct: ratio(c.kills - c.attackErrs, c.attackAttempts),
    servePct: ratio(c.serveAttempts - c.serveErrs, c.serveAttempts),
    serveRating: ratio(c.servePoints, c.serveAttempts),
    passRating: ratio(c.passPoints, c.passAttempts),
    digPct: ratio(c.digs, c.digs + c.digErrs),
  }
}

/** Side-out % (won rallies when they served) and point-scoring % (won rallies when we served). */
export function teamRates(events: AnnotatedEvent[]) {
  let theyServed = 0, sideOuts = 0, weServed = 0, servePointsWon = 0
  for (const e of events) {
    if (!e.winner) continue
    if (e.before.serving === 'them') {
      theyServed++
      if (e.winner === 'us') sideOuts++
    } else {
      weServed++
      if (e.winner === 'us') servePointsWon++
    }
  }
  return { sideOutPct: ratio(sideOuts, theyServed), pointScoringPct: ratio(servePointsWon, weServed) }
}

export const fmt = {
  pct: (v: number | null) => (v === null ? '-' : `${(v * 100).toFixed(1)}%`),
  hit: (v: number | null) => (v === null ? '-' : v.toFixed(3).replace(/^(-?)0\./, '$1.')),
  rating: (v: number | null) => (v === null ? '-' : v.toFixed(2)),
}
