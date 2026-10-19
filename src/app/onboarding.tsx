import { Image } from 'expo-image'
import { useEffect, useState, type ReactNode } from 'react'
import { BackHandler, Pressable, ScrollView, View } from 'react-native'
import { GOALS, dayKey, setGoal } from '../logic'
import { requestPermission } from '../media'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Card, Screen, Txt, center } from '../ui'

const BLURBS: Record<number, string> = { 25: 'A quick tidy · ~2 min', 50: 'Steady progress · ~4 min', 100: 'Big push · ~7 min', 200: 'Power cleanup · ~14 min' }

export default function Onboarding() {
  const t = useTheme()
  const { data, update } = useStore()
  const [step, setStep] = useState(0)
  const [goal, setPick] = useState(data.goal)
  const [busy, setBusy] = useState(false)
  const next = () => setStep(step + 1)

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

  const pages: [string, () => void, ReactNode][] = [
    ['Get started', next, <>
      <Image source={require('../../assets/splash-icon.png')} style={{ width: 180, height: 180, alignSelf: 'center' }} />
      <Txt v="big" style={center}><Txt v="big" color={t.coral}>Swipe</Txt>Out</Txt>
      <Txt v="h2" style={center}>Swipe the clutter away.</Txt>
      <Txt muted style={center}>Turn an overwhelming camera roll into a small daily habit — a few swipes a day, and it adds up.</Txt>
    </>],
    ['Next', next, <>
      <Txt v="title">How it works</Txt>
      {[['👈', 'Swipe left to mark a photo for deletion'], ['👉', 'Swipe right to keep it'], ['🛡️', 'Nothing is deleted until you review and confirm']].map(([icon, text]) => (
        <Card key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Txt v="title">{icon}</Txt>
          <Txt v="h2" style={{ flex: 1 }}>{text}</Txt>
        </Card>
      ))}
    </>],
    ['Next', next, <>
      <Txt v="title">Pick a daily goal</Txt>
      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
        {GOALS.map(n => {
          const on = n === goal
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${n} photos a day. ${BLURBS[n]}`}
              onPress={() => setPick(n)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 24, backgroundColor: t.card, borderWidth: 2, borderColor: on ? t.coral : t.line }}
            >
              <View style={{ flex: 1 }}>
                <Txt v="title">{n} <Txt v="body" muted>photos a day</Txt></Txt>
                <Txt v="small" muted>{BLURBS[n]}</Txt>
              </View>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.coral : 'transparent', borderWidth: on ? 0 : 2, borderColor: t.line }}>
                {on && <Txt v="small" color={t.midnight} style={{ fontWeight: '800' }}>✓</Txt>}
              </View>
            </Pressable>
          )
        })}
      </View>
      <Txt v="small" muted style={center}>You can change this anytime.</Txt>
    </>],
    ['Allow photo access', finish, <>
      <Txt v="big" style={center}>📸</Txt>
      <Txt v="title" style={center}>Let SwipeOut see your photos</Txt>
      <Txt muted style={center}>Photos stay on your device. Access is only used to show them to you one at a time and to delete the ones you confirm.</Txt>
    </>],
  ]
  const [cta, onPress, body] = pages[step]

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ height: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
        {step > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(step - 1)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <Txt muted>‹ Back</Txt>
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}>{body}</ScrollView>
      <View style={{ padding: 24, paddingTop: 8, gap: 20 }}>
        <View accessible accessibilityLabel={`Step ${step + 1} of ${pages.length}`} style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {pages.map((_, i) => (
            <View key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? t.coral : t.line }} />
          ))}
        </View>
        <Button title={cta} onPress={onPress} disabled={busy} />
      </View>
    </Screen>
  )
}
