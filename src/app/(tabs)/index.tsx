import { addListener, type PermissionResponse } from 'expo-media-library'
import { router, useIsFocused } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Linking, Platform, Pressable, Text, View, useAnimatedValue } from 'react-native'
import { Deck, type Choice, type DeckRef } from '../../components/Deck'
import { ACHIEVEMENTS, CHEERS, dayKey, decide, met, setLibrary, stats, streak, undo } from '../../logic'
import { allPhotoIds, getPermission, pickMorePhotos, requestPermission } from '../../media'
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
  const [queue, setQueue] = useState<string[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)
  const [failed, setFailed] = useState(false)
  const decidedOn = useRef<Record<string, string>>({}) // id -> day it was counted on, so undo after midnight fixes the right day
  const latest = useRef(data)
  latest.current = data
  const { haptics, sounds, motion } = data.settings

  const load = async () => {
    setFailed(false)
    try {
      const p = await getPermission()
      setPerm(p)
      setQueue(null)
      if (!p.granted) return
      const ids = await allPhotoIds()
      update(s => setLibrary(s, ids, dayKey()))
      setQueue(ids.filter(id => !latest.current.decisions[id]))
      setIdx(0)
    } catch {
      setFailed(true)
      setQueue([])
    }
  }
  useEffect(() => {
    load()
  }, [])

  const ids = queue?.slice(idx, idx + 3) ?? []
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
      setToast({ emoji: a?.icon, text: a?.title ?? '', say: `Achievement unlocked: ${a?.title}` })
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
    AccessibilityInfo.announceForAccessibility(choice === 'keep' ? 'Kept' : 'Marked for deletion') // focus stays on the deck, so say it
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
    } else if (CHEERS.includes(n)) setToast({ icon: 'sparkles', text: `${n} today`, say: `${n} photos reviewed today` })
  }

  // The undo stack is the queue itself: everything before idx was decided this session.
  const prev = queue?.[idx - 1]
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
                accessibilityLabel={`${s.marked} marked for deletion. Nothing is deleted until you review.`}
                onPress={() => router.push('/review')}
                hitSlop={4}
                style={({ pressed }) => [pill, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Icon n="trash" size={16} color={th.coral} />
                <Txt v="h2">{s.marked.toLocaleString()}</Txt>
              </Pressable>
            </Animated.View>
          )}
          <View accessible accessibilityLabel={`${st}-day streak${data.freezes ? `, ${data.freezes} streak freezes` : ''}`} style={pill}>
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
          <View accessible accessibilityLabel={done ? `Goal complete: ${reviewed} of ${goal} today` : `Today’s goal: ${reviewed} of ${goal} photos`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon n={done ? 'done' : 'goal'} size={20} color={done ? th.mint : th.coral} />
            <View style={{ flex: 1 }}>
              <Bar value={reviewed / goal} color={done ? th.mint : undefined} />
            </View>
            <Txt v="h2">{reviewed}<Txt muted>/{goal}</Txt></Txt>
          </View>
          {perm?.accessPrivileges === 'limited' && (
            <Pressable accessibilityRole="button" onPress={addMore} hitSlop={8} style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon n="add" size={16} color={th.coral} />
              <Txt v="small" style={{ fontWeight: '700' }}>Add more photos</Txt>
            </Pressable>
          )}
        </Card>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {perm && !perm.granted ? (
            <Card style={{ alignItems: 'center' }}>
              {hero('library', th.coral)}
              <Txt v="h2" style={center}>Let’s meet your camera roll</Txt>
              <Txt muted style={center}>SwipeOut shows your photos one at a time so you can keep them or mark them for deletion. They never leave your device.</Txt>
              {perm.canAskAgain ? (
                <Button title="Allow photo access" onPress={async () => { await requestPermission(); load() }} style={{ alignSelf: 'stretch' }} />
              ) : (
                <Button title="Open Settings" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
              )}
            </Card>
          ) : !queue ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={th.coral} />
              <Txt muted>Loading your library…</Txt>
            </View>
          ) : ids.length ? (
            <>
              <Deck ref={deck} ids={ids} onDecide={onDecide} onFling={onFling} onArm={() => buzz(haptics, 'select')} motion={motion} label="Photo" />
              {!s.reviewed && (
                // Sits in the gap Deck leaves under the cards, so nothing moves when it goes.
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  <Icon n="prev" size={12} color={th.muted} />
                  <Txt v="small" muted>Swipe left to mark · right to keep</Txt>
                  <Icon n="next" size={12} color={th.muted} />
                </View>
              )}
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: 12, padding: 16 }}>
              {failed ? hero('error', th.coral) : s.total ? <Txt v="big">🦸</Txt> : hero('library', th.lavender)}
              <Txt v="h2" style={center}>{failed ? 'Couldn’t load your library' : s.total ? 'Camera roll hero — every photo reviewed' : 'No photos here yet'}</Txt>
              {!failed && !s.total && <Txt muted style={center}>Snap a few and come back — we’ll be ready to swipe.</Txt>}
              {!failed && s.marked > 0 && <Button icon="trash" title={`Review ${s.marked} marked`} onPress={() => router.push('/review')} style={{ alignSelf: 'stretch' }} />}
              <Button title={failed ? 'Try again' : 'Check for new photos'} outline onPress={load} style={{ alignSelf: 'stretch' }} />
            </View>
          )}
        </View>

        {queue && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, paddingBottom: 8 }}>
            {round('trash', 'Mark for deletion', () => deck.current?.fling('delete'), th.coral, 68, !ids.length)}
            {round('undo', 'Undo', onUndo, th.raised, 52, !canUndo)}
            {round('keep', 'Keep', () => deck.current?.fling('keep'), th.mint, 68, !ids.length)}
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
