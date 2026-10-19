import { useIsFocused } from 'expo-router'
import { memo, useRef, useState } from 'react'
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native'
import { ACHIEVEMENTS, MAX_FREEZES, dayKey, daysToFinish, longestStreak, met, milestone, parseDay, stats, streak, type Data } from '../../logic'
import { useStore } from '../../store'
import { useTheme } from '../../theme'
import { Bar, Card, Screen, Stat, Txt, fmtBytes, fmtDay } from '../../ui'

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LADDER = ['r100', 'r500', 'r1000', 'half', 'hero']
const row = { flexDirection: 'row', gap: 12 } as const
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, o)

// Visited tabs stay mounted: render from the last focused snapshot so a hidden tab does no work per swipe.
export default function Progress() {
  const { data } = useStore()
  const shown = useRef(data)
  if (useIsFocused()) shown.current = data
  return <Body data={shown.current} />
}

const Body = memo(function Body({ data }: { data: Data }) {
  const t = useTheme()
  const [back, setBack] = useState(0)
  const now = new Date()
  const today = dayKey(now)
  const s = stats(data)
  const cur = streak(data.days, today)
  const earliest = Object.keys(data.days).sort()[0]
  const e = earliest ? parseDay(earliest) : now
  const maxBack = Math.max(0, (now.getFullYear() - e.getFullYear()) * 12 + now.getMonth() - e.getMonth())
  const first = new Date(now.getFullYear(), now.getMonth() - back, 1)
  const lead = first.getDay()
  const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const left = daysToFinish(data)
  const cell: ViewStyle = { width: '14.28%', aspectRatio: 1, padding: 2, borderRadius: 999 }

  const nav = (label: string, glyph: string, to: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setBack(to)}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
    >
      <Txt v="title">{glyph}</Txt>
    </Pressable>
  )
  const swatch = (label: string, style: ViewStyle) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[{ width: 14, height: 14, borderRadius: 7 }, style]} />
      <Txt v="small" muted>{label}</Txt>
    </View>
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Txt v="title">Your progress</Txt>

        <Card>
          <View>
            <Txt v="big">🔥 {cur}</Txt>
            <Txt v="h2">day streak</Txt>
          </View>
          <Txt muted>Longest: {longestStreak(data.days, today)}</Txt>
          <Txt>🧊 {data.freezes}/{MAX_FREEZES} streak freezes</Txt>
          <Txt v="small" muted>Earn one every 7 goal days in a row. It covers a missed day automatically.</Txt>
          <Txt>{milestone(cur)}</Txt>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {nav('Previous month', '‹', back + 1, back >= maxBack)}
            <Txt v="h2" style={{ flex: 1, textAlign: 'center' }}>{fmt(first, { month: 'long', year: 'numeric' })}</Txt>
            {nav('Next month', '›', back - 1, back === 0)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {WEEK.map(w => <Txt key={w} v="small" muted style={{ width: '14.28%', textAlign: 'center' }}>{w}</Txt>)}
            {Array.from({ length: lead + len }, (_, i) => {
              if (i < lead) return <View key={i} style={cell} />
              const date = new Date(first.getFullYear(), first.getMonth(), i - lead + 1)
              const k = dayKey(date)
              const d = data.days[k]
              const fill = met(d) ? t.coral : d?.frozen ? t.lavender : undefined
              const state = k > today ? 'upcoming' : met(d) ? 'goal met' : d?.frozen ? 'streak freeze used' : d?.reviewed ? `${d.reviewed} reviewed` : 'no activity'
              return (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${fmt(date, { month: 'long', day: 'numeric' })}, ${state}${k === today ? ', today' : ''}`}
                  style={[cell, { borderWidth: 2, borderColor: k === today ? t.text : 'transparent', opacity: k > today ? 0.35 : 1 }]}
                >
                  <View style={{ flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: fill, borderWidth: 1.5, borderColor: !fill && d?.reviewed ? t.coral : 'transparent' }}>
                    <Txt v="small" color={fill ? t.midnight : undefined}>{d?.frozen ? '❄️' : date.getDate()}</Txt>
                  </View>
                </View>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {swatch('Goal met', { backgroundColor: t.coral })}
            {swatch('Frozen ❄️', { backgroundColor: t.lavender })}
            {swatch('Partial', { borderWidth: 1.5, borderColor: t.coral })}
            {swatch('Today', { borderWidth: 2, borderColor: t.text })}
          </View>
        </Card>

        <Card>
          <View style={row}>
            <Stat value={s.reviewed} label="Photos reviewed" />
            <Stat value={s.keep} label="Kept" />
          </View>
          <View style={row}>
            <Stat value={s.marked} label="Marked for deletion" />
            <Stat value={s.deleted} label="Deleted" />
          </View>
          <View style={row}>
            <Stat value={s.deleted ? (data.bytesFreed ? fmtBytes(data.bytesFreed) : 'Unknown') : '—'} label="Storage freed" />
            <Stat value={Object.values(data.days).filter(met).length} label="Daily goals completed" />
          </View>
        </Card>

        <Card>
          <Txt v="h2">{s.reviewed.toLocaleString()} of {s.total.toLocaleString()} photos reviewed</Txt>
          <Bar value={s.pct} color={t.lavender} />
          <Txt v="title">{Math.round(s.pct * 100)}%</Txt>
          <Txt muted>
            {!s.total
              ? 'Open the Swipe tab to load your library.'
              : s.pct >= 1
                ? 'Library fully reviewed 🦸'
                : `At ${data.goal} a day, you'll finish in about ${left} day${left === 1 ? '' : 's'}`}
          </Txt>
          {ACHIEVEMENTS.filter(a => LADDER.includes(a.id)).map(a => {
            const on = data.unlocked[a.id]
            const when = on && fmtDay(on)
            return (
              <View
                key={a.id}
                accessible
                accessibilityLabel={`${a.title}, ${on ? `unlocked ${when}` : 'locked'}. ${a.desc}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: on ? 1 : 0.45 }}
              >
                <Txt v="h2">{a.icon}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }}>{a.title}</Txt>
                  <Txt v="small" muted>{a.desc}</Txt>
                </View>
                {on && <Txt v="small" style={{ fontWeight: '700' }}>✓ {when}</Txt>}
              </View>
            )
          })}
        </Card>

        <Txt v="small" muted>Reviewed doesn't mean deleted — marked photos stay until you confirm in Review.</Txt>
      </ScrollView>
    </Screen>
  )
})
