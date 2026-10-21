import { router } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Confetti } from '../components/Confetti'
import { achTitle, fmtPct, milestone, t } from '../i18n'
import { ACHIEVEMENTS, dayKey, stats, streak } from '../logic'
import { play } from '../sound'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Card, Icon, Stat, Txt, buzz, center } from '../ui'

export default function Complete() {
  const th = useTheme()
  const { data } = useStore()
  const motion = data.settings.motion

  useEffect(() => {
    buzz(data.settings.haptics, 'success')
    play('goal', data.settings.sounds)
  }, [])

  const today = dayKey()
  const s = streak(data.days, today)
  const { marked, pct } = stats(data)
  const fresh = ACHIEVEMENTS.filter(a => data.unlocked[a.id] === today && a.id !== 'profile') // setup celebrates its own
  const chip = { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: th.raised, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 } as const

  return (
    <View accessibilityViewIsModal style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: th.midnight + 'D9' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Card style={{ alignItems: 'center', width: '100%', maxWidth: 420, alignSelf: 'center', gap: 14 }}>
          <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: th.coral + '26', alignItems: 'center', justifyContent: 'center' }}>
            <Icon n="celebrate" size={56} color={th.coral} bounce={motion} />
          </View>
          <Txt v="title" accessibilityRole="header" style={center}>{t('complete.title')}</Txt>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', backgroundColor: th.raised, borderRadius: 16, padding: 14, gap: 8 }}>
            <Stat icon="streak" color={th.coral} value={s} label={t('complete.streak')} />
            <Stat icon="photos" color={th.lavender} value={data.days[today]?.reviewed ?? 0} label={t('complete.today')} />
            <Stat icon="trash" color={th.coral} value={marked} label={t('complete.marked')} />
            <Stat icon="library" color={th.mint} value={fmtPct(pct)} label={t('complete.library')} />
          </View>
          <Txt v="small" muted style={center}>{milestone(s)}</Txt>
          {(data.days[today]?.earned || fresh.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {data.days[today]?.earned && (
                <View style={chip}>
                  <Icon n="freeze" size={14} color={th.lavender} />
                  <Txt v="small" style={{ fontWeight: '700' }}>{t('complete.freeze')}</Txt>
                </View>
              )}
              {fresh.map(a => (
                <View key={a.id} style={chip}>
                  <Txt v="small">{a.icon} {achTitle(a.id)}</Txt>
                </View>
              ))}
            </View>
          )}
          {data.settings.reminder == null && !data.unlocked.profile && (
            // Right after a win is the moment a reminder makes sense: opens the setup on its reminder step.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('setup.nudge')}. ${t('setup.nudgeBody')}`}
              onPress={() => router.replace({ pathname: '/setup', params: { step: 'moment' } })}
              style={({ pressed }) => ({ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: th.raised, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.lavender, alignItems: 'center', justifyContent: 'center' }}>
                <Icon n="reminder" size={18} color={th.midnight} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '700' }}>{t('setup.nudge')}</Txt>
                <Txt v="small" muted>{t('setup.nudgeBody')}</Txt>
              </View>
              <Icon n="next" size={14} color={th.muted} />
            </Pressable>
          )}
          <Button title={t('complete.continue')} onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
          {marked > 0 && <Button icon="trash" title={t('swipe.review', { n: marked })} outline onPress={() => router.replace('/review')} style={{ alignSelf: 'stretch' }} />}
        </Card>
      </ScrollView>
      <Confetti run={motion} />
    </View>
  )
}
