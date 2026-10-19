import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { Pressable, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { useTheme } from './theme'

export function Screen({ children, edges = ['top'], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: t.bg }, style]}>{children}</SafeAreaView>
}

const variants = {
  big: { fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
} as const

export function Txt({ v = 'body', muted, color, style, ...rest }: TextProps & { v?: keyof typeof variants; muted?: boolean; color?: string }) {
  const t = useTheme()
  return <Text {...rest} style={[variants[v], { color: color ?? (muted ? t.muted : t.text), fontVariant: ['tabular-nums'] }, style]} />
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return <View style={[{ backgroundColor: t.card, borderRadius: 24, padding: 20, gap: 12 }, style]}>{children}</View>
}

// Pill button. Solid buttons use a brand fill with Midnight text.
export function Button({ title, onPress, color, outline, disabled, style }: {
  title: string
  onPress: () => void
  color?: string
  outline?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: outline ? 'transparent' : color ?? t.coral,
          borderWidth: outline ? 1.5 : 0,
          borderColor: t.line,
          borderRadius: 999,
          paddingVertical: 16,
          paddingHorizontal: 24,
          alignItems: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <Text style={{ color: outline ? t.text : t.midnight, fontSize: 17, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  )
}

export function Bar({ value, color, height = 10 }: { value: number; color?: string; height?: number }) {
  const t = useTheme()
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height, borderRadius: height, backgroundColor: t.raised, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height, backgroundColor: color ?? t.coral }} />
    </View>
  )
}

export function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="title" color={color}>{typeof value === 'number' ? value.toLocaleString() : value}</Txt>
      <Txt v="small" muted>{label}</Txt>
    </View>
  )
}

export function fmtBytes(n: number) {
  if (n < 1e6) return `${Math.round(n / 1e3)} KB`
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`
  return `${(n / 1e9).toFixed(2)} GB`
}

export function buzz(on: boolean, kind: 'tap' | 'heavy' | 'success' = 'tap') {
  if (!on) return
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light)
}
