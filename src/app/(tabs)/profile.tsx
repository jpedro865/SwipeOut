import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useIsFocused } from 'expo-router'
import { memo, useRef } from 'react'
import { Alert, Linking, Platform, Pressable, ScrollView, Switch, View } from 'react-native'
import { getLocales } from 'expo-localization'
import { achDesc, achTitle, fmtDay, fmtNum, fmtTime, t } from '../../i18n'
import { ACHIEVEMENTS, GOALS, dayKey, setGoal, xp, type Data, type Settings } from '../../logic'
import { channel, schedule } from '../../reminder'
import { play } from '../../sound'
import { useStore } from '../../store'
import { useTheme } from '../../theme'
import { Bar, Card, Icon, Row, Screen, Txt, type IconName } from '../../ui'

// iOS shows a per-app language only once the user has 2+ preferred languages; Android since 13.
const canSwitchLang = Platform.OS === 'ios' ? getLocales().length > 1 : Number(Platform.Version) >= 33

// Visited tabs stay mounted: render from the last focused snapshot so a hidden tab does no work per swipe.
export default function Profile() {
  const { data, update } = useStore()
  const shown = useRef(data)
  if (useIsFocused()) shown.current = data
  return <Body data={shown.current} update={update} />
}

const Body = memo(function Body({ data, update }: { data: Data; update: ReturnType<typeof useStore>['update'] }) {
  const th = useTheme()
  const { level, into, span, points } = xp(data)
  const { reminder, haptics, motion, sounds } = data.settings
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
    await channel()
    const cur = await Notifications.getPermissionsAsync()
    if (!cur.granted && !(cur.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)) {
      return Alert.alert(t('notif.offTitle'), t('notif.offBody'), [
        { text: t('common.notNow'), style: 'cancel' },
        { text: t('common.openSettings'), onPress: () => Linking.openSettings() },
      ])
    }
    set({ reminder: 20 * 60 })
    schedule(20 * 60, data.goal)
  }

  const toggle = (icon: IconName, tile: string, label: string, value: boolean, onValueChange: (v: boolean) => void) => (
    <Row icon={icon} tile={tile} label={label}>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ true: th.coral, false: th.line }} thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined} />
    </Row>
  )
  const link = (icon: IconName, tile: string, label: string, value?: string) => (
    <Row icon={icon} tile={tile} label={label} value={value} onPress={() => Linking.openSettings()}>
      <Icon n="next" size={14} color={th.muted} />
    </Row>
  )

  const stepBtn = (d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(d < 0 ? 'profile.earlier' : 'profile.later')}
      onPress={() => step(d)}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: th.raised }}
    >
      <Icon n={d < 0 ? 'minus' : 'plus'} size={18} />
    </Pressable>
  )
  const rule = (icon: IconName, color: string, n: number) => (
    <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: th.raised, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Icon n={icon} size={13} color={color} />
      <Txt v="small" style={{ fontWeight: '700' }}>+{n}</Txt>
    </View>
  )
  const divider = <View style={{ height: 1, backgroundColor: th.line, marginLeft: 42 }} />

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Txt v="title" accessibilityRole="header">{t('profile.title')}</Txt>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View accessible accessibilityLabel={t('profile.level', { n: level })} style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: th.lavender, alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 18px ${th.lavender}66` }}>
              <Txt v="title" color={th.midnight}>{level}</Txt>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Txt v="h2">{t('profile.level', { n: level })}</Txt>
              <Bar value={into / span} color={th.lavender} />
              <View accessible accessibilityLabel={`${t('profile.points', { n: points })}. ${t('profile.xp', { into, span, n: level + 1 })}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon n="xp" size={14} color={th.lavender} />
                <Txt style={{ fontWeight: '700' }}>{fmtNum(points)}</Txt>
                <Txt v="small" muted>· {fmtNum(into)}/{fmtNum(span)} XP</Txt>
              </View>
            </View>
          </View>
          <View accessible accessibilityLabel={t('profile.rules')} style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {rule('photos', th.lavender, 1)}
            {rule('goal', th.coral, 25)}
            {rule('achievement', th.mint, 100)}
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt v="h2" accessibilityRole="header">{t('profile.achievements')}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon n="achievement" size={15} color={th.lavender} />
              <Txt muted>{Object.keys(data.unlocked).length}/{ACHIEVEMENTS.length}</Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ACHIEVEMENTS.map(a => {
              const day = data.unlocked[a.id]
              return (
                <View
                  key={a.id}
                  accessible
                  accessibilityLabel={day ? t('progress.unlockedOn', { title: achTitle(a.id), date: fmtDay(day) }) : `${t('progress.locked', { title: achTitle(a.id) })}. ${achDesc(a.id)}`}
                  style={{ width: '31%', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: day ? th.raised : 'transparent' }}
                >
                  {!day && (
                    <View style={{ position: 'absolute', top: 8, right: 8 }}>
                      <Icon n="lock" size={11} color={th.muted} />
                    </View>
                  )}
                  <Txt v="title" style={{ opacity: day ? 1 : 0.3 }}>{a.icon}</Txt>
                  <Txt v="small" style={{ fontWeight: '700', textAlign: 'center' }}>{achTitle(a.id)}</Txt>
                  {day ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Icon n="keep" size={10} color={th.mint} />
                      <Txt v="small" muted>{fmtDay(day)}</Txt>
                    </View>
                  ) : (
                    <Txt v="small" muted style={{ textAlign: 'center' }}>{achDesc(a.id)}</Txt>
                  )}
                </View>
              )
            })}
          </View>
        </Card>

        <Card style={{ gap: 6 }}>
          <Txt v="h2" accessibilityRole="header">{t('profile.settings')}</Txt>
          <Row icon="goal" tile={th.coral} label={t('profile.goal')} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            {GOALS.map(n => {
              const on = n === data.goal
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.perDay', { n })}
                  accessibilityState={{ selected: on }}
                  onPress={() => pickGoal(n)}
                  style={{ flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? th.coral : th.raised }}
                >
                  <Txt color={on ? th.midnight : undefined} style={{ fontWeight: '700' }}>{n}</Txt>
                </Pressable>
              )
            })}
          </View>
          {divider}
          {toggle('sounds', th.mint, t('profile.sounds'), sounds, v => {
            set({ sounds: v })
            play('keep', v) // a taste of what you turned on
          })}
          <Txt v="small" muted style={{ marginLeft: 42, marginTop: -8 }}>{t('profile.soundsNote')}</Txt>
          {divider}
          {toggle('haptics', th.lavender, t('profile.haptics'), haptics, v => set({ haptics: v }))}
          {divider}
          {toggle('sparkles', th.coral, t('profile.motion'), motion, v => set({ motion: v }))}
          {divider}
          {toggle('reminder', th.lavender, t('profile.reminder'), reminder != null, toggleReminder)}
          {reminder != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              {stepBtn(-30)}
              <Txt v="h2" accessibilityLabel={t('profile.reminderAt', { time: fmtTime(reminder) })} style={{ minWidth: 100, textAlign: 'center' }}>{fmtTime(reminder)}</Txt>
              {stepBtn(30)}
            </View>
          )}
          {divider}
          {canSwitchLang ? (
            link('language', th.lavender, t('profile.language'), t('profile.languageName'))
          ) : (
            <Row icon="language" tile={th.lavender} label={t('profile.language')} value={t('profile.languageName')} />
          )}
        </Card>

        <Card style={{ gap: 6 }}>
          <Txt v="h2" accessibilityRole="header">{t('profile.privacy')}</Txt>
          <Txt muted>{t('profile.privacyBody')}</Txt>
          {link('privacy', th.mint, t('profile.photoAccess'))}
        </Card>

        <Txt v="small" muted style={{ textAlign: 'center' }}>{t('profile.footer', { v: Constants.expoConfig?.version ?? '' })}</Txt>
      </ScrollView>
    </Screen>
  )
})
