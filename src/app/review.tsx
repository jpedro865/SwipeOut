import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, FlatList, Modal, Platform, Pressable, View } from 'react-native'
import { dayKey, markDeleted, setDecision } from '../logic'
import { deletePhotos, sizeOf } from '../media'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Screen, Txt, buzz, fmtBytes } from '../ui'

const photos = (n: number) => `${n} photo${n === 1 ? '' : 's'}`
const sum = (ids: string[], sizes: Record<string, number>) => ids.reduce((a, id) => a + (sizes[id] ?? 0), 0)
const center = { textAlign: 'center' } as const

export default function Review() {
  const t = useTheme()
  const { data, update } = useStore()
  const [ids] = useState(() => Object.keys(data.decisions).filter(id => data.decisions[id] === 'delete'))
  const known = useRef<Record<string, number>>({})
  const [sizes, setSizes] = useState<Record<string, number> | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState<{ n: number; bytes: number } | null>(null)

  useEffect(() => {
    let live = true
    const queue = [...ids]
    const map: Record<string, number> = (known.current = {})
    const work = async (): Promise<void> => {
      const id = queue.pop()
      if (!live || !id) return
      map[id] = await sizeOf(id)
      return work()
    }
    Promise.all([work(), work(), work(), work()]).then(() => live && setSizes(map))
    return () => {
      live = false
    }
  }, [ids])

  const marked = ids.filter(id => data.decisions[id] === 'delete')
  const n = marked.length
  const bytes = sizes && sum(marked, sizes)

  const toggle = (id: string) => {
    buzz(data.settings.haptics, 'tap')
    update(s => setDecision(s, id, s.decisions[id] === 'delete' ? 'keep' : 'delete'))
  }

  const remove = async () => {
    const del = marked
    setBusy(true)
    setFailed(false)
    try {
      await deletePhotos(del)
    } catch {
      setBusy(false)
      setFailed(true)
      return
    }
    const freed = sum(del, known.current)
    update(s => markDeleted(s, del, freed, dayKey()))
    buzz(data.settings.haptics, 'success')
    setDone({ n: del.length, bytes: freed })
    setBusy(false)
  }

  const confirm = () =>
    Alert.alert(
      `Delete ${photos(n)}?`,
      Platform.OS === 'ios' ? "They'll move to Recently Deleted in Photos, where you can recover them for 30 days." : 'This permanently removes them from your device.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: remove }],
    )

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ padding: 20, paddingBottom: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="title" accessibilityRole="header">Review & delete</Txt>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.raised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt v="h2">✕</Txt>
          </Pressable>
        </View>
        {!done && ids.length > 0 && <Txt muted>Tap a photo to keep it. Nothing is deleted until you confirm.</Txt>}
      </View>

      {done || !ids.length ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 }}>
          {done ? (
            <>
              <Txt v="title" style={center}>🎉 {photos(done.n)} cleared</Txt>
              {done.bytes > 0 && <Txt muted style={center}>≈ {fmtBytes(done.bytes)} freed</Txt>}
            </>
          ) : (
            <Txt style={center}>Nothing marked yet. Swipe left on photos you don't need.</Txt>
          )}
          <Button title="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      ) : (
        <>
          <FlatList
            data={ids}
            keyExtractor={id => id}
            numColumns={3}
            extraData={data.decisions}
            contentContainerStyle={{ paddingHorizontal: 18 }}
            renderItem={({ item }) => {
              const kept = data.decisions[item] !== 'delete'
              return (
                <Pressable
                  onPress={() => toggle(item)}
                  onLongPress={() => setPreview(item)}
                  accessibilityRole="button"
                  accessibilityLabel={kept ? 'Photo, kept' : 'Photo, marked for deletion'}
                  accessibilityHint="Tap to toggle. Long-press to preview."
                  style={{ width: '33.333%', aspectRatio: 1, padding: 2 }}
                >
                  <Image source={{ uri: item }} contentFit="cover" recyclingKey={item} style={{ flex: 1, borderRadius: 12, opacity: kept ? 0.35 : 1 }} />
                  {kept && (
                    <View style={{ position: 'absolute', left: 8, bottom: 8, backgroundColor: t.mint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Txt v="small" color={t.midnight} style={{ fontWeight: '700' }}>✓ Kept</Txt>
                    </View>
                  )}
                </Pressable>
              )
            }}
          />
          <View style={{ padding: 20, paddingBottom: 12, gap: 10, borderTopWidth: 1, borderColor: t.line }}>
            {failed && <Txt style={center}>Nothing was deleted.</Txt>}
            {sizes ? !!bytes && <Txt muted style={center}>≈ {fmtBytes(bytes)} to free</Txt> : <Txt muted style={center}>Estimating size…</Txt>}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Keep all" outline disabled={busy} onPress={() => update(s => ids.reduce((s, id) => setDecision(s, id, 'keep'), s))} style={{ flex: 1 }} />
              <Button title={busy ? 'Deleting…' : `Delete ${photos(n)}`} disabled={!n || busy} onPress={confirm} style={{ flex: 2 }} />
            </View>
          </View>
        </>
      )}

      <Modal visible={!!preview} animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel="Close preview" style={{ flex: 1, backgroundColor: '#000' }}>
          {preview && <Image source={{ uri: preview }} contentFit="contain" style={{ flex: 1 }} />}
        </Pressable>
      </Modal>
    </Screen>
  )
}
