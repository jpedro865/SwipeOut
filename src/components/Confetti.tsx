import { useEffect } from 'react'
import { Animated, StyleSheet, View, useAnimatedValue, useWindowDimensions } from 'react-native'
import { useTheme } from '../theme'

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const PIECES = Array.from({ length: 36 }, (_, i) => ({ x: rnd(i, 1), start: rnd(i, 2) * 0.35, fall: 0.6 + rnd(i, 3) * 0.5, spin: (rnd(i, 4) - 0.5) * 1440, drift: (rnd(i, 5) - 0.5) * 80 }))

// One burst of falling confetti over the screen; renders nothing when animations are off.
export function Confetti({ run }: { run: boolean }) {
  const th = useTheme()
  const { width, height } = useWindowDimensions()
  const p = useAnimatedValue(0)
  useEffect(() => {
    if (run) Animated.timing(p, { toValue: 1, duration: 1800, useNativeDriver: true }).start()
  }, [run, p])
  if (!run) return null
  const colors = [th.coral, th.mint, th.lavender, '#FFFFFF']
  return (
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
  )
}
