import * as Notifications from 'expo-notifications'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View, useAnimatedValue } from 'react-native'
import { Confetti } from '../components/Confetti'
import { GoalPicker } from '../components/GoalPicker'
import { fmtTime, t, type Key } from '../i18n'
import { completeProfile, dayKey, setGoal, type Settings } from '../logic'
import { allowNotifications, permState, schedule, type Perm } from '../reminder'
import { play } from '../sound'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Icon, Screen, Txt, buzz, center, type IconName } from '../ui'

const MOMENTS: [Key, IconName, number][] = [
  ['setup.morning', 'morning', 8 * 60],
  ['setup.lunch', 'lunch', 12 * 60 + 30],
  ['setup.commute', 'commute', 18 * 60],
  ['setup.evening', 'evening', 21 * 60],
]
const STEPS = ['goal', 'moment', 'yours'] as const
const WHITE = '#FFFFFF'

// A new reminder starts at the moment closest to now: they're using the app right now.
const closest = () => {
  const now = new Date().getHours() * 60
  return MOMENTS.reduce((a, b) => (Math.abs(b[2] - now) < Math.abs(a[2] - now) ? b : a))[2]
}

// Three cards and a finale. Choices apply as they're made, so leaving early keeps them. Reaching the finale
// completes the profile, reminder or not: a reward can't hinge on allowing notifications (App Store 5.1.2(i)).
export default function Setup() {
  const th = useTheme()
  const { data, update } = useStore()
  const { settings: st, goal } = data
  const params = useLocalSearchParams<{ step?: string }>()
  const [i, setI] = useState(params.step === 'moment' ? 1 : 0)
  const [time, setTime] = useState(() => st.reminder ?? closest())
  const [perm, setPerm] = useState<Perm>(null)
  const step = i < STEPS.length ? STEPS[i] : 'done'
  const set = (patch: Partial<Settings>) => update(s => ({ ...s, settings: { ...s.settings, ...patch } }))
  const next = () => setI(i + 1)

  useEffect(() => {
    if (step !== 'done') return AccessibilityInfo.announceForAccessibility(t('onb.step', { n: i + 1, total: STEPS.length }))
    update(s => completeProfile(s, dayKey()))
    play('achievement', st.sounds)
    buzz(st.haptics, 'success')
    AccessibilityInfo.announceForAccessibility(t('swipe.unlocked', { title: t('ach.profile') }))
  }, [i])

  // Android back walks back through the steps; from the first one it closes the sheet.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (i === 0 || step === 'done') return false
      setI(i - 1)
      return true
    })
    return () => sub.remove()
  }, [i])

  // Already allowed? The main button schedules without prompting. Coming back from Settings checks again.
  // Same mapping as allowNotifications, so whichever of the two lands last, the screen agrees.
  useEffect(() => {
    if (step !== 'moment') return
    const check = () => Notifications.getPermissionsAsync().then(p => setPerm(permState(p)), () => {})
    check()
    const sub = AppState.addEventListener('change', s => s === 'active' && check())
    return () => sub.remove()
  }, [step])

  const remind = (m: number) => {
    set({ reminder: m })
    schedule(m, goal)
  }
  const pickTime = (m: number) => {
    setTime(m)
    buzz(st.haptics, 'select')
    if (st.reminder != null) remind(m) // an existing reminder follows the choice
  }
  const allow = async () => {
    const r = await allowNotifications()
    setPerm(r)
    if (r !== 'granted') return
    remind(time)
    buzz(st.haptics, 'success')
    setTimeout(() => setI(k => (k === 1 ? 2 : k)), 700) // a beat to see it land; not if they've moved on
  }

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 }}>
      {i > 0 && step !== 'done' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('onb.back')} onPress={() => setI(i - 1)} style={[styles.round, { backgroundColor: th.raised }]}>
          <Icon n="back" size={18} />
        </Pressable>
      ) : (
        <View style={{ width: 44 }} />
      )}
      <View accessible accessibilityLabel={t('onb.step', { n: Math.min(i + 1, STEPS.length), total: STEPS.length })} style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
        {STEPS.map((_, k) => <View key={k} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: k <= i ? th.coral : th.raised }} />)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => router.back()} style={[styles.round, { backgroundColor: th.raised }]}>
        <Icon n="close" size={18} weight="bold" />
      </Pressable>
    </View>
  )

  if (step === 'done') return (
    <Screen edges={['top', 'bottom']}>
      {header}
      <Finale />
    </Screen>
  )

  const card = (icon: IconName, tint: string, title: Key, body: Key) => (
    <>
      <View style={[styles.hero, { backgroundColor: tint + '26' }]}>
        <Icon n={icon} size={40} color={tint} />
      </View>
      <Txt v="title" accessibilityRole="header" style={center}>{t(title)}</Txt>
      <Txt muted style={center}>{t(body)}</Txt>
    </>
  )
  const reminderOn = st.reminder != null && perm === 'granted'

  return (
    <Screen edges={['top', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 8, gap: 14 }}>
        {step === 'goal' && (
          <>
            {card('goal', th.coral, 'setup.goalQ', 'setup.goalBody')}
            <GoalPicker
              value={goal}
              onPick={n => {
                update(s => setGoal(s, n, dayKey()))
                if (st.reminder != null) schedule(st.reminder, n) // its text names the goal
                buzz(st.haptics, 'select')
              }}
            />
          </>
        )}

        {step === 'moment' && (
          <>
            <Txt v="title" accessibilityRole="header" style={center}>{t('setup.momentQ')}</Txt>
            <Txt muted style={center}>{t('setup.momentBody')}</Txt>
            <LockScreen time={time} goal={goal} motion={st.motion} muted={perm === 'blocked'} onTime={pickTime} />
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {MOMENTS.map(([label, icon, m]) => {
                const on = time === m
                return (
                  <Pressable
                    key={label}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${t(label)}, ${fmtTime(m)}`}
                    onPress={() => pickTime(m)}
                    style={({ pressed }) => [styles.moment, { backgroundColor: th.card, borderColor: on ? th.coral : th.line, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                  >
                    <View style={[styles.dot, { backgroundColor: on ? th.coral : th.raised }]}>
                      <Icon n={icon} size={18} color={on ? th.midnight : th.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontWeight: '700' }} numberOfLines={2}>{t(label)}</Txt>
                      <Txt v="small" muted>{fmtTime(m)}</Txt>
                    </View>
                  </Pressable>
                )
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon n="lock" size={12} color={th.muted} />
              <Txt v="small" muted style={{ flexShrink: 1 }}>{t('setup.trust')}</Txt>
            </View>
          </>
        )}

        {step === 'yours' && (
          <>
            {card('sparkles', th.mint, 'setup.yoursQ', 'setup.yoursBody')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Tile on={st.sounds} icons={['sounds', 'soundsOff']} label="profile.sounds" tint={th.mint} bounce={st.motion} onToggle={v => { set({ sounds: v }); play('keep', v) }} />
              <Tile on={st.haptics} icons={['haptics', 'hapticsOff']} label="profile.haptics" tint={th.lavender} bounce={st.motion} onToggle={v => { set({ haptics: v }); buzz(v, 'success') }} />
              <Tile on={st.motion} icons={['sparkles', 'calm']} label="profile.motion" tint={th.coral} bounce={st.motion} onToggle={v => { set({ motion: v }); buzz(st.haptics, 'select') }} />
              <Tile on={st.shuffle} icons={['shuffle', 'newest']} label="profile.shuffle" tint={th.coral} bounce={st.motion} onToggle={v => { set({ shuffle: v }); buzz(st.haptics, 'select') }} />
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ padding: 24, paddingTop: 8, gap: 4 }}>
        {/* The outcome sits right above the button it explains, never scrolled out of sight. */}
        {step === 'moment' && reminderOn && (
          <View accessible style={[styles.status, { justifyContent: 'center' }]}>
            <Icon n="done" size={18} color={th.mint} />
            <Txt style={{ fontWeight: '700' }}>{t('setup.on', { time: fmtTime(time) })}</Txt>
          </View>
        )}
        {step === 'moment' && perm === 'blocked' && (
          <View accessible style={[styles.status, { padding: 12, borderRadius: 16, backgroundColor: th.raised }]}>
            <View style={[styles.tileIcon, { backgroundColor: th.coral }]}>
              <Icon n="reminderOff" size={17} color={th.midnight} />
            </View>
            <Txt v="small" style={{ flex: 1 }}>{t('setup.off')}</Txt>
          </View>
        )}
        {step === 'moment' && !reminderOn ? (
          <>
            {perm === 'blocked' ? (
              <Button icon="reminder" title={t('common.openSettings')} onPress={() => Linking.openSettings()} />
            ) : (
              <Button icon="reminder" title={t('setup.remindAt', { time: fmtTime(time) })} onPress={allow} />
            )}
            <Pressable accessibilityRole="button" onPress={next} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Txt muted style={{ fontWeight: '600' }}>{t(perm === 'blocked' ? 'onb.next' : 'common.notNow')}</Txt>
            </Pressable>
          </>
        ) : (
          <Button title={t('onb.next')} onPress={next} />
        )}
      </View>
    </Screen>
  )
}

// A little lock screen: the chosen time, big, and the real reminder dropping in each time it changes.
function LockScreen({ time, goal, motion, muted, onTime }: { time: number; goal: number; motion: boolean; muted: boolean; onTime: (m: number) => void }) {
  const drop = useAnimatedValue(1)
  useEffect(() => {
    if (!motion) return
    drop.setValue(0)
    Animated.spring(drop, { toValue: 1, friction: 7, useNativeDriver: true }).start()
  }, [time, motion, drop])
  const nudge = (d: number) => {
    const m = (time + d + 1440) % 1440
    onTime(m)
    AccessibilityInfo.announceForAccessibility(fmtTime(m))
  }
  const glass = 'rgba(255,255,255,0.16)'
  return (
    <View style={styles.lock}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.earlier')} onPress={() => nudge(-30)} style={[styles.round, { backgroundColor: glass }]}>
          <Icon n="minus" size={18} color={WHITE} />
        </Pressable>
        <Txt
          v="big"
          color={WHITE}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ flexShrink: 1, minWidth: 150, textAlign: 'center' }} // shrinks between the buttons at large text
        >
          {fmtTime(time)}
        </Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.later')} onPress={() => nudge(30)} style={[styles.round, { backgroundColor: glass }]}>
          <Icon n="plus" size={18} color={WHITE} />
        </Pressable>
      </View>
      {/* Dimmed on a plain View: a native-driven prop ignores a switch back to a fixed value. */}
      <View style={{ opacity: muted ? 0.45 : 1 }}>
        <Animated.View
          accessible
          accessibilityLabel={`${t('setup.preview')}: SwipeOut. ${t('notif.body', { n: goal })}`}
          style={[styles.banner, {
            backgroundColor: glass,
            opacity: drop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
            transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }, { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
          }]}
        >
          <Image source={require('../../assets/icon.png')} style={{ width: 38, height: 38, borderRadius: 9 }} accessible={false} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: WHITE, fontSize: 15, fontWeight: '700' }}>SwipeOut</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{t('setup.now')}</Text>
            </View>
            <Text numberOfLines={2} style={{ color: WHITE, fontSize: 15, lineHeight: 20 }}>{t('notif.body', { n: goal })}</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

// One setting as a big switch tile; the tap itself is the preview (a sound, a buzz, a bounce).
function Tile({ on, icons, label, tint, bounce, onToggle }: { on: boolean; icons: [IconName, IconName]; label: Key; tint: string; bounce: boolean; onToggle: (v: boolean) => void }) {
  const th = useTheme()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t(label)}
      onPress={() => onToggle(!on)}
      style={({ pressed }) => [styles.tile, { backgroundColor: on ? tint + '26' : th.card, borderColor: on ? tint : th.line, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
    >
      <View style={[styles.state, { backgroundColor: on ? tint : th.raised }]}>
        <Icon n={on ? 'keep' : 'close'} size={11} color={on ? th.midnight : th.muted} weight="bold" />
      </View>
      <View style={[styles.bubble, { backgroundColor: on ? tint : th.raised }]}>
        <Icon key={String(on)} n={icons[on ? 0 : 1]} size={26} color={on ? th.midnight : th.muted} bounce={bounce && on} />
      </View>
      <Txt style={{ fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>{t(label)}</Txt>
    </Pressable>
  )
}

function Finale() {
  const th = useTheme()
  const { data } = useStore()
  const { settings: st, goal } = data
  const pop = useAnimatedValue(st.motion ? 0.4 : 1)
  useEffect(() => {
    if (st.motion) Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start()
  }, [])
  // What they chose, at a glance.
  const summary: [IconName, Key, boolean, string?][] = [
    ['goal', 'profile.goal', true, String(goal)],
    [st.reminder != null ? 'reminder' : 'reminderOff', 'profile.reminder', st.reminder != null, st.reminder != null ? fmtTime(st.reminder) : undefined],
    [st.sounds ? 'sounds' : 'soundsOff', 'profile.sounds', st.sounds],
    [st.haptics ? 'haptics' : 'hapticsOff', 'profile.haptics', st.haptics],
    [st.motion ? 'sparkles' : 'calm', 'profile.motion', st.motion],
    [st.shuffle ? 'shuffle' : 'newest', 'profile.shuffle', st.shuffle],
  ]
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={[styles.badge, { backgroundColor: th.raised, borderColor: th.lavender, boxShadow: `0 10px 30px ${th.lavender}66`, transform: [{ scale: pop }] }]}>
          <Text style={{ fontSize: 64 }}>🎛️</Text>
        </Animated.View>
        <Txt v="small" muted style={{ fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{t('setup.unlocked')}</Txt>
        <Txt v="title" accessibilityRole="header" style={center}>{t('ach.profile')}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: th.lavender, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Icon n="xp" size={13} color={th.midnight} />
          <Txt v="small" color={th.midnight} style={{ fontWeight: '800' }}>+100 XP</Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {summary.map(([icon, label, on, value]) => (
            <View key={label} accessible accessibilityLabel={`${t(label)}: ${value ?? t(on ? 'common.on' : 'common.off')}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: th.raised, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, opacity: on ? 1 : 0.45 }}>
              <Icon n={icon} size={14} color={on ? th.coral : th.muted} />
              {value && <Txt v="small" style={{ fontWeight: '700' }}>{value}</Txt>}
            </View>
          ))}
        </View>
        <Txt muted style={center}>{t('setup.doneBody')}</Txt>
      </ScrollView>
      <View style={{ padding: 24, paddingTop: 8 }}>
        <Button title={t('setup.finish')} onPress={() => router.back()} />
      </View>
      <Confetti run={st.motion} />
    </View>
  )
}

const styles = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hero: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  lock: { gap: 14, padding: 18, borderRadius: 28, overflow: 'hidden', backgroundColor: '#171627', backgroundImage: 'linear-gradient(160deg, rgba(196,167,255,0.35) 0%, rgba(255,107,85,0.22) 50%, rgba(23,22,39,0) 100%)' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 22 },
  moment: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, padding: 12, borderRadius: 20, borderWidth: 2 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tileIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tile: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 10, borderRadius: 24, borderWidth: 2 },
  bubble: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  state: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 120, height: 120, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
})
