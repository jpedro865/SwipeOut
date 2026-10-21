import * as Haptics from 'expo-haptics'
import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolWeight } from 'expo-symbols'
import { useEffect, useState, type ReactNode } from 'react'
import { Platform, Pressable, Text, View, useWindowDimensions, type StyleProp, type TextProps, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { fmtNum } from './i18n'
import { useTheme } from './theme'

export function Screen({ children, edges = ['top'] }: { children: ReactNode; edges?: Edge[] }) {
  const t = useTheme()
  return <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>{children}</SafeAreaView>
}

// One meaning per icon, everywhere: [SF Symbol (iOS 16.4+), Material Symbol (Android)].
const ICONS = {
  keep: ['checkmark', 'check'],
  trash: ['trash.fill', 'delete'],
  deleted: ['xmark.bin.fill', 'delete_forever'],
  undo: ['arrow.uturn.backward', 'undo'],
  close: ['xmark', 'close'],
  streak: ['flame.fill', 'local_fire_department'],
  freeze: ['snowflake', 'ac_unit'],
  goal: ['target', 'target'],
  done: ['checkmark.seal.fill', 'verified'],
  photos: ['rectangle.stack.fill', 'style'],
  library: ['photo.on.rectangle.angled', 'photo_library'],
  add: ['plus.circle.fill', 'add_photo_alternate'],
  calendar: ['calendar', 'calendar_month'],
  all: ['infinity', 'all_inclusive'],
  expand: ['chevron.down', 'expand_more'],
  prev: ['chevron.left', 'chevron_left'],
  next: ['chevron.right', 'chevron_right'],
  back: ['chevron.left', 'arrow_back'],
  storage: ['internaldrive', 'hard_drive'],
  favorite: ['heart.fill', 'favorite'],
  spring: ['camera.macro', 'local_florist'],
  summer: ['sun.max.fill', 'sunny'],
  autumn: ['leaf.fill', 'eco'],
  winter: ['cloud.snow.fill', 'weather_snowy'],
  celebrate: ['party.popper.fill', 'celebration'],
  sparkles: ['sparkles', 'auto_awesome'],
  achievement: ['rosette', 'military_tech'],
  xp: ['star.fill', 'star'],
  trophy: ['trophy.fill', 'trophy'],
  shuffle: ['shuffle', 'shuffle'],
  sounds: ['speaker.wave.2.fill', 'volume_up'],
  haptics: ['iphone.radiowaves.left.and.right', 'vibration'],
  reminder: ['bell.fill', 'notifications'],
  minus: ['minus', 'remove'],
  plus: ['plus', 'add'],
  language: ['globe', 'language'],
  privacy: ['hand.raised.fill', 'privacy_tip'],
  safe: ['checkmark.shield.fill', 'verified_user'],
  error: ['exclamationmark.triangle.fill', 'warning'],
  time: ['clock', 'schedule'],
  tap: ['hand.tap.fill', 'touch_app'],
  lock: ['lock.fill', 'lock'],
  profile: ['person.crop.circle.badge.checkmark', 'how_to_reg'],
  reminderOff: ['bell.slash.fill', 'notifications_off'],
  morning: ['sunrise.fill', 'wb_twilight'],
  lunch: ['fork.knife', 'restaurant'],
  commute: ['tram.fill', 'tram'],
  evening: ['moon.stars.fill', 'bedtime'],
  soundsOff: ['speaker.slash.fill', 'volume_off'],
  hapticsOff: ['iphone.slash', 'mobile_off'],
  calm: ['pause.circle.fill', 'pause_circle'],
  newest: ['arrow.down.circle.fill', 'arrow_downward'],
} satisfies Record<string, [SFSymbol, AndroidSymbol]>
export type IconName = keyof typeof ICONS

// Decorative: the control around it carries the accessibility label. Android takes no weight (each is a ~1 MB font).
// Android draws the glyph as scalable text in a fixed box, so cancel the system font scale to keep it inside.
export function Icon({ n, size = 20, color, weight = 'semibold', bounce }: { n: IconName; size?: number; color?: string; weight?: SymbolWeight; bounce?: boolean }) {
  const t = useTheme()
  const { fontScale } = useWindowDimensions()
  const [ios, android] = ICONS[n]
  const box = Platform.OS === 'android' ? { size: size / fontScale, style: { width: size, height: size } } : { size }
  return (
    <SymbolView
      name={{ ios, android }}
      {...box}
      tintColor={color ?? t.text}
      weight={weight}
      animationSpec={bounce ? { effect: { type: 'bounce' } } : undefined}
      accessible={false}
      importantForAccessibility="no"
    />
  )
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
  return <View style={[{ backgroundColor: t.card, backgroundImage: t.wash, borderRadius: 24, padding: 20, gap: 12 }, style]}>{children}</View>
}

// Pill button. Solid buttons use a brand fill with Midnight text.
export function Button({ title, icon, onPress, outline, disabled, style }: {
  title: string
  icon?: IconName
  onPress: () => void
  outline?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const fg = outline ? t.text : t.midnight
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: outline ? 'transparent' : t.coral,
          borderWidth: outline ? 1.5 : 0,
          borderColor: t.line,
          borderRadius: 999,
          paddingVertical: 16,
          paddingHorizontal: 24,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {icon && <Icon n={icon} size={18} color={fg} />}
      <Text style={{ color: fg, fontSize: 17, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  )
}

export function Bar({ value, color }: { value: number; color?: string }) {
  const t = useTheme()
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 10, borderRadius: 5, backgroundColor: t.raised, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: color ?? t.coral }} />
    </View>
  )
}

export function Stat({ value, label, icon, color }: { value: string | number; label: string; icon?: IconName; color?: string }) {
  return (
    <View accessible accessibilityLabel={`${value}, ${label}`} style={{ flex: 1, gap: 2 }}>
      {icon && <Icon n={icon} size={18} color={color} />}
      <Txt v="title" numberOfLines={1} adjustsFontSizeToFit>{typeof value === 'number' ? fmtNum(value) : value}</Txt>
      <Txt v="small" muted numberOfLines={2}>{label}</Txt>
    </View>
  )
}

// iOS Settings-style row: brand tile with a glyph, a label, an optional value and a control on the right.
export function Row({ icon, tile, label, value, children, onPress }: { icon: IconName; tile: string; label: string; value?: string; children?: ReactNode; onPress?: () => void }) {
  const t = useTheme()
  const body = (
    <>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' }}>
        <Icon n={icon} size={17} color={t.midnight} />
      </View>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      {value && <Txt muted>{value}</Txt>}
      {children}
    </>
  )
  const style = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 } as const
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}>{body}</Pressable>
  ) : (
    <View style={style}>{body}</View>
  )
}

export const center = { textAlign: 'center' } as const

// Visited tabs stay mounted. A hidden one catches up once swiping pauses: no work per swipe, yet it's
// current when the native tab bar switches to it (that happens before JS hears about the focus change).
export function useSettled<T>(value: T, live: boolean, ms = 600) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), live ? 0 : ms)
    return () => clearTimeout(id)
  }, [value, live, ms])
  return live ? value : settled
}

// Each kind matches a sound: keep = crisp, delete = damped (never Heavy or Reject, which read as an error), select = undo/toggles.
// Android's Vibrator makes every impact feel the same, so use its haptic engine there (Confirm needs API 30).
const ANDROID = { tap: Haptics.AndroidHaptics.Confirm, soft: Haptics.AndroidHaptics.Virtual_Key, select: Haptics.AndroidHaptics.Clock_Tick }
export function buzz(on: boolean, kind: 'tap' | 'soft' | 'select' | 'success' = 'tap') {
  if (!on) return
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  else if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(ANDROID[kind]).catch(() => Haptics.selectionAsync())
  else if (kind === 'select') Haptics.selectionAsync()
  else Haptics.impactAsync(kind === 'soft' ? Haptics.ImpactFeedbackStyle.Soft : Haptics.ImpactFeedbackStyle.Light)
}
