import { addListener, type PermissionResponse } from 'expo-media-library'
import { router, useIsFocused } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Linking, Platform, Pressable, Text, View } from 'react-native'
import { Deck, type Choice, type DeckRef } from '../../components/Deck'
import { ACHIEVEMENTS, CHEERS, dayKey, decide, met, nextBadge, setLibrary, stats, streak, undo } from '../../logic'
import { allPhotoIds, getPermission, pickMorePhotos, requestPermission } from '../../media'
import { useStore } from '../../store'
import { useTheme } from '../../theme'
import { Bar, Button, buzz, Card, Screen, Txt } from '../../ui'

export default function Swipe() {
  const { data, update } = useStore()
  const t = useTheme()
  const focused = useIsFocused()
  const deck = useRef<DeckRef>(null)
  const [perm, setPerm] = useState<PermissionResponse | null>(null)
  const [queue, setQueue] = useState<string[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const latest = useRef(data)
  latest.current = data

  const load = async () => {
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
      setQueue([]) // empty state carries the retry button
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
    const id = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(id)
  }, [toast])

  const unlocked = Object.keys(data.unlocked)
  const seen = useRef(unlocked.length)
  useEffect(() => {
    if (!focused) return // celebrate on return instead of dropping it
    if (unlocked.length > seen.current) {
      setToast(`🏅 Unlocked: ${ACHIEVEMENTS.find(a => a.id === unlocked[unlocked.length - 1])?.title}`)
      buzz(data.settings.haptics, 'heavy')
    }
    seen.current = unlocked.length
  }, [unlocked.length, focused])

  const onDecide = (choice: Choice) => {
    const k = dayKey()
    const day = data.days[k]
    const n = (day?.reviewed ?? 0) + 1
    const willComplete = !day?.done && n >= (day?.goal ?? data.goal)
    update(s => decide(s, ids[0], choice, k))
    buzz(data.settings.haptics, 'tap')
    setIdx(idx + 1)
    if (willComplete) router.push('/complete') // it buzzes on mount
    else if (CHEERS.includes(n)) setToast(`🎉 ${n} photos today!`)
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
    update(s => undo(s, prev!, dayKey()))
    setIdx(idx - 1)
  }

  const s = stats(data)
  const k = dayKey()
  const today = data.days[k]
  const goal = today?.goal ?? data.goal
  const reviewed = today?.reviewed ?? 0
  const st = streak(data.days, k)
  const next = nextBadge(st)

  const round = (glyph: string, label: string, onPress: () => void, bg: string, size: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color: bg === t.raised ? t.text : t.midnight }}>{glyph}</Text>
    </Pressable>
  )

  return (
    <Screen>
      <View style={{ flex: 1, padding: 16, paddingBottom: 4, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="title" accessibilityRole="header">
            <Txt v="title" color={t.coral}>Swipe</Txt>Out
          </Txt>
          <View
            accessible
            accessibilityLabel={`${st}-day streak${data.freezes ? `, ${data.freezes} streak freezes` : ''}`}
            style={{ flexDirection: 'row', gap: 10, backgroundColor: t.raised, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}
          >
            <Txt v="h2">🔥 {st}</Txt>
            {data.freezes > 0 && <Txt v="h2">🧊 {data.freezes}</Txt>}
          </View>
        </View>

        <Card style={{ padding: 14, gap: 8 }}>
          <Txt v="h2">Today's mission: {goal} photos</Txt>
          <Bar value={reviewed / goal} />
          <Txt v="small" style={{ fontWeight: '600' }}>
            {met(today) ? 'Goal complete — bonus round! 🎉' : `${reviewed} / ${goal} reviewed · ${goal - reviewed} to go`}
          </Txt>
          <Txt v="small" muted>
            {s.reviewed.toLocaleString()} of {s.total.toLocaleString()} · {Math.round(s.pct * 100)}%
            {next ? ` · Next: 🔥 ${next} days in ${next - st}` : ''}
          </Txt>
          {perm?.accessPrivileges === 'limited' && (
            <Pressable accessibilityRole="link" onPress={addMore} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt v="small" style={{ fontWeight: '700', textDecorationLine: 'underline' }}>Add more photos ›</Txt>
            </Pressable>
          )}
        </Card>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {perm && !perm.granted ? (
            <Card>
              <Txt v="big">📸</Txt>
              <Txt v="h2">Let's meet your camera roll</Txt>
              <Txt muted>SwipeOut shows your photos one at a time so you can keep them or mark them for deletion. They never leave your device.</Txt>
              {perm.canAskAgain ? (
                <Button title="Allow photo access" onPress={async () => { await requestPermission(); load() }} />
              ) : (
                <Button title="Open Settings" onPress={() => Linking.openSettings()} />
              )}
            </Card>
          ) : !queue ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={t.coral} />
              <Txt muted>Loading your library…</Txt>
            </View>
          ) : ids.length ? (
            <Deck ref={deck} ids={ids} onDecide={onDecide} motion={data.settings.motion} />
          ) : (
            <View style={{ alignItems: 'center', gap: 12, padding: 16 }}>
              <Txt v="big">{s.total ? '🦸' : '📭'}</Txt>
              <Txt v="h2" style={{ textAlign: 'center' }}>{s.total ? 'Camera roll hero — every photo reviewed' : 'No photos here yet'}</Txt>
              {!s.total && <Txt muted style={{ textAlign: 'center' }}>Snap a few and come back — we'll be ready to swipe.</Txt>}
              {s.marked > 0 && <Button title={`Review ${s.marked} marked`} onPress={() => router.push('/review')} style={{ alignSelf: 'stretch' }} />}
              <Button title="Check for new photos" outline onPress={load} style={{ alignSelf: 'stretch' }} />
            </View>
          )}
        </View>

        {queue && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
              {round('✕', 'Mark for deletion', () => deck.current?.fling('delete'), t.coral, 68, !ids.length)}
              {round('↶', 'Undo', onUndo, t.raised, 52, !canUndo)}
              {round('✓', 'Keep', () => deck.current?.fling('keep'), t.mint, 68, !ids.length)}
            </View>
            <Pressable
              disabled={!s.marked}
              accessibilityRole={s.marked ? 'button' : 'text'}
              accessibilityHint={s.marked ? 'Opens review' : undefined}
              onPress={() => router.push('/review')}
              style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Txt v="small" muted={!s.marked} style={{ fontWeight: s.marked ? '600' : '400' }}>
                {s.marked ? `🛡️ ${s.marked} marked · nothing is deleted until you review ›` : 'Swipe left to mark · right to keep'}
              </Txt>
            </Pressable>
          </>
        )}

        {toast && (
          <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: t.lavender, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}>
              <Text style={{ color: t.midnight, fontSize: 16, fontWeight: '700' }}>{toast}</Text>
            </View>
          </View>
        )}
      </View>
    </Screen>
  )
}
