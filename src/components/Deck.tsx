import { Image } from 'expo-image'
import { useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from 'react'
import { Animated, PanResponder, StyleSheet, Text, useAnimatedValueXY, useWindowDimensions, View, type ViewStyle } from 'react-native'
import { useTheme } from '../theme'

export type Choice = 'keep' | 'delete'
export type DeckRef = { fling: (choice: Choice) => void }

// ids = current card + up to 2 behind it, so the next images are already loaded.
export function Deck({ ids, onDecide, motion, ref }: { ids: string[]; onDecide: (choice: Choice) => void; motion: boolean; ref?: Ref<DeckRef> }) {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const pos = useAnimatedValueXY({ x: 0, y: 0 })
  const busy = useRef(false)
  const top = ids[0]
  const q = width / 4 // stamp and glow are full here, and a release past it commits

  // Stopped by the reset below if the top card changes mid-fling (undo), so it never decides twice.
  const fling = (choice: Choice) => {
    if (busy.current || !top) return
    busy.current = true
    Animated.timing(pos.x, { toValue: (choice === 'keep' ? 1.5 : -1.5) * width, duration: 200, useNativeDriver: false })
      .start(({ finished }) => finished && onDecide(choice))
  }
  const release = ({ dx, vx }: { dx: number; vx: number }) => {
    if (busy.current) return
    if (Math.abs(dx) >= q || Math.abs(vx) > 0.8) fling((Math.abs(vx) > 0.8 ? vx : dx) > 0 ? 'keep' : 'delete')
    else Animated.spring(pos, { toValue: { x: 0, y: 0 }, bounciness: motion ? 8 : 0, useNativeDriver: false }).start()
  }
  const live = useRef(release)
  live.current = release
  useImperativeHandle(ref, () => ({ fling }))

  useLayoutEffect(() => {
    pos.setValue({ x: 0, y: 0 })
    busy.current = false
  }, [top, pos])

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => busy.current || pos.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => live.current(g),
    onPanResponderTerminate: () => live.current({ dx: 0, vx: 0 }),
  }), [pos])

  const keep = pos.x.interpolate({ inputRange: [0, q], outputRange: [0, 1], extrapolate: 'clamp' })
  const del = pos.x.interpolate({ inputRange: [-q, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  const glow = pos.x.interpolate({ inputRange: [-q, 0, q], outputRange: [t.coral, t.card, t.mint], extrapolate: 'clamp' })
  const rotate = pos.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' })
  // 0 at rest, 1 once the top card is a full width away: the cards behind move up as it leaves.
  const near = pos.x.interpolate({ inputRange: [-width, 0, width], outputRange: [1, 0, 1], extrapolate: 'clamp' })
  const stamp = (label: string, bg: string, opacity: Animated.Interpolation<number>, style: ViewStyle) => (
    <Animated.View style={[styles.stamp, { backgroundColor: bg, opacity }, style]}>
      <Text style={{ color: t.midnight, fontSize: 28, fontWeight: '900', letterSpacing: 2 }}>{label}</Text>
    </Animated.View>
  )

  return (
    <View style={{ flex: 1 }}>
      {ids.map((id, i) => {
        const step = Animated.subtract(i, near)
        return (
          <Animated.View
            key={id}
            {...(i ? {} : pan.panHandlers)}
            accessible={!i}
            accessibilityRole="image"
            accessibilityLabel="Photo"
            accessibilityHint="Swipe right to keep, left to mark for deletion"
            accessibilityActions={[{ name: 'keep', label: 'Keep' }, { name: 'delete', label: 'Mark for deletion' }]}
            onAccessibilityAction={e => fling(e.nativeEvent.actionName as Choice)}
            style={[
              styles.card,
              { backgroundColor: t.card, borderColor: i || !motion ? t.card : glow },
              i
                ? { transform: [{ translateY: Animated.multiply(step, 18) }, { scale: step.interpolate({ inputRange: [0, 2], outputRange: [1, 0.9] }) }] }
                : { transform: [...pos.getTranslateTransform(), { rotate }] },
            ]}
          >
            <Image source={{ uri: id }} contentFit="cover" blurRadius={40} style={StyleSheet.absoluteFill} />
            <Image source={{ uri: id }} contentFit="contain" recyclingKey={id} transition={120} style={StyleSheet.absoluteFill} />
            {!i && stamp('KEEP', t.mint, keep, { left: 20, transform: [{ rotate: '-12deg' }] })}
            {!i && stamp('DELETE', t.coral, del, { right: 20, transform: [{ rotate: '12deg' }] })}
          </Animated.View>
        )
      }).reverse()}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 36, borderRadius: 24, borderWidth: 3, overflow: 'hidden' },
  stamp: { position: 'absolute', top: 24, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
})
