// Run: npm test  (plain node + asserts, no framework)
import { addDays, applyFreezes, decide, initialData, longestStreak, markDeleted, setGoal, setLibrary, stats, streak, undo, xp, type Data } from './logic.ts'

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

// goal change applies to today; deletion stats and library progress
s = { ...initialData, goal: 100 }
s = goal(s, T, 30)
eq(streak(s.days, T), 0)
s = setGoal(s, 25, T)
eq(streak(s.days, T), 1)
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
console.log('logic ok')
