import { Image } from 'expo-image'
import { useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from 'react'
import { Animated, PanResponder, StyleSheet, useAnimatedValueXY, useWindowDimensions, View, type ViewStyle } from 'react-native'
import { useTheme } from '../theme'
import { Icon } from '../ui'

export type Choice = 'keep' | 'delete'
export type DeckRef = { fling: (choice: Choice) => void }

// ids = current card + up to 2 behind it, so the next images are already loaded.
// onFling fires the moment a swipe commits (sound, haptic); onDecide once the card has left.
// onArm fires when a drag crosses the commit line, either way.
export function Deck({ ids, onDecide, onFling, onArm, motion, label, ref }: {
  ids: string[]
  onDecide: (choice: Choice) => void
  onFling: (choice: Choice) => void
  onArm: () => void
  motion: boolean
  label: string
  ref?: Ref<DeckRef>
}) {
  const th = useTheme()
  const { width } = useWindowDimensions()
  const pos = useAnimatedValueXY({ x: 0, y: 0 })
  const busy = useRef(false)
  const armed = useRef(0)
  const top = ids[0]
  const q = width / 4 // stamp and glow are full here, and a release past it commits

  // Stopped by the reset below if the top card changes mid-fling (undo), so it never decides twice.
  const fling = (choice: Choice) => {
    if (busy.current || !top) return
    busy.current = true
    onFling(choice)
    Animated.timing(pos.x, { toValue: (choice === 'keep' ? 1.5 : -1.5) * width, duration: 200, useNativeDriver: false })
      .start(({ finished }) => finished && onDecide(choice))
  }
  const release = ({ dx, vx }: { dx: number; vx: number }) => {
    armed.current = 0
    if (busy.current) return
    if (Math.abs(dx) >= q || Math.abs(vx) > 0.8) fling((Math.abs(vx) > 0.8 ? vx : dx) > 0 ? 'keep' : 'delete')
    else Animated.spring(pos, { toValue: { x: 0, y: 0 }, bounciness: motion ? 8 : 0, useNativeDriver: false }).start()
  }
  const move = (dx: number) => {
    const side = Math.abs(dx) >= q ? Math.sign(dx) : 0
    if (side && side !== armed.current) onArm()
    armed.current = side
  }
  const live = useRef({ release, move })
  live.current = { release, move }
  useImperativeHandle(ref, () => ({ fling }))

  useLayoutEffect(() => {
    pos.setValue({ x: 0, y: 0 })
    busy.current = false
  }, [top, pos])

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      if (busy.current) return
      pos.setValue({ x: g.dx, y: g.dy })
      live.current.move(g.dx)
    },
    // g.dx stops at the last move JS saw; measure to where the finger lifted.
    onPanResponderRelease: (e, g) => live.current.release({ dx: e.nativeEvent.pageX - g.x0, vx: g.vx }),
    onPanResponderTerminate: () => live.current.release({ dx: 0, vx: 0 }),
  }), [pos])

  const keep = pos.x.interpolate({ inputRange: [0, q], outputRange: [0, 1], extrapolate: 'clamp' })
  const del = pos.x.interpolate({ inputRange: [-q, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  const glow = pos.x.interpolate({ inputRange: [-q, 0, q], outputRange: [th.coral, th.card, th.mint], extrapolate: 'clamp' })
  const rotate = pos.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' })
  // 0 at rest, 1 once the top card is a full width away: the cards behind move up as it leaves.
  const near = pos.x.interpolate({ inputRange: [-width, 0, width], outputRange: [1, 0, 1], extrapolate: 'clamp' })
  const stamp = (choice: Choice, opacity: Animated.AnimatedInterpolation<number>, style: ViewStyle) => (
    <Animated.View
      style={[
        styles.stamp,
        { backgroundColor: choice === 'keep' ? th.mint : th.coral, opacity, transform: [{ rotate: choice === 'keep' ? '-12deg' : '12deg' }, { scale: opacity.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
        style,
      ]}
    >
      <Icon n={choice === 'keep' ? 'keep' : 'trash'} size={40} color={th.midnight} weight="bold" />
    </Animated.View>
  )

  // One stable accessible element: VoiceOver keeps its focus here while the cards underneath change.
  return (
    <View
      style={{ flex: 1 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityHint="Swipe right to keep, left to mark for deletion"
      accessibilityActions={[{ name: 'keep', label: 'Keep' }, { name: 'delete', label: 'Mark for deletion' }]}
      onAccessibilityAction={e => fling(e.nativeEvent.actionName as Choice)}
    >
      {ids.map((id, i) => {
        const step = Animated.subtract(i, near)
        return (
          <Animated.View
            key={id}
            {...(i ? {} : pan.panHandlers)}
            style={[
              styles.card,
              { backgroundColor: th.card, borderColor: i || !motion ? th.card : glow },
              i
                ? { transform: [{ translateY: Animated.multiply(step, 18) }, { scale: step.interpolate({ inputRange: [0, 2], outputRange: [1, 0.9] }) }] }
                : { transform: [...pos.getTranslateTransform(), { rotate }] },
            ]}
          >
            <Image source={{ uri: id }} contentFit="cover" blurRadius={40} style={StyleSheet.absoluteFill} />
            <Image source={{ uri: id }} contentFit="contain" recyclingKey={id} transition={120} style={StyleSheet.absoluteFill} />
            {!i && stamp('keep', keep, { left: 20 })}
            {!i && stamp('delete', del, { right: 20 })}
          </Animated.View>
        )
      }).reverse()}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 36, borderRadius: 28, borderWidth: 3, overflow: 'hidden' },
  stamp: { position: 'absolute', top: 24, width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
})
