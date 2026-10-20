import { useRef, type ComponentRef } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { fmtNum, t } from '../i18n'
import { useTheme } from '../theme'
import { Icon, Txt, type IconName } from '../ui'

export const yearName = (y: number | null) => (y == null ? t('year.all') : y ? String(y) : t('year.undated'))

// The collapsed picker: which year the deck shows. Coral when one is picked.
export function YearChip({ year, open, onPress }: { year: number | null; open: boolean; onPress: () => void }) {
  const th = useTheme()
  const fg = year == null ? th.text : th.midnight
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('year.choose')}: ${year == null ? t('year.allA11y') : yearName(year)}`}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ minHeight: 32, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: year == null ? th.raised : th.coral, opacity: pressed ? 0.7 : 1 })}
    >
      <Icon n="calendar" size={14} color={fg} />
      <Txt style={{ fontWeight: '700', fontSize: 15 }} color={fg}>{yearName(year)}</Txt>
      <Icon n="expand" size={10} color={fg} weight="bold" />
    </Pressable>
  )
}

// "All" plus every year in the library, newest first, with how many photos are left; finished years get a check.
export function Years({ years, year, onPick }: { years: [number, number][]; year: number | null; onPick: (y: number | null) => void }) {
  const th = useTheme()
  const row = useRef<ComponentRef<typeof ScrollView>>(null)
  const chip = (y: number | null, left: number | null, icon?: IconName) => {
    const on = y === year
    const fg = on ? th.midnight : th.text
    return (
      <Pressable
        key={String(y)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={y == null ? t('year.allA11y') : left ? t('year.left', { y: yearName(y), n: left }) : t('year.sorted', { y: yearName(y) })}
        onPress={() => onPick(y)}
        onLayout={on ? e => row.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 48), animated: false }) : undefined} // open on the picked year
        hitSlop={4}
        style={({ pressed }) => ({ minHeight: 36, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? th.coral : th.card, borderWidth: 1, borderColor: on ? th.coral : th.line, opacity: pressed ? 0.7 : 1 })}
      >
        {icon && <Icon n={icon} size={14} color={fg} />}
        <Txt style={{ fontWeight: '700', fontSize: 15 }} color={fg}>{yearName(y)}</Txt>
        {left === 0 ? <Icon n="keep" size={12} color={on ? th.midnight : th.mint} weight="bold" /> : left != null && <Txt v="small" color={on ? th.midnight : th.muted}>{fmtNum(left)}</Txt>}
      </Pressable>
    )
  }
  return (
    <ScrollView ref={row} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 2 }}>
      {chip(null, null, 'all')}
      {years.map(([y, n]) => chip(y, n))}
    </ScrollView>
  )
}
