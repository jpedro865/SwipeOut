// Run: npm test  (plain node + asserts, no framework)
import { addDays, applyFreezes, arrange, decide, initialData, longestStreak, markDeleted, seasonOf, setGoal, setLibrary, stats, streak, undo, xp, yearOf, yearsLeft, type Data, type Photo } from './logic.ts'

const eq = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`)
}
const ok = (v: unknown) => eq(!!v, true)

const T = '2026-03-10'
const goal = (s: Data, day: string, n = s.goal) => {
  for (let i = 0; i < n; i++) s = decide(s, `${day}-${i}`, i % 3 ? 'keep' : 'delete', day)
  return s
}

// dates roll over months/DST without drifting
eq(addDays('2026-03-31', 1), '2026-04-01')
eq(addDays('2026-03-08', -1), '2026-03-07')
eq(addDays('2024-02-28', 1), '2024-02-29')

// counting, double-swipe guard, undo
let s: Data = { ...initialData, goal: 25 }
s = decide(s, 'a', 'delete', T)
s = decide(s, 'a', 'keep', T)
eq(s.days[T].reviewed, 1)
eq(s.decisions.a, 'delete')
s = undo(s, 'a', T)
eq(s.days[T].reviewed, 0)
eq(s.decisions.a, undefined)

// streak: today pending keeps yesterday's streak alive; a missed day breaks it
s = { ...initialData, goal: 25 }
for (let i = 3; i >= 1; i--) s = goal(s, addDays(T, -i))
eq(streak(s.days, T), 3)
s = goal(s, T)
eq(streak(s.days, T), 4)
eq(streak(s.days, addDays(T, 2)), 0)
eq(longestStreak(s.days, addDays(T, 2)), 4)
ok(s.unlocked.r100 && s.unlocked.streak3)

// 7 goal days in a row earn a freeze, which bridges one missed day on next open
s = { ...initialData, goal: 25 }
for (let i = 6; i >= 0; i--) s = goal(s, addDays(T, -i))
eq(s.freezes, 1)
s = undo(s, `${T}-0`, T) // undo below goal and redo: no second freeze
s = decide(s, `${T}-0`, 'keep', T)
eq(s.freezes, 1)
const later = addDays(T, 2) // T+1 missed
s = applyFreezes(s, later)
eq(s.freezes, 0)
ok(s.days[addDays(T, 1)].frozen)
eq(streak(s.days, later), 7)
s = goal(s, later)
eq(streak(s.days, later), 8)
eq(longestStreak(s.days, later), 8)

// freezes don't cover a gap bigger than what's banked
s = { ...initialData, goal: 25, freezes: 1 }
s = goal(s, T)
eq(applyFreezes(s, addDays(T, 3)), s)

// a freeze at the cap isn't "earned"; a finished day stays finished when the goal goes up
s = { ...initialData, goal: 25, freezes: 2 }
for (let i = 6; i >= 0; i--) s = goal(s, addDays(T, -i))
eq([s.freezes, s.days[T].earned], [2, false])
s = setGoal(s, 200, T)
eq([s.goal, s.days[T].goal, streak(s.days, T)], [200, 25, 7])

// goal change applies to today; deletion stats and library progress
s = { ...initialData, goal: 100 }
s = goal(s, T, 30)
eq(streak(s.days, T), 0)
s = setGoal(s, 25, T) // lowering below today's count completes the day
eq([streak(s.days, T), s.days[T].done], [1, true])
s = setLibrary(s, Object.keys(s.decisions).filter(id => id !== '2026-03-10-1'), T) // a kept photo vanished
eq(stats(s).reviewed, 29)
s = decide(s, '2026-03-10-1', 'keep', T)
s = setLibrary(s, Object.keys(s.decisions).concat('new-photo'), T)
eq(s.library, 31)
s = setLibrary(s, Object.keys(s.decisions).filter(id => id !== '2026-03-10-6'), T) // a marked photo vanished
eq(s.decisions['2026-03-10-6'], undefined)
s = { ...s, library: 30 }
s = markDeleted(s, ['2026-03-10-0', '2026-03-10-3'], 5_000_000, T)
eq(
  { ...stats(s) },
  { reviewed: 29, keep: 20, marked: 7, deleted: 2, total: 30, pct: 29 / 30 },
)
eq(s.library, 28)
ok(s.unlocked.half && s.unlocked.hero) // every remaining photo was reviewed when the library shrank to 29

// levels: 0 → L1, 100 → L2, 300 → L3
eq(xp({ ...initialData }).level, 1)
eq(xp(goal({ ...initialData, goal: 200 }, T, 99)).level, 1) // 99 XP
eq(xp(goal({ ...initialData, goal: 200 }, T, 100)).points, 200) // 100 reviewed + Photo Rookie
eq(xp(goal({ ...initialData, goal: 25 }, T, 25)).level, 1) // 25 + 25 goal day = 50
// deck order: decided photos drop out, a year filters, shuffling keeps bursts together
const at = (y: number, mo: number, d: number, sec = 0) => new Date(y, mo, d, 12, 0, sec).getTime()
const ph = (id: string, time: number): Photo => ({ id, time, fav: false, year: yearOf(time) })
const lib: Photo[] = [ph('b1', at(2024, 6, 14, 0)), ph('b2', at(2024, 6, 14, 5)), ph('b3', at(2024, 6, 14, 9)), ph('old', at(2019, 0, 2)), ph('new', at(2025, 11, 24)), ph('undated', 0), ph('done', at(2019, 5, 1))]
const dec: Data['decisions'] = { done: 'keep' }
const ids = (ps: Photo[]) => ps.map(p => p.id)
eq(ids(arrange(lib, dec, false, null)), ['new', 'b3', 'b2', 'b1', 'old', 'undated'])
eq(ids(arrange(lib, dec, false, 2024)), ['b3', 'b2', 'b1'])
eq(ids(arrange(lib, dec, true, 2019)), ['old'])
for (let k = 0; k < 20; k++) {
  const r = ids(arrange(lib, dec, true, null))
  eq([...r].sort(), ['b1', 'b2', 'b3', 'new', 'old', 'undated']) // a permutation of what's left
  const i = r.indexOf('b3')
  eq(r.slice(i, i + 3), ['b3', 'b2', 'b1'])
}
eq(yearsLeft(lib, dec), [[2025, 1], [2024, 3], [2019, 1], [0, 1]])
// a long session shot every 40s doesn't chain into one unshuffled block; neither does a bulk import with one timestamp
const chain = Array.from({ length: 30 }, (_, i) => ph(`c${i}`, at(2019, 4, 1) + i * 40_000))
ok(ids(arrange(chain, {}, true, null)).join() !== ids(arrange(chain, {}, false, null)).join())
const pile = Array.from({ length: 120 }, (_, i) => ph(`p${i}`, at(2020, 1, 1)))
ok(ids(arrange(pile, {}, true, null)).join() !== ids(pile).join())
eq(yearOf(new Date(1965, 5, 1).getTime()), 1965) // scanned pre-1970 photos keep their year
eq([seasonOf(new Date(2024, 11, 24)), seasonOf(new Date(2025, 1, 28)), seasonOf(new Date(2024, 6, 14)), seasonOf(new Date(2024, 9, 1))], ['winter', 'winter', 'summer', 'autumn'])
eq(seasonOf(new Date(2024, 6, 14), true), 'winter')
eq(seasonOf(new Date(2024, 3, 1), true), 'autumn')

console.log('logic ok')
