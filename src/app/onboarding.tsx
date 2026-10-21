import { Image } from 'expo-image'
import { useEffect, useState, type ReactNode } from 'react'
import { Animated, BackHandler, Pressable, ScrollView, View, useAnimatedValue } from 'react-native'
import { GoalPicker } from '../components/GoalPicker'
import { t, type Key } from '../i18n'
import { dayKey, setGoal } from '../logic'
import { requestPermission } from '../media'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Card, Icon, Screen, Txt, center, type IconName } from '../ui'

export default function Onboarding() {
  const th = useTheme()
  const { data, update } = useStore()
  const [step, setStep] = useState(0)
  const [goal, setPick] = useState(data.goal)
  const [busy, setBusy] = useState(false)
  const next = () => setStep(step + 1)

  // The welcome card sways left and right: the gesture, shown without words.
  const sway = useAnimatedValue(0)
  useEffect(() => {
    if (!data.settings.motion) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: -1, duration: 700, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.delay(600),
    ]))
    loop.start()
    return () => loop.stop()
  }, [sway, data.settings.motion])

  // Android back steps back through onboarding; on the first step it falls through and leaves the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false
      setStep(step - 1)
      return true
    })
    return () => sub.remove()
  }, [step])

  // No navigation here: the Stack.Protected guard swaps to the tabs once onboarded flips.
  const finish = async () => {
    setBusy(true)
    await requestPermission().catch(() => {})
    update(s => ({ ...setGoal(s, goal, dayKey()), onboarded: true }))
  }

  const bubble = (icon: IconName, color: string, size = 48) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Icon n={icon} size={size * 0.5} color={th.midnight} />
    </View>
  )

  const pages: [string, () => void, ReactNode][] = [
    [t('onb.start'), next, <>
      <Animated.View style={{ alignSelf: 'center', transform: [{ translateX: sway.interpolate({ inputRange: [-1, 1], outputRange: [-18, 18] }) }, { rotate: sway.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) }] }}>
        <Image source={require('../../assets/splash-icon.png')} style={{ width: 180, height: 180 }} />
      </Animated.View>
      <Txt v="big" style={center}><Txt v="big" color={th.coral}>Swipe</Txt>Out</Txt>
      <Txt v="h2" style={center}>{t('onb.tagline')}</Txt>
      <Txt muted style={center}>{t('onb.intro')}</Txt>
    </>],
    [t('onb.next'), next, <>
      <Txt v="title">{t('onb.how')}</Txt>
      {([['trash', th.coral, 'onb.how1'], ['keep', th.mint, 'onb.how2'], ['safe', th.lavender, 'onb.how3']] as [IconName, string, Key][]).map(([icon, color, text]) => (
        <Card key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {bubble(icon, color)}
          <Txt v="h2" style={{ flex: 1 }}>{t(text)}</Txt>
        </Card>
      ))}
    </>],
    [t('onb.next'), next, <>
      <Txt v="title">{t('onb.pickGoal')}</Txt>
      <GoalPicker value={goal} onPick={setPick} />
      <Txt v="small" muted style={center}>{t('onb.anytime')}</Txt>
    </>],
    [t('swipe.allow'), finish, <>
      <View style={{ alignSelf: 'center', width: 112, height: 112, borderRadius: 56, backgroundColor: th.coral + '26', alignItems: 'center', justifyContent: 'center' }}>
        <Icon n="library" size={52} color={th.coral} />
      </View>
      <Txt v="title" style={center}>{t('onb.accessTitle')}</Txt>
      <Txt muted style={center}>{t('onb.accessBody')}</Txt>
    </>],
  ]
  const [cta, onPress, body] = pages[step]

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ height: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
        {step > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onb.back')}
            onPress={() => setStep(step - 1)}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.raised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon n="back" size={18} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}>{body}</ScrollView>
      <View style={{ padding: 24, paddingTop: 8, gap: 20 }}>
        <View accessible accessibilityLabel={t('onb.step', { n: step + 1, total: pages.length })} style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {pages.map((_, i) => (
            <View key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? th.coral : th.line }} />
          ))}
        </View>
        <Button title={cta} onPress={onPress} disabled={busy} />
      </View>
    </Screen>
  )
}
