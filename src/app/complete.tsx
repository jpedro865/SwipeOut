import { router } from 'expo-router'
import { useEffect } from 'react'
import { Animated, ScrollView, StyleSheet, View, useAnimatedValue, useWindowDimensions } from 'react-native'
import { ACHIEVEMENTS, dayKey, milestone, stats, streak } from '../logic'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Card, Stat, Txt, buzz, center } from '../ui'

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const PIECES = Array.from({ length: 36 }, (_, i) => ({ x: rnd(i, 1), start: rnd(i, 2) * 0.35, fall: 0.6 + rnd(i, 3) * 0.5, spin: (rnd(i, 4) - 0.5) * 1440, drift: (rnd(i, 5) - 0.5) * 80 }))

export default function Complete() {
  const t = useTheme()
  const { data } = useStore()
  const { width, height } = useWindowDimensions()
  const p = useAnimatedValue(0)
  const motion = data.settings.motion

  useEffect(() => {
    buzz(data.settings.haptics, 'success')
    if (motion) Animated.timing(p, { toValue: 1, duration: 1800, useNativeDriver: true }).start()
  }, [])

  const today = dayKey()
  const s = streak(data.days, today)
  const { marked, pct } = stats(data)
  const fresh = ACHIEVEMENTS.filter(a => data.unlocked[a.id] === today)
  const colors = [t.coral, t.mint, t.lavender, '#FFFFFF']

  return (
    <View accessibilityViewIsModal style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: t.midnight + 'D9' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Card style={{ alignItems: 'center', width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <Txt v="big">🎉</Txt>
          <Txt v="title" accessibilityRole="header" style={center}>Goal complete!</Txt>
          <Txt style={center}>You reviewed {data.days[today]?.reviewed ?? 0} photos today.</Txt>
          <Txt v="h2">🔥 {s}-day streak</Txt>
          {data.days[today]?.earned && <Txt style={center}>🧊 You earned a streak freeze!</Txt>}
          <Txt v="small" muted style={center}>
            {milestone(s)}
          </Txt>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', backgroundColor: t.raised, borderRadius: 16, padding: 14 }}>
            <Stat value={data.days[today]?.reviewed ?? 0} label="Today" />
            <Stat value={marked} label="Marked" />
            <Stat value={`${Math.round(pct * 100)}%`} label="Library" />
          </View>
          {fresh.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {fresh.map(a => (
                <View key={a.id} style={{ backgroundColor: t.raised, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                  <Txt v="small">{a.icon} {a.title}</Txt>
                </View>
              ))}
            </View>
          )}
          <Button title="Keep swiping" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
          {marked > 0 && <Button title={`Review ${marked} marked`} outline onPress={() => router.replace('/review')} style={{ alignSelf: 'stretch' }} />}
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
