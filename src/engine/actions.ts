import type { ActionDef, Team } from './types'

/** Actions work for either team: who did it comes from the event, not the action. */
export const ACTIONS: ActionDef[] = [
  { code: 'ace', label: 'Ace', family: 'earned', group: 'serve' },
  { code: 'serve', label: 'Serve in', family: 'rally', group: 'serve' },
  { code: 'serveErr', label: 'Serve error', family: 'error', group: 'serve' },
  { code: 'pass', label: 'Pass', family: 'rally', group: 'receive' },
  { code: 'receiveErr', label: 'Receive error', family: 'error', group: 'receive' },
  { code: 'kill', label: 'Kill', family: 'earned', group: 'attack' },
  { code: 'attack', label: 'Attack in play', family: 'rally', group: 'attack' },
  { code: 'attackErr', label: 'Attack error', family: 'error', group: 'attack' },
  { code: 'block', label: 'Block', family: 'earned', group: 'block' },
  { code: 'blockErr', label: 'Block error', family: 'error', group: 'block' },
  { code: 'dig', label: 'Dig', family: 'rally', group: 'defense' },
  { code: 'digErr', label: 'Dig error', family: 'error', group: 'defense' },
  // Two players both go for the ball, then both stop. Can be charged to a player or left as a team error.
  { code: 'whoseBall', label: 'Whose ball?', family: 'error', group: 'defense' },
  { code: 'assist', label: 'Assist', family: 'rally', group: 'set' },
  { code: 'setErr', label: 'Set error', family: 'error', group: 'set' },
  { code: 'fault', label: 'Fault…', family: 'error', group: 'fault' },
]

/** A timeout: logged with the team that called it, never scores and is not a stat. */
export const TIMEOUT: ActionDef = { code: 'timeout', label: 'Timeout', family: 'rally', group: 'timeout' }

/** A manual scoreboard change: moves the score without a rally, so no serve change, rotation or stats. */
export const ADJUST: ActionDef = { code: 'adjust', label: 'Manual change', family: 'rally', group: 'adjust' }

/** A lineup change mid-set: a bench player replaces someone, or two players swap spots. */
export const SUB: ActionDef = { code: 'sub', label: 'Substitution', family: 'rally', group: 'sub' }

/** Codes from earlier versions, kept so old matches still replay. Always the opponent's. */
const LEGACY: ActionDef[] = [
  { code: 'oppPoint', label: 'Their point', family: 'earned', group: 'attack' },
  { code: 'oppError', label: 'Their error', family: 'error', group: 'fault' },
]

export const ACTION_BY_CODE: Record<string, ActionDef> = Object.fromEntries(
  [...ACTIONS, TIMEOUT, ADJUST, SUB, ...LEGACY].map((a) => [a.code, a]),
)

export interface Rating {
  value: number
  label: string
  help: string
}

/** Quality scales, with plain-language help shown on the buttons. */
export const RATINGS: Record<string, Rating[]> = {
  serve: [
    { value: 3, label: 'Tough', help: 'They barely got it up: overpass or free ball back' },
    { value: 2, label: 'Good', help: 'Their pass was off; setter had few options' },
    { value: 1, label: 'Easy', help: 'They passed it perfectly and could run any play' },
  ],
  pass: [
    { value: 3, label: 'Perfect', help: 'Setter can run any play' },
    { value: 2, label: 'Good', help: 'Setter had to move; some options left' },
    { value: 1, label: 'Poor', help: 'Setter scrambles; only a high outside set' },
    { value: 0, label: 'Overpass / shank', help: 'Still in play but no attack possible' },
  ],
}

export const ATTACK_TYPES: [string, string][] = [
  ['spike', 'Spike'],
  ['tip', 'Tip'],
  ['dump', 'Setter dump'],
  ['free', 'Free ball'],
  ['down', 'Down ball'],
]

export const FAULT_KINDS: [string, string][] = [
  ['net', 'Net touch'],
  ['foot', 'Foot fault (serve)'],
  ['handling', 'Ball handling (lift / double)'],
  ['rotation', 'Out of rotation'],
  ['reach', 'Reaching over the net'],
  ['center', 'Center line'],
  ['backrow', 'Back-row attack'],
  ['four', 'Four hits'],
  ['libero', 'Libero violation'],
]

export const SERVE_ERRORS: [string, string][] = [
  ['net', 'Into the net'],
  ['long', 'Out long'],
  ['wide', 'Out wide'],
]

export const ATTACK_RESULTS: [string, string][] = [
  ['blocked', 'Blocked'],
  ['out', 'Out'],
  ['net', 'Into the net'],
]

/** Actions that ask "what kind?" before they are recorded. */
export const DETAILS: Record<string, { prompt: string; options: [string, string][] }> = {
  kill: { prompt: 'Kill: what kind?', options: ATTACK_TYPES },
  attack: { prompt: 'Attack in play: what kind?', options: ATTACK_TYPES },
  attackErr: { prompt: 'Attack error: what kind?', options: ATTACK_TYPES },
  serveErr: { prompt: 'Serve error: what happened?', options: SERVE_ERRORS },
  fault: { prompt: 'Fault: what kind?', options: FAULT_KINDS },
}

/** A second question after "what kind?": how the error happened (stored in event.how). */
export const HOW: Record<string, { prompt: string; options: [string, string][] }> = {
  attackErr: { prompt: 'Attack error: what happened?', options: ATTACK_RESULTS },
}

/** Actions that don't need a player picked first (with none picked, they count as a team error). */
export const NO_PLAYER_NEEDED = new Set(['whoseBall'])

/** "Tip", "Into the net", or "Spike, blocked" for an event's what-kind and how answers. */
export const detailLabel = (code: string, detail?: string, how?: string) => {
  const kind = DETAILS[code]?.options.find(([v]) => v === detail)?.[1]
  const result = HOW[code]?.options.find(([v]) => v === how)?.[1]
  return [kind, result && (kind ? result.toLowerCase() : result)].filter(Boolean).join(', ') || undefined
}

/**
 * Serve actions belong only to the serving team, and for us only to the player in position 1.
 * Receive actions belong only to the receiving team. Everything else can happen to anyone mid-rally.
 */
export function actionAllowed(a: ActionDef, side: Team, serving: Team, isServer: boolean): boolean {
  if (a.group === 'serve') return side === serving && (side === 'them' || isServer)
  if (a.group === 'receive') return side !== serving
  return true
}
