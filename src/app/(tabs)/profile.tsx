import * as Notifications from 'expo-notifications'
import { useIsFocused } from 'expo-router'
import { memo, useRef } from 'react'
import { Alert, Linking, Platform, Pressable, ScrollView, Switch, View } from 'react-native'
import { ACHIEVEMENTS, GOALS, dayKey, setGoal, xp, type Data, type Settings } from '../../logic'
import { useStore } from '../../store'
import { useTheme } from '../../theme'
import { Bar, Button, Card, Screen, Txt, fmtDay } from '../../ui'

const fmtTime = (m: number) => new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Serialized so quick stepper taps can't interleave cancel/schedule into duplicate reminders.
let queue = Promise.resolve()
const schedule = (minutes: number | null, goal: number) => {
  queue = queue
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync()
      if (minutes == null) return
      await Notifications.scheduleNotificationAsync({
        content: { title: 'SwipeOut', body: `Your next ${goal} photos are waiting 📸` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(minutes / 60), minute: minutes % 60, channelId: 'reminders' },
      })
    })
    .catch(e => console.warn('swipeout: could not schedule reminder', e))
}

// Visited tabs stay mounted: render from the last focused snapshot so a hidden tab does no work per swipe.
export default function Profile() {
  const { data, update } = useStore()
  const shown = useRef(data)
  if (useIsFocused()) shown.current = data
  return <Body data={shown.current} update={update} />
}

const Body = memo(function Body({ data, update }: { data: Data; update: ReturnType<typeof useStore>['update'] }) {
  const t = useTheme()
  const { level, into, span, points } = xp(data)
  const { reminder, haptics, motion } = data.settings
  const set = (patch: Partial<Settings>) => update(s => ({ ...s, settings: { ...s.settings, ...patch } }))

  const pickGoal = (n: number) => {
    update(s => setGoal(s, n, dayKey()))
    if (reminder != null) schedule(reminder, n)
  }

  const step = (d: number) => {
    const m = ((reminder ?? 0) + d + 1440) % 1440
    set({ reminder: m })
    schedule(m, data.goal)
  }

  const toggleReminder = async (on: boolean) => {
    if (!on) {
      set({ reminder: null })
      return schedule(null, data.goal)
    }
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Daily reminder', importance: Notifications.AndroidImportance.DEFAULT })
    const cur = await Notifications.getPermissionsAsync()
    if (!cur.granted && !(cur.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)) {
      return Alert.alert('Notifications are off', 'To get a daily reminder, allow notifications for SwipeOut in Settings.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ])
    }
    set({ reminder: 20 * 60 })
    schedule(20 * 60, data.goal)
  }

  const toggle = (label: string, value: boolean, onValueChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
      <Txt>{label}</Txt>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ true: t.coral, false: t.line }} thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined} />
    </View>
  )

  const stepBtn = (d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`30 minutes ${d < 0 ? 'earlier' : 'later'}`}
      onPress={() => step(d)}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.raised }}
    >
      <Txt v="h2">{d < 0 ? '−' : '+'}</Txt>
    </Pressable>
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Txt v="title">Profile</Txt>

        <Card>
          <Txt v="big">Level {level}</Txt>
          <Bar value={into / span} color={t.lavender} />
          <Txt muted>{into.toLocaleString()} / {span.toLocaleString()} XP to level {level + 1}</Txt>
          <Txt v="h2">⭐ {points.toLocaleString()} total points</Txt>
          <Txt v="small" muted>+1 per photo · +25 per daily goal · +100 per achievement</Txt>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Txt v="h2">Achievements</Txt>
            <Txt muted>{Object.keys(data.unlocked).length}/{ACHIEVEMENTS.length} unlocked</Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ACHIEVEMENTS.map(a => {
              const day = data.unlocked[a.id]
              return (
                <View
                  key={a.id}
                  accessible
                  accessibilityLabel={`${a.title}, ${day ? `unlocked ${fmtDay(day)}` : `locked. ${a.desc}`}`}
                  style={{ width: '31%', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: day ? t.raised : 'transparent' }}
                >
                  <Txt v="title" style={{ opacity: day ? 1 : 0.3 }}>{a.icon}</Txt>
                  <Txt v="small" style={{ fontWeight: '700', textAlign: 'center' }}>{a.title}</Txt>
                  <Txt v="small" muted style={{ textAlign: 'center' }}>{day ? `✓ ${fmtDay(day)}` : a.desc}</Txt>
                </View>
              )
            })}
          </View>
        </Card>

        <Card>
          <Txt v="h2">Settings</Txt>
          <Txt>Daily goal</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {GOALS.map(n => {
              const on = n === data.goal
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} photos a day`}
                  accessibilityState={{ selected: on }}
                  onPress={() => pickGoal(n)}
                  style={{ flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.coral : t.raised }}
                >
                  <Txt color={on ? t.midnight : undefined} style={{ fontWeight: '700' }}>{on ? `✓ ${n}` : n}</Txt>
                </Pressable>
              )
            })}
          </View>
          {toggle('Daily reminder', reminder != null, toggleReminder)}
          {reminder != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              {stepBtn(-30)}
              <Txt v="h2" accessibilityLabel={`Reminder at ${fmtTime(reminder)}`} style={{ minWidth: 100, textAlign: 'center' }}>{fmtTime(reminder)}</Txt>
              {stepBtn(30)}
            </View>
          )}
          {toggle('Haptic feedback', haptics, v => set({ haptics: v }))}
          {toggle('Animations & celebrations', motion, v => set({ motion: v }))}
        </Card>

        <Card>
          <Txt v="h2">Privacy</Txt>
          <Txt muted>Your photos never leave your device. SwipeOut only keeps your progress, stored locally.</Txt>
          <Button title="Manage photo access" outline onPress={() => Linking.openSettings()} />
        </Card>

        <Txt v="small" muted style={{ textAlign: 'center' }}>SwipeOut 1.0 · Keep the memories. Lose the clutter.</Txt>
      </ScrollView>
    </Screen>
  )
})
