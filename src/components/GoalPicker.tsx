import { Pressable, View } from 'react-native'
import { t, type Key } from '../i18n'
import { GOALS } from '../logic'
import { useTheme } from '../theme'
import { Icon, Txt } from '../ui'

const MINUTES: Record<number, number> = { 25: 2, 50: 4, 100: 7, 200: 14 }

// The daily goal as four radio cards, each with its vibe and how long it takes. Shared by onboarding and setup.
export function GoalPicker({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  const th = useTheme()
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
      {GOALS.map(n => {
        const on = n === value
        const blurb = t(`onb.blurb${n}` as Key)
        const time = t('onb.minutes', { n: MINUTES[n] })
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${t('profile.perDay', { n })}. ${blurb}, ${time}`}
            onPress={() => onPick(n)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 24, backgroundColor: th.card, borderWidth: 2, borderColor: on ? th.coral : th.line }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Txt v="title">{n}</Txt>
                <Txt muted>{t('onb.aDay')}</Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt v="small" muted>{blurb}</Txt>
                <Icon n="time" size={12} color={th.muted} />
                <Txt v="small" muted>{time}</Txt>
              </View>
            </View>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? th.coral : 'transparent', borderWidth: on ? 0 : 2, borderColor: th.line }}>
              {on && <Icon n="keep" size={15} color={th.midnight} weight="bold" />}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
