import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { fullDate, when } from '../i18n'
import type { Photo } from '../logic'
import { useTheme } from '../theme'
import { Icon } from '../ui'

const glass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable() // some iOS 26 betas crash without the second check
const TINT = { spring: '#FFA8D2', summer: '#FFD166', autumn: '#FFA66B', winter: '#A9DCFF' } as const

// "☀ Summer 2024" (or "12 Oct" when recent) over the photo; tap for the exact date. A heart marks favorites.
export function DatePill({ photo }: { photo: Photo }) {
  const th = useTheme()
  const [full, setFull] = useState(false)
  useEffect(() => {
    if (!full) return
    const id = setTimeout(() => setFull(false), 2500)
    return () => clearTimeout(id)
  }, [full])
  const w = when(photo.time)
  if (!w && !photo.fav) return null
  const style = { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, overflow: 'hidden' } as const
  const body = (
    <>
      {w && <Icon n={w.season ?? 'calendar'} size={14} color={w.season ? TINT[w.season] : '#FFFFFF'} />}
      {w && <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{full ? fullDate(photo.time) : w.text}</Text>}
      {photo.fav && <Icon n="favorite" size={13} color={th.coral} />}
    </>
  )
  return (
    <Pressable onPress={() => setFull(!full)} disabled={!w} hitSlop={8} accessible={false} style={{ position: 'absolute', left: 12, bottom: 12, maxWidth: '85%' }}>
      {glass ? (
        <GlassView glassEffectStyle="regular" colorScheme="dark" style={style}>{body}</GlassView>
      ) : (
        <View style={[style, { backgroundColor: 'rgba(23,22,39,0.62)' }]}>{body}</View>
      )}
    </Pressable>
  )
}
