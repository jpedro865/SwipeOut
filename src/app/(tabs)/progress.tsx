import { useIsFocused } from 'expo-router'
import { memo, useState } from 'react'
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native'
import { ACHIEVEMENTS, FREEZE_EVERY, MAX_FREEZES, dayKey, daysToFinish, longestStreak, met, parseDay, stats, streak, type Data } from '../../logic'
import { achDesc, achTitle, cap, fmtBytes, fmtDate, fmtDay, fmtPct, firstWeekday, milestone, t, weekdays } from '../../i18n'
import { useStore } from '../../store'
import { useTheme } from '../../theme'
import { Bar, Card, Icon, Screen, Stat, Txt, useSettled, type IconName } from '../../ui'

const LADDER = ['r100', 'r500', 'r1000', 'half', 'hero']
const row = { flexDirection: 'row', gap: 12 } as const

export default function Progress() {
  const { data } = useStore()
  return <Body data={useSettled(data, useIsFocused())} />
}

const Body = memo(function Body({ data }: { data: Data }) {
  const th = useTheme()
  const [back, setBack] = useState(0)
  const now = new Date()
  const today = dayKey(now)
  const s = stats(data)
  const cur = streak(data.days, today)
  const longest = longestStreak(data.days, today)
  const earliest = Object.keys(data.days).sort()[0]
  const e = earliest ? parseDay(earliest) : now
  const maxBack = Math.max(0, (now.getFullYear() - e.getFullYear()) * 12 + now.getMonth() - e.getMonth())
  const first = new Date(now.getFullYear(), now.getMonth() - back, 1)
  const lead = (first.getDay() - (firstWeekday - 1) + 7) % 7
  const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const left = daysToFinish(data)
  const cell: ViewStyle = { width: '14.28%', aspectRatio: 1, padding: 2, borderRadius: 999 }

  const nav = (label: string, icon: IconName, to: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setBack(to)}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: th.raised, opacity: disabled ? 0.3 : 1 }}
    >
      <Icon n={icon} size={18} />
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
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Txt v="title" accessibilityRole="header">{t('progress.title')}</Txt>

        <Card>
          <View accessible accessibilityLabel={t('swipe.streak', { n: cur })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: th.coral + '26', alignItems: 'center', justifyContent: 'center' }}>
              <Icon n="streak" size={40} color={th.coral} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="big">{cur}</Txt>
              <Txt v="h2" muted>{t('progress.dayStreak', { n: cur })}</Txt>
            </View>
            <View accessible accessibilityLabel={t('progress.longest', { n: longest })} style={{ alignItems: 'center', gap: 4 }}>
              <Icon n="trophy" size={22} color={th.coral} />
              <Txt v="h2">{longest}</Txt>
            </View>
          </View>
          <View accessible accessibilityLabel={t('progress.freezes', { n: data.freezes, max: MAX_FREEZES })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {Array.from({ length: MAX_FREEZES }, (_, i) => (
              <View key={i} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: i < data.freezes ? th.lavender + '33' : th.raised, opacity: i < data.freezes ? 1 : 0.5 }}>
                <Icon n="freeze" size={20} color={i < data.freezes ? th.lavender : th.muted} />
              </View>
            ))}
            <Txt v="small" muted style={{ flex: 1 }}>{t('progress.freezeHelp', { n: FREEZE_EVERY })}</Txt>
          </View>
          <Txt>{milestone(cur)}</Txt>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {nav(t('progress.prev'), 'prev', back + 1, back >= maxBack)}
            <Txt v="h2" style={{ flex: 1, textAlign: 'center' }}>{cap(fmtDate(first, { month: 'long', year: 'numeric' }))}</Txt>
            {nav(t('progress.next'), 'next', back - 1, back === 0)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {weekdays().map((w, i) => <Txt key={i} v="small" muted style={{ width: '14.28%', textAlign: 'center' }}>{w}</Txt>)}
            {Array.from({ length: lead + len }, (_, i) => {
              if (i < lead) return <View key={i} style={cell} />
              const date = new Date(first.getFullYear(), first.getMonth(), i - lead + 1)
              const k = dayKey(date)
              const d = data.days[k]
              const fill = met(d) ? th.coral : d?.frozen ? th.lavender : undefined
              const state = k > today ? t('progress.upcoming') : met(d) ? t('progress.met') : d?.frozen ? t('progress.frozen') : d?.reviewed ? t('progress.reviewedDay', { n: d.reviewed }) : t('progress.idle')
              return (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${fmtDate(date, { day: 'numeric', month: 'long' })}, ${state}${k === today ? t('progress.today') : ''}`}
                  style={[cell, { borderWidth: 2, borderColor: k === today ? th.text : 'transparent', opacity: k > today ? 0.35 : 1 }]}
                >
                  <View style={{ flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: fill, borderWidth: 1.5, borderColor: !fill && d?.reviewed ? th.coral : 'transparent' }}>
                    {d?.frozen ? <Icon n="freeze" size={13} color={th.midnight} /> : <Txt v="small" color={fill ? th.midnight : undefined}>{date.getDate()}</Txt>}
                  </View>
                </View>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {swatch(t('progress.legendMet'), { backgroundColor: th.coral })}
            {swatch(t('progress.legendFrozen'), { backgroundColor: th.lavender })}
            {swatch(t('progress.legendPartial'), { borderWidth: 1.5, borderColor: th.coral })}
            {swatch(t('progress.legendToday'), { borderWidth: 2, borderColor: th.text })}
          </View>
        </Card>

        <Card style={{ gap: 18 }}>
          <View style={row}>
            <Stat icon="photos" color={th.lavender} value={s.reviewed} label={t('progress.reviewed')} />
            <Stat icon="keep" color={th.mint} value={s.keep} label={t('progress.kept')} />
            <Stat icon="trash" color={th.coral} value={s.marked} label={t('progress.marked')} />
          </View>
          <View style={row}>
            <Stat icon="deleted" color={th.coral} value={s.deleted} label={t('progress.deleted')} />
            <Stat icon="storage" color={th.mint} value={s.deleted ? (data.bytesFreed ? fmtBytes(data.bytesFreed) : t('progress.unknown')) : '—'} label={t('progress.freed')} />
            <Stat icon="goal" color={th.coral} value={Object.values(data.days).filter(met).length} label={t('progress.goals')} />
          </View>
        </Card>

        <Card>
          <Txt v="h2">{t('progress.of', { n: s.reviewed, total: s.total })}</Txt>
          <Bar value={s.pct} color={th.lavender} />
          <Txt v="title">{fmtPct(s.pct)}</Txt>
          <Txt muted>
            {!s.total ? t('progress.openSwipe') : s.pct >= 1 ? t('progress.libraryDone') : t('progress.finishIn', { goal: data.goal, n: left })}
          </Txt>
          {ACHIEVEMENTS.filter(a => LADDER.includes(a.id)).map(a => {
            const on = data.unlocked[a.id]
            const when = on && fmtDay(on)
            return (
              <View
                key={a.id}
                accessible
                accessibilityLabel={`${on ? t('progress.unlockedOn', { title: achTitle(a.id), date: when || '' }) : t('progress.locked', { title: achTitle(a.id) })}. ${achDesc(a.id)}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: on ? 1 : 0.45 }}
              >
                <Txt v="h2">{a.icon}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }}>{achTitle(a.id)}</Txt>
                  <Txt v="small" muted>{achDesc(a.id)}</Txt>
                </View>
                {on ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon n="keep" size={12} color={th.mint} />
                    <Txt v="small" style={{ fontWeight: '700' }}>{when}</Txt>
                  </View>
                ) : (
                  <Icon n="lock" size={13} color={th.muted} />
                )}
              </View>
            )
          })}
        </Card>

        <Txt v="small" muted>{t('progress.note')}</Txt>
      </ScrollView>
    </Screen>
  )
})
