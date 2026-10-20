import { getCalendars, getLocales, type Locale } from 'expo-localization'
import { fr } from './fr'
import { nextBadge, parseDay } from './logic'

// English is the source of the keys. A [one, other] pair is picked by the {n} variable.
// Hermes has no Intl.PluralRules, hence the hand-written rule in t().
const en = {
  'tab.swipe': 'Swipe',
  'tab.progress': 'Progress',
  'tab.profile': 'Profile',

  // swipe
  'swipe.marked': ['{n} photo marked for deletion. Nothing is deleted until you review.', '{n} photos marked for deletion. Nothing is deleted until you review.'],
  'swipe.streak': ['{n}-day streak', '{n}-day streak'],
  'swipe.freezes': [', {n} streak freeze', ', {n} streak freezes'],
  'swipe.goal': 'Today’s goal: {done} of {goal} photos',
  'swipe.goalDone': 'Goal complete: {done} of {goal} today',
  'swipe.addMore': 'Add more photos',
  'swipe.permTitle': 'Let’s meet your camera roll',
  'swipe.permBody': 'SwipeOut shows your photos one at a time so you can keep them or mark them for deletion. They never leave your device.',
  'swipe.allow': 'Allow photo access',
  'swipe.loading': 'Loading your library…',
  'swipe.failed': 'Couldn’t load your library',
  'swipe.allDone': 'Camera roll hero — every photo reviewed',
  'swipe.empty': 'No photos here yet',
  'swipe.emptyBody': 'Snap a few and come back — we’ll be ready to swipe.',
  'swipe.review': ['Review {n} marked', 'Review {n} marked'],
  'swipe.retry': 'Try again',
  'swipe.checkNew': 'Check for new photos',
  'swipe.delete': 'Mark for deletion',
  'swipe.undo': 'Undo',
  'swipe.keep': 'Keep',
  'swipe.hint': 'Swipe left to mark · right to keep',
  'swipe.cheer': '{n} today',
  'swipe.cheerSay': ['{n} photo reviewed today', '{n} photos reviewed today'],
  'swipe.unlocked': 'Achievement unlocked: {title}',
  'swipe.didKeep': 'Kept',
  'swipe.didDelete': 'Marked for deletion',
  'deck.photo': 'Photo',
  'deck.hint': 'Swipe right to keep, left to mark for deletion',

  // review
  'review.title': 'Review',
  'review.help': 'Tap to keep · nothing is deleted until you confirm',
  'review.cleared': ['photo cleared', 'photos cleared'],
  'review.nothing': 'Nothing was deleted.',
  'review.freed': '≈ {size} freed',
  'review.stuck': ['{n} photo couldn’t be deleted and stays marked.', '{n} photos couldn’t be deleted and stay marked.'],
  'review.none': 'Nothing marked yet. Swipe left on photos you don’t need.',
  'review.done': 'Done',
  'review.kept': 'Photo, kept',
  'review.markedPhoto': 'Photo, marked for deletion',
  'review.gridHint': 'Tap to toggle. Long-press to preview.',
  'review.toFree': '≈ {size} to free',
  'review.estimating': 'Estimating size…',
  'review.keepAll': 'Keep all',
  'review.deleting': 'Deleting…',
  'review.deleteN': 'Delete {n}',
  'review.confirm': ['Delete {n} photo?', 'Delete {n} photos?'],
  'review.confirmIos': ['It’ll move to Recently Deleted in Photos, where you can recover it for 30 days.', 'They’ll move to Recently Deleted in Photos, where you can recover them for 30 days.'],
  'review.confirmAndroid': ['This permanently removes it from your device.', 'This permanently removes them from your device.'],
  'review.closePreview': 'Close preview',

  // progress
  'progress.title': 'Your progress',
  'progress.dayStreak': ['day streak', 'day streak'],
  'progress.longest': 'Longest streak: {n}',
  'progress.freezes': '{n} of {max} streak freezes',
  'progress.freezeHelp': 'Earn one every {n} goal days in a row. It covers a missed day automatically.',
  'progress.milestone': ['Next milestone: {days} days — {n} more to unlock {title}', 'Next milestone: {days} days — {n} more to unlock {title}'],
  'progress.allBadges': 'Every streak badge unlocked 👑',
  'progress.prev': 'Previous month',
  'progress.next': 'Next month',
  'progress.upcoming': 'upcoming',
  'progress.met': 'goal met',
  'progress.frozen': 'streak freeze used',
  'progress.reviewedDay': ['{n} reviewed', '{n} reviewed'],
  'progress.idle': 'no activity',
  'progress.today': ', today',
  'progress.legendMet': 'Goal met',
  'progress.legendFrozen': 'Frozen',
  'progress.legendPartial': 'Partial',
  'progress.legendToday': 'Today',
  'progress.reviewed': 'Reviewed',
  'progress.kept': 'Kept',
  'progress.marked': 'Marked',
  'progress.deleted': 'Deleted',
  'progress.freed': 'Storage freed',
  'progress.goals': 'Goals met',
  'progress.unknown': 'Unknown',
  'progress.of': ['{n} of {total} photos reviewed', '{n} of {total} photos reviewed'],
  'progress.openSwipe': 'Open the Swipe tab to load your library.',
  'progress.libraryDone': 'Library fully reviewed 🦸',
  'progress.finishIn': ['At {goal} a day, you’ll finish in about {n} day', 'At {goal} a day, you’ll finish in about {n} days'],
  'progress.unlockedOn': '{title}, unlocked {date}',
  'progress.locked': '{title}, locked',
  'progress.note': 'Reviewed doesn’t mean deleted — marked photos stay until you confirm in Review.',

  // profile
  'profile.title': 'Profile',
  'profile.level': 'Level {n}',
  'profile.xp': '{into} / {span} XP to level {n}',
  'profile.points': ['{n} total point', '{n} total points'],
  'profile.rules': 'Points: +1 per photo, +25 per daily goal, +100 per achievement',
  'profile.achievements': 'Achievements',
  'profile.settings': 'Settings',
  'profile.goal': 'Daily goal',
  'profile.perDay': '{n} photos a day',
  'profile.shuffle': 'Shuffle photos',
  'profile.sounds': 'Sounds',
  'profile.soundsNote': 'Muted when your phone is on silent',
  'profile.haptics': 'Haptic feedback',
  'profile.motion': 'Animations & celebrations',
  'profile.reminder': 'Daily reminder',
  'profile.reminderAt': 'Reminder at {time}',
  'profile.earlier': '30 minutes earlier',
  'profile.later': '30 minutes later',
  'profile.language': 'Language',
  'profile.languageName': 'English',
  'profile.privacy': 'Privacy',
  'profile.privacyBody': 'Your photos never leave your device. SwipeOut only keeps your progress, stored locally.',
  'profile.photoAccess': 'Photo access',
  'profile.footer': 'SwipeOut {v} · Keep the memories. Lose the clutter.',
  'notif.body': 'Your next {n} photos are waiting 📸',
  'notif.channel': 'Daily reminder',
  'notif.offTitle': 'Notifications are off',
  'notif.offBody': 'To get a daily reminder, allow notifications for SwipeOut in Settings.',
  'common.notNow': 'Not now',
  'common.openSettings': 'Open Settings',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.close': 'Close',

  // complete
  'complete.title': 'Goal complete!',
  'complete.streak': 'Streak',
  'complete.today': 'Today',
  'complete.marked': 'Marked',
  'complete.library': 'Library',
  'complete.freeze': 'Streak freeze earned',
  'complete.continue': 'Keep swiping',

  // onboarding
  'onb.blurb25': 'A quick tidy',
  'onb.blurb50': 'Steady progress',
  'onb.blurb100': 'Big push',
  'onb.blurb200': 'Power cleanup',
  'onb.minutes': '~{n} min',
  'onb.start': 'Get started',
  'onb.tagline': 'Swipe the clutter away.',
  'onb.intro': 'Turn an overwhelming camera roll into a small daily habit — a few swipes a day, and it adds up.',
  'onb.next': 'Next',
  'onb.how': 'How it works',
  'onb.how1': 'Swipe left to mark a photo for deletion',
  'onb.how2': 'Swipe right to keep it',
  'onb.how3': 'Nothing is deleted until you review and confirm',
  'onb.pickGoal': 'Pick a daily goal',
  'onb.aDay': 'photos a day',
  'onb.anytime': 'You can change this anytime.',
  'onb.accessTitle': 'Let SwipeOut see your photos',
  'onb.accessBody': 'Photos stay on your device. Access is only used to show them to you one at a time and to delete the ones you confirm.',
  'onb.back': 'Back',
  'onb.step': 'Step {n} of {total}',

  // achievements (ids from logic.ts)
  'ach.r100': 'Photo Rookie',
  'ach.r100.d': '100 reviewed. You’re officially underway.',
  'ach.r500': 'Momentum',
  'ach.r500.d': '500 reviewed. You’re building momentum.',
  'ach.r1000': 'Big Cleanup',
  'ach.r1000.d': '1,000 reviewed. The big cleanup is working.',
  'ach.half': 'Halfway There',
  'ach.half.d': '50% of your library reviewed.',
  'ach.hero': 'Camera Roll Hero',
  'ach.hero.d': 'Your selected library is fully reviewed.',
  'ach.d100': 'Clutter Crusher',
  'ach.d100.d': '100 photos deleted for good.',
  'ach.k500': 'Memory Keeper',
  'ach.k500.d': '500 photos kept.',
  'ach.streak3': 'Spark',
  'ach.streak7': 'One Week Wonder',
  'ach.streak14': 'Fortnight Force',
  'ach.streak30': 'Monthly Master',
  'ach.streak60': 'Unstoppable',
  'ach.streak100': 'Gallery Legend',
  'ach.streak.d': '{n}-day streak',

  // dates
  'unit.kb': 'KB',
  'unit.mb': 'MB',
  'unit.gb': 'GB',
} satisfies Record<string, Str>

type Str = string | readonly [string, string]
export type Key = keyof typeof en
export type Dict = Record<Key, Str>

// French typography: narrow no-break space before ! ? ; % and no-break space before : and inside « ».
const typeset = (s: string) => s.replace(/ ([!?;%])/g, ' $1').replace(/ ([:»])/g, ' $1').replace(/« /g, '« ')
const dicts = {
  en: en as Dict,
  fr: Object.fromEntries(Object.entries(fr).map(([k, v]) => [k, typeof v === 'string' ? typeset(v) : v.map(typeset)])) as Dict,
}

export let lang: keyof typeof dicts = 'en'
export let locale = 'en' // BCP 47 tag for dates and numbers
export let firstWeekday = 1 // 1 = Sunday

// The first preferred language we speak wins ([de, fr] gets French). Re-run from the root layout's
// useLocales(): Android can switch the app language without restarting the app.
export function setLocales(all: Locale[]) {
  const l = all.find(l => l.languageCode === 'fr' || l.languageCode === 'en') ?? all[0]
  lang = l.languageCode === 'fr' ? 'fr' : 'en'
  const region = all[0].regionCode // the user's region, whatever language they read
  locale = l.languageCode === lang ? l.languageTag : region ? `en-${region}` : 'en' // English words, local formats (en-DE: 20:00, 5 Oct)
  firstWeekday = getCalendars()[0]?.firstWeekday ?? 1
  return lang
}
setLocales(getLocales())

const one = (n: number) => (lang === 'fr' ? n < 2 : n === 1)

// Numbers get the locale's grouping, so pass years as strings ("2024", not 2 024).
export function t(key: Key, vars: Record<string, string | number> = {}) {
  const s = dicts[lang][key]
  const str = typeof s === 'string' ? s : s[one(Number(vars.n)) ? 0 : 1]
  return str.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k]
    return typeof v === 'number' ? fmtNum(v) : (v ?? '')
  })
}

export const fmtDate = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, o)
export const fmtDay = (k: string) => fmtDate(parseDay(k), { day: 'numeric', month: 'short' })
export const fmtTime = (m: number) => new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
export const fmtNum = (n: number) => n.toLocaleString(locale)
// Floors so 100% only shows when it's true; the epsilon absorbs float error (0.29 * 100 = 28.999…).
export const fmtPct = (v: number) => (Math.floor(v * 100 + 1e-9) / 100).toLocaleString(locale, { style: 'percent' }) // 50% / 50 %
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) // French months come lowercase

export function fmtBytes(n: number) {
  const num = (v: number, digits: number) => v.toLocaleString(locale, { maximumFractionDigits: digits })
  if (n < 1e6) return `${num(n / 1e3, 0)} ${t('unit.kb')}`
  if (n < 1e9) return `${num(n / 1e6, n < 1e7 ? 1 : 0)} ${t('unit.mb')}`
  return `${num(n / 1e9, 2)} ${t('unit.gb')}`
}

// Weekday initials in the locale's order, starting on its first day of the week.
export const weekdays = () => Array.from({ length: 7 }, (_, i) => fmtDate(new Date(2023, 0, firstWeekday + i), { weekday: 'narrow' })) // 1 Jan 2023 was a Sunday

export const achTitle = (id: string) => t(`ach.${id}` as Key)
export const achDesc = (id: string) => (id.startsWith('streak') ? t('ach.streak.d', { n: Number(id.slice(6)) }) : t(`ach.${id}.d` as Key))

export function milestone(cur: number) {
  const days = nextBadge(cur)
  return days ? t('progress.milestone', { days, n: days - cur, title: achTitle(`streak${days}`) }) : t('progress.allBadges')
}
