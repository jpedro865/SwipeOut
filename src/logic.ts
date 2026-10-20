// Pure game logic: no React Native imports, so `node src/logic.test.ts` can check it.

type Decision = 'keep' | 'delete' | 'deleted'
// done: today's rewards were granted; earned: that grant included a streak freeze
export type Day = { reviewed: number; goal: number; done?: boolean; earned?: boolean; frozen?: boolean }
// reminder = minutes after midnight; shuffle off = newest first; year = the deck shows only that year (0 = undated photos)
export type Settings = { haptics: boolean; motion: boolean; sounds: boolean; reminder: number | null; shuffle: boolean; year: number | null }
export type Photo = { id: string; time: number; fav: boolean; year: number } // time: ms since epoch (0 = unknown); year: yearOf(time)
export type Data = {
  onboarded: boolean
  goal: number
  decisions: Record<string, Decision> // asset id -> decision
  days: Record<string, Day> // YYYY-MM-DD (local) -> that day's progress
  freezes: number
  unlocked: Record<string, string> // achievement id -> day unlocked
  bytesFreed: number
  library: number // last known photo count in the library
  settings: Settings
}

export const GOALS = [25, 50, 100, 200]
const STREAK_BADGES = [3, 7, 14, 30, 60, 100]
export const CHEERS = [25, 50, 100]
export const MAX_FREEZES = 2
export const FREEZE_EVERY = 7 // goal days in a row earn a streak freeze

export const initialData: Data = {
  onboarded: false,
  goal: 50,
  decisions: {},
  days: {},
  freezes: 0,
  unlocked: {},
  bytesFreed: 0,
  library: 0,
  settings: { haptics: true, motion: true, sounds: true, reminder: null, shuffle: true, year: null },
}

export const yearOf = (time: number) => (time ? new Date(time).getFullYear() : 0) // pre-1970 scans are negative, not unknown

// Shots within a minute of a group's first one stay together when shuffled, so near-duplicates can be compared.
// The cap stops a bulk import (thousands with one timestamp) from becoming one unshuffled block.
const BURST = 60_000
const BURST_MAX = 12

// The deck: undecided photos (of one year, if picked), newest first or shuffled.
export function arrange(photos: Photo[], decisions: Data['decisions'], shuffle: boolean, year: number | null, rand = Math.random) {
  const left = photos.filter(p => !decisions[p.id] && (year == null || p.year === year)).sort((a, b) => b.time - a.time)
  if (!shuffle) return left
  const groups: Photo[][] = []
  for (const p of left) {
    const g = groups[groups.length - 1]
    if (g && p.time && g.length < BURST_MAX && g[0].time - p.time < BURST) g.push(p)
    else groups.push([p])
  }
  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[groups[i], groups[j]] = [groups[j], groups[i]]
  }
  return groups.flat()
}

// [year, photos left] for every year in the library, newest first; undated (0) last.
export function yearsLeft(photos: Photo[], decisions: Data['decisions']) {
  const n = new Map<number, number>()
  for (const p of photos) n.set(p.year, (n.get(p.year) ?? 0) + (decisions[p.id] ? 0 : 1))
  return [...n].sort((a, b) => (a[0] && b[0] ? b[0] - a[0] : a[0] ? -1 : 1))
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
const SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn']
// Meteorological seasons (December starts winter), flipped south of the equator.
export const seasonOf = (d: Date, south = false) => SEASONS[(Math.floor(((d.getMonth() + 1) % 12) / 3) + (south ? 2 : 0)) % 4]

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (k: string, n: number) => {
  const d = parseDay(k)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

export const met = (d?: Day) => !!d && !d.frozen && d.reviewed >= d.goal

// Current streak. Today counts once met; until then yesterday's streak is still alive.
// Frozen days bridge the gap without adding to the count.
export function streak(days: Data['days'], today: string) {
  let d = met(days[today]) ? today : addDays(today, -1)
  let n = 0
  while (met(days[d]) || days[d]?.frozen) {
    if (!days[d].frozen) n++
    d = addDays(d, -1)
  }
  return n
}

export function longestStreak(days: Data['days'], today: string) {
  const keys = Object.keys(days).sort()
  let best = 0
  let run = 0
  for (let d = keys[0]; d && d <= today; d = addDays(d, 1)) {
    if (days[d]?.frozen) continue
    run = met(days[d]) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export function stats(s: Data) {
  let keep = 0
  let marked = 0
  let deleted = 0
  for (const v of Object.values(s.decisions)) {
    if (v === 'keep') keep++
    else if (v === 'delete') marked++
    else deleted++
  }
  const reviewed = keep + marked + deleted
  const total = s.library + deleted // the library count no longer includes what we deleted
  return { reviewed, keep, marked, deleted, total, pct: total ? Math.min(1, reviewed / total) : 0 }
}

type Ctx = ReturnType<typeof stats> & { longest: number }
// Titles and descriptions live in i18n.ts, keyed by id.
type Achievement = { id: string; icon: string; test: (c: Ctx) => boolean }

const badge = (days: number, icon: string): Achievement => ({ id: `streak${days}`, icon, test: c => c.longest >= days })

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'r100', icon: '📸', test: c => c.reviewed >= 100 },
  { id: 'r500', icon: '🌊', test: c => c.reviewed >= 500 },
  { id: 'r1000', icon: '🧹', test: c => c.reviewed >= 1000 },
  { id: 'half', icon: '🌗', test: c => c.total > 0 && c.pct >= 0.5 },
  { id: 'hero', icon: '🦸', test: c => c.total > 0 && c.pct >= 1 },
  { id: 'd100', icon: '💥', test: c => c.deleted >= 100 },
  { id: 'k500', icon: '💜', test: c => c.keep >= 500 },
  badge(3, '🔥'),
  badge(7, '⚡'),
  badge(14, '💪'),
  badge(30, '🌙'),
  badge(60, '🚀'),
  badge(100, '👑'),
]

function unlock(s: Data, today: string): Data {
  const c = { ...stats(s), longest: longestStreak(s.days, today) }
  const fresh = ACHIEVEMENTS.filter(a => !s.unlocked[a.id] && a.test(c))
  if (!fresh.length) return s
  return { ...s, unlocked: { ...s.unlocked, ...Object.fromEntries(fresh.map(a => [a.id, today])) } }
}

// Grants today's rewards once, even if undo later dips below the goal: done, plus a freeze every FREEZE_EVERY goal days in a row.
function settle(s: Data, today: string): Data {
  const day = s.days[today]
  if (!day || day.done || day.reviewed < day.goal) return unlock(s, today)
  const earned = streak(s.days, today) % FREEZE_EVERY === 0 && s.freezes < MAX_FREEZES
  return unlock({ ...s, freezes: s.freezes + (earned ? 1 : 0), days: { ...s.days, [today]: { ...day, done: true, earned } } }, today)
}

export function decide(s: Data, id: string, choice: 'keep' | 'delete', today: string): Data {
  if (s.decisions[id]) return s
  const prev = s.days[today]
  const day: Day = { ...prev, reviewed: (prev?.reviewed ?? 0) + 1, goal: prev?.goal ?? s.goal }
  return settle({ ...s, decisions: { ...s.decisions, [id]: choice }, days: { ...s.days, [today]: day } }, today)
}

export function undo(s: Data, id: string, today: string): Data {
  if (!s.decisions[id] || s.decisions[id] === 'deleted') return s
  const { [id]: _, ...decisions } = s.decisions
  const day = s.days[today]
  return { ...s, decisions, days: day ? { ...s.days, [today]: { ...day, reviewed: Math.max(0, day.reviewed - 1) } } : s.days }
}

// Flip a reviewed photo between keep and delete from the review screen; counts don't change.
export const setDecision = (s: Data, id: string, choice: 'keep' | 'delete'): Data =>
  s.decisions[id] && s.decisions[id] !== 'deleted' ? { ...s, decisions: { ...s.decisions, [id]: choice } } : s

export function markDeleted(s: Data, ids: string[], bytes: number, today: string): Data {
  const decisions = { ...s.decisions }
  for (const id of ids) decisions[id] = 'deleted'
  return unlock({ ...s, decisions, bytesFreed: s.bytesFreed + bytes, library: Math.max(0, s.library - ids.length) }, today)
}

// A finished day stays finished; otherwise the new goal applies today and may complete it.
export function setGoal(s: Data, goal: number, today: string): Data {
  const day = s.days[today]
  if (!day || day.done) return { ...s, goal }
  return settle({ ...s, goal, days: { ...s.days, [today]: { ...day, goal } } }, today)
}

// Photos that left the library (deleted elsewhere, or outside a limited selection) drop out of progress,
// so "reviewed" can't outrun the library. Our own deletions stay counted.
export function setLibrary(s: Data, ids: string[], today: string): Data {
  const present = new Set(ids)
  const decisions = { ...s.decisions }
  for (const id in decisions) if (decisions[id] !== 'deleted' && !present.has(id)) delete decisions[id]
  return unlock({ ...s, decisions, library: ids.length }, today)
}

// On open: spend freezes on missed days since the last goal day, but only if they cover the whole gap.
export function applyFreezes(s: Data, today: string): Data {
  const last = Object.keys(s.days).filter(k => k < today && met(s.days[k])).sort().pop()
  if (!last || !s.freezes) return s
  const gap: string[] = []
  for (let d = addDays(last, 1); d < today; d = addDays(d, 1)) if (!s.days[d]?.frozen) gap.push(d)
  if (!gap.length || gap.length > s.freezes) return s
  const days = { ...s.days }
  for (const d of gap) days[d] = { reviewed: days[d]?.reviewed ?? 0, goal: days[d]?.goal ?? s.goal, frozen: true }
  return { ...s, days, freezes: s.freezes - gap.length }
}

export const nextBadge = (current: number) => STREAK_BADGES.find(n => n > current) ?? null

// Level n needs 50·n·(n-1) XP: 0, 100, 300, 600, 1000…
export function xp(s: Data) {
  const goalDays = Object.values(s.days).filter(met).length
  const points = stats(s).reviewed + 25 * goalDays + 100 * Object.keys(s.unlocked).length
  let level = 1
  while (50 * level * (level + 1) <= points) level++
  const floor = 50 * level * (level - 1)
  const ceil = 50 * level * (level + 1)
  return { points, level, into: points - floor, span: ceil - floor }
}

export const daysToFinish = (s: Data) => {
  const { total, reviewed } = stats(s)
  return Math.ceil(Math.max(0, total - reviewed) / s.goal)
}
