import { addListener, type PermissionResponse } from 'expo-media-library'
import { router, useIsFocused } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Linking, Platform, Pressable, Text, View, useAnimatedValue } from 'react-native'
import { Deck, type Choice, type DeckRef } from '../../components/Deck'
import { achTitle, fmtNum, t } from '../../i18n'
import { ACHIEVEMENTS, CHEERS, arrange, dayKey, decide, met, setLibrary, stats, streak, undo, type Photo } from '../../logic'
import { allPhotos, getPermission, pickMorePhotos, requestPermission } from '../../media'
import { play } from '../../sound'
import { useStore } from '../../store'
import { useTheme } from '../../theme'
import { Bar, Button, buzz, Card, center, Icon, Screen, Txt, type IconName } from '../../ui'

// text is the short pill; say is what screen readers announce.
type Toast = { icon?: IconName; emoji?: string; text: string; say: string }

export default function Swipe() {
  const { data, update } = useStore()
  const th = useTheme()
  const focused = useIsFocused()
  const deck = useRef<DeckRef>(null)
  const [perm, setPerm] = useState<PermissionResponse | null>(null)
  const [photos, setPhotos] = useState<Photo[] | null>(null) // the whole library, from the last sweep
  const [toast, setToast] = useState<Toast | null>(null)
  const [failed, setFailed] = useState(false)
  const decidedOn = useRef<Record<string, string>>({}) // id -> day it was counted on, so undo after midnight fixes the right day
  const latest = useRef(data)
  latest.current = data
  const { haptics, sounds, motion, shuffle } = data.settings

  const load = async () => {
    setFailed(false)
    try {
      const p = await getPermission()
      setPerm(p)
      setPhotos(null)
      if (!p.granted) return
      const all = await allPhotos()
      update(s => setLibrary(s, all.map(p => p.id), dayKey()))
      setPhotos(all)
    } catch {
      setFailed(true)
      setPhotos([])
    }
  }
  useEffect(() => {
    load()
  }, [])

  // A fresh shuffle on every load, and whenever the order changes. A new queue starts at its first
  // card in the same render (no flash of the old one); undo history starts over with it.
  const queue = useMemo(() => photos && arrange(photos, latest.current.decisions, shuffle), [photos, shuffle])
  const [at, setAt] = useState({ queue, idx: 0 })
  const idx = at.queue === queue ? at.idx : 0
  const setIdx = (i: number) => setAt({ queue, idx: i })

  const cards = queue?.slice(idx, idx + 3) ?? []
  const ids = cards.map(p => p.id)
  const stale = (!!queue && !ids.length) || (!!perm && !perm.granted && !perm.canAskAgain) // the system dialog also toggles AppState
  useEffect(() => {
    if (!stale) return
    const sub = AppState.addEventListener('change', st => st === 'active' && load())
    return () => sub.remove()
  }, [stale])

  useEffect(() => {
    if (!toast) return
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(toast.say) // Android reads the live region below
    const id = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(id)
  }, [toast])

  const unlocked = Object.keys(data.unlocked)
  const seen = useRef(unlocked.length)
  useEffect(() => {
    if (!focused) return // celebrate on return instead of dropping it
    if (unlocked.length > seen.current) {
      const a = ACHIEVEMENTS.find(a => a.id === unlocked[unlocked.length - 1])
      const title = a ? achTitle(a.id) : ''
      setToast({ emoji: a?.icon, text: title, say: t('swipe.unlocked', { title }) })
      play('achievement', sounds)
      buzz(haptics, 'success')
    }
    seen.current = unlocked.length
  }, [unlocked.length, focused])

  const s = stats(data)

  // The marked pill bumps each time a photo lands in it.
  const bump = useAnimatedValue(1)
  const marked = useRef(s.marked)
  useEffect(() => {
    if (motion && s.marked > marked.current) {
      bump.setValue(1.25)
      Animated.spring(bump, { toValue: 1, friction: 4, useNativeDriver: true }).start()
    }
    marked.current = s.marked
  }, [s.marked])

  const onFling = (choice: Choice) => {
    play(choice, sounds)
    buzz(haptics, choice === 'keep' ? 'tap' : 'soft')
    AccessibilityInfo.announceForAccessibility(t(choice === 'keep' ? 'swipe.didKeep' : 'swipe.didDelete')) // focus stays on the deck, so say it
  }

  const onDecide = (choice: Choice) => {
    const k = dayKey()
    const day = data.days[k]
    const n = (day?.reviewed ?? 0) + 1
    const willComplete = !day?.done && n >= (day?.goal ?? data.goal)
    decidedOn.current[ids[0]] = k
    update(s => decide(s, ids[0], choice, k))
    setIdx(idx + 1)
    if (willComplete) {
      // The goal screen lists this swipe's unlocks and plays its own sound: one celebration at a time.
      seen.current = Object.keys(decide(data, ids[0], choice, k).unlocked).length
      router.push('/complete')
    } else if (CHEERS.includes(n)) setToast({ icon: 'sparkles', text: t('swipe.cheer', { n }), say: t('swipe.cheerSay', { n }) })
  }

  // The undo stack is the queue itself: everything before idx was decided this session.
  const prev = queue?.[idx - 1]?.id
  const canUndo = !!prev && data.decisions[prev] !== 'deleted'
  const addMore = async () => {
    // iOS resolves on open, so wait for the library change. ponytail: if nothing changes, fires on the next library change.
    const sub = addListener(() => { sub.remove(); load() })
    await pickMorePhotos()
    if (Platform.OS === 'android') { sub.remove(); load() } // Android 14+ resolves on close
  }

  const onUndo = () => {
    update(s => undo(s, prev!, decidedOn.current[prev!] ?? dayKey()))
    setIdx(idx - 1)
    play('undo', sounds)
    buzz(haptics, 'select')
  }

  const k = dayKey()
  const today = data.days[k]
  const goal = today?.goal ?? data.goal
  const reviewed = today?.reviewed ?? 0
  const done = met(today)
  const st = streak(data.days, k)

  const round = (icon: IconName, name: string, onPress: () => void, bg: string, size: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
        boxShadow: bg === th.raised ? undefined : `0 6px 16px ${bg}55`,
      })}
    >
      <Icon n={icon} size={size * 0.42} color={bg === th.raised ? th.text : th.midnight} weight="bold" />
    </Pressable>
  )

  const pill = { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: th.raised, borderRadius: 999, minHeight: 36, paddingVertical: 4, paddingHorizontal: 12 } as const
  const hero = (icon: IconName, color: string) => (
    <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: color + '26', alignItems: 'center', justifyContent: 'center' }}>
      <Icon n={icon} size={48} color={color} />
    </View>
  )

  return (
    <Screen>
      <View style={{ flex: 1, padding: 16, paddingBottom: 4, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="title" accessibilityRole="header" style={{ flex: 1 }}>
            <Txt v="title" color={th.coral}>Swipe</Txt>Out
          </Txt>
          {s.marked > 0 && (
            <Animated.View style={{ transform: [{ scale: bump }] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('swipe.marked', { n: s.marked })}
                onPress={() => router.push('/review')}
                hitSlop={4}
                style={({ pressed }) => [pill, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Icon n="trash" size={16} color={th.coral} />
                <Txt v="h2">{fmtNum(s.marked)}</Txt>
              </Pressable>
            </Animated.View>
          )}
          <View accessible accessibilityLabel={t('swipe.streak', { n: st }) + (data.freezes ? t('swipe.freezes', { n: data.freezes }) : '')} style={pill}>
            <Icon n="streak" size={16} color={th.coral} />
            <Txt v="h2">{st}</Txt>
            {data.freezes > 0 && (
              <>
                <Icon n="freeze" size={14} color={th.lavender} />
                <Txt v="h2">{data.freezes}</Txt>
              </>
            )}
          </View>
        </View>

        <Card style={{ padding: 12, paddingHorizontal: 14, gap: 8, borderRadius: 20 }}>
          <View accessible accessibilityLabel={t(done ? 'swipe.goalDone' : 'swipe.goal', { done: reviewed, goal })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon n={done ? 'done' : 'goal'} size={20} color={done ? th.mint : th.coral} />
            <View style={{ flex: 1 }}>
              <Bar value={reviewed / goal} color={done ? th.mint : undefined} />
            </View>
            <Txt v="h2">{reviewed}<Txt muted>/{goal}</Txt></Txt>
          </View>
          {perm?.accessPrivileges === 'limited' && (
            <Pressable accessibilityRole="button" onPress={addMore} hitSlop={8} style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon n="add" size={16} color={th.coral} />
              <Txt v="small" style={{ fontWeight: '700' }}>{t('swipe.addMore')}</Txt>
            </Pressable>
          )}
        </Card>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {perm && !perm.granted ? (
            <Card style={{ alignItems: 'center' }}>
              {hero('library', th.coral)}
              <Txt v="h2" style={center}>{t('swipe.permTitle')}</Txt>
              <Txt muted style={center}>{t('swipe.permBody')}</Txt>
              {perm.canAskAgain ? (
                <Button title={t('swipe.allow')} onPress={async () => { await requestPermission(); load() }} style={{ alignSelf: 'stretch' }} />
              ) : (
                <Button title={t('common.openSettings')} onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
              )}
            </Card>
          ) : !queue ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={th.coral} />
              <Txt muted>{t('swipe.loading')}</Txt>
            </View>
          ) : ids.length ? (
            <>
              <Deck ref={deck} ids={ids} onDecide={onDecide} onFling={onFling} onArm={() => buzz(haptics, 'select')} motion={motion} label={t('deck.photo')} />
              {!s.reviewed && (
                // Sits in the gap Deck leaves under the cards, so nothing moves when it goes.
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  <Icon n="prev" size={12} color={th.muted} />
                  <Txt v="small" muted>{t('swipe.hint')}</Txt>
                  <Icon n="next" size={12} color={th.muted} />
                </View>
              )}
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: 12, padding: 16 }}>
              {failed ? hero('error', th.coral) : s.total ? <Txt v="big">🦸</Txt> : hero('library', th.lavender)}
              <Txt v="h2" style={center}>{failed ? t('swipe.failed') : s.total ? t('swipe.allDone') : t('swipe.empty')}</Txt>
              {!failed && !s.total && <Txt muted style={center}>{t('swipe.emptyBody')}</Txt>}
              {!failed && s.marked > 0 && <Button icon="trash" title={t('swipe.review', { n: s.marked })} onPress={() => router.push('/review')} style={{ alignSelf: 'stretch' }} />}
              <Button title={failed ? t('swipe.retry') : t('swipe.checkNew')} outline onPress={load} style={{ alignSelf: 'stretch' }} />
            </View>
          )}
        </View>

        {queue && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, paddingBottom: 8 }}>
            {round('trash', t('swipe.delete'), () => deck.current?.fling('delete'), th.coral, 68, !ids.length)}
            {round('undo', t('swipe.undo'), onUndo, th.raised, 52, !canUndo)}
            {round('keep', t('swipe.keep'), () => deck.current?.fling('keep'), th.mint, 68, !ids.length)}
          </View>
        )}

        {toast && (
          <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <View accessible accessibilityLabel={toast.say} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.lavender, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, boxShadow: '0 8px 24px rgba(23,22,39,0.25)' }}>
              {toast.icon ? <Icon n={toast.icon} size={16} color={th.midnight} /> : <Text style={{ fontSize: 16 }}>{toast.emoji}</Text>}
              <Text style={{ color: th.midnight, fontSize: 16, fontWeight: '700' }}>{toast.text}</Text>
            </View>
          </View>
        )}
      </View>
    </Screen>
  )
}
