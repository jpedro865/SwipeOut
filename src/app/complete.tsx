import { router } from 'expo-router'
import { useEffect } from 'react'
import { Animated, ScrollView, StyleSheet, View, useAnimatedValue, useWindowDimensions } from 'react-native'
import { achTitle, fmtPct, milestone, t } from '../i18n'
import { ACHIEVEMENTS, dayKey, stats, streak } from '../logic'
import { play } from '../sound'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Card, Icon, Stat, Txt, buzz, center } from '../ui'

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const PIECES = Array.from({ length: 36 }, (_, i) => ({ x: rnd(i, 1), start: rnd(i, 2) * 0.35, fall: 0.6 + rnd(i, 3) * 0.5, spin: (rnd(i, 4) - 0.5) * 1440, drift: (rnd(i, 5) - 0.5) * 80 }))

export default function Complete() {
  const th = useTheme()
  const { data } = useStore()
  const { width, height } = useWindowDimensions()
  const p = useAnimatedValue(0)
  const motion = data.settings.motion

  useEffect(() => {
    buzz(data.settings.haptics, 'success')
    play('goal', data.settings.sounds)
    if (motion) Animated.timing(p, { toValue: 1, duration: 1800, useNativeDriver: true }).start()
  }, [])

  const today = dayKey()
  const s = streak(data.days, today)
  const { marked, pct } = stats(data)
  const fresh = ACHIEVEMENTS.filter(a => data.unlocked[a.id] === today)
  const colors = [th.coral, th.mint, th.lavender, '#FFFFFF']
  const chip = { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: th.raised, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 } as const

  return (
    <View accessibilityViewIsModal style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: th.midnight + 'D9' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Card style={{ alignItems: 'center', width: '100%', maxWidth: 420, alignSelf: 'center', gap: 14 }}>
          <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: th.coral + '26', alignItems: 'center', justifyContent: 'center' }}>
            <Icon n="celebrate" size={56} color={th.coral} bounce={motion} />
          </View>
          <Txt v="title" accessibilityRole="header" style={center}>{t('complete.title')}</Txt>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', backgroundColor: th.raised, borderRadius: 16, padding: 14, gap: 8 }}>
            <Stat icon="streak" color={th.coral} value={s} label={t('complete.streak')} />
            <Stat icon="photos" color={th.lavender} value={data.days[today]?.reviewed ?? 0} label={t('complete.today')} />
            <Stat icon="trash" color={th.coral} value={marked} label={t('complete.marked')} />
            <Stat icon="library" color={th.mint} value={fmtPct(pct)} label={t('complete.library')} />
          </View>
          <Txt v="small" muted style={center}>{milestone(s)}</Txt>
          {(data.days[today]?.earned || fresh.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {data.days[today]?.earned && (
                <View style={chip}>
                  <Icon n="freeze" size={14} color={th.lavender} />
                  <Txt v="small" style={{ fontWeight: '700' }}>{t('complete.freeze')}</Txt>
                </View>
              )}
              {fresh.map(a => (
                <View key={a.id} style={chip}>
                  <Txt v="small">{a.icon} {achTitle(a.id)}</Txt>
                </View>
              ))}
            </View>
          )}
          <Button title={t('complete.continue')} onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
          {marked > 0 && <Button icon="trash" title={t('swipe.review', { n: marked })} outline onPress={() => router.replace('/review')} style={{ alignSelf: 'stretch' }} />}
        </Card>
      </ScrollView>
      {motion && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {PIECES.map((c, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                top: -20,
                left: c.x * width,
                width: 8,
                height: 14,
                borderRadius: 2,
                backgroundColor: colors[i % 4],
                opacity: p.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateY: p.interpolate({ inputRange: [c.start, 1], outputRange: [0, height * c.fall + 20], extrapolate: 'clamp' }) },
                  { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, c.drift] }) },
                  { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] }) },
                ],
              }}
            />
          ))}
        </View>
      )}
    </View>
  )
}
