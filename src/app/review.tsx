import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, FlatList, Modal, Platform, Pressable, View } from 'react-native'
import { fmtBytes, fmtNum, t } from '../i18n'
import { dayKey, markDeleted, setDecision } from '../logic'
import { allPhotos, deletePhotos, sizeOf } from '../media'
import { play } from '../sound'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Icon, Screen, Txt, buzz, center } from '../ui'

const sum = (ids: string[], sizes: Record<string, number>) => ids.reduce((a, id) => a + (sizes[id] ?? 0), 0)

export default function Review() {
  const th = useTheme()
  const { data, update } = useStore()
  const [ids] = useState(() => Object.keys(data.decisions).filter(id => data.decisions[id] === 'delete'))
  const known = useRef<Record<string, number>>({})
  const [sizes, setSizes] = useState<Record<string, number> | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState<{ n: number; bytes: number; stuck: number } | null>(null)

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
    buzz(data.settings.haptics, 'select')
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
    // The OS can resolve without removing everything (ids already gone, Android 7-10 per-file failures): record only what left.
    const left = new Set((await allPhotos().catch(() => [])).map(p => p.id))
    const gone = del.filter(id => !left.has(id))
    const freed = sum(gone, known.current)
    if (gone.length) {
      update(s => markDeleted(s, gone, freed, dayKey()))
      buzz(data.settings.haptics, 'success')
      play('cleared', data.settings.sounds)
    }
    setDone({ n: gone.length, bytes: freed, stuck: del.length - gone.length })
    setBusy(false)
  }

  const confirm = () =>
    Alert.alert(
      t('review.confirm', { n }),
      t(Platform.OS === 'ios' ? 'review.confirmIos' : 'review.confirmAndroid', { n }),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: remove }],
    )

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ padding: 20, paddingBottom: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="title" accessibilityRole="header" style={{ flex: 1 }}>{t('review.title')}</Txt>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.raised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon n="close" size={18} weight="bold" />
          </Pressable>
        </View>
        {!done && ids.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon n="tap" size={15} color={th.muted} />
            <Txt muted style={{ flex: 1 }}>{t('review.help')}</Txt>
          </View>
        )}
      </View>

      {done || !ids.length ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 }}>
          {done ? (
            <>
              {done.n > 0 && (
                <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: th.mint + '26', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon n="sparkles" size={56} color={th.mint} bounce={data.settings.motion} />
                </View>
              )}
              {done.n ? (
                <View accessible style={{ alignItems: 'center' }}>
                  <Txt v="big">{fmtNum(done.n)}</Txt>
                  <Txt v="h2" muted>{t('review.cleared', { n: done.n })}</Txt>
                </View>
              ) : (
                <Txt v="title" style={center}>{t('review.nothing')}</Txt>
              )}
              {done.bytes > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon n="storage" size={18} color={th.mint} />
                  <Txt v="h2">{t('review.freed', { size: fmtBytes(done.bytes) })}</Txt>
                </View>
              )}
              {done.stuck > 0 && <Txt muted style={center}>{t('review.stuck', { n: done.stuck })}</Txt>}
            </>
          ) : (
            <Txt style={center}>{t('review.none')}</Txt>
          )}
          <Button title={t('review.done')} onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 12 }} />
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
                  accessibilityLabel={t(kept ? 'review.kept' : 'review.markedPhoto')}
                  accessibilityHint={t('review.gridHint')}
                  style={{ width: '33.333%', aspectRatio: 1, padding: 2 }}
                >
                  <Image source={{ uri: item }} contentFit="cover" recyclingKey={item} style={{ flex: 1, borderRadius: 12, opacity: kept ? 0.35 : 1 }} />
                  <View style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: kept ? th.mint : th.coral, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon n={kept ? 'keep' : 'trash'} size={13} color={th.midnight} weight="bold" />
                  </View>
                </Pressable>
              )
            }}
          />
          <View style={{ padding: 20, paddingBottom: 12, gap: 12, borderTopWidth: 1, borderColor: th.line }}>
            {failed && <Txt style={center}>{t('review.nothing')}</Txt>}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 26 }}>
              <Icon n="storage" size={18} color={th.mint} />
              {sizes ? !!bytes && <Txt v="h2">{t('review.toFree', { size: fmtBytes(bytes) })}</Txt> : <Txt muted>{t('review.estimating')}</Txt>}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button icon="keep" title={t('review.keepAll')} outline disabled={busy} onPress={() => update(s => ids.reduce((s, id) => setDecision(s, id, 'keep'), s))} style={{ flex: 1, paddingHorizontal: 12 }} />
              <Button icon="trash" title={busy ? t('review.deleting') : t('review.deleteN', { n })} disabled={!n || busy} onPress={confirm} style={{ flex: 1.4, paddingHorizontal: 12 }} />
            </View>
          </View>
        </>
      )}

      <Modal visible={!!preview} animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel={t('review.closePreview')} style={{ flex: 1, backgroundColor: '#000' }}>
          {preview && <Image source={{ uri: preview }} contentFit="contain" style={{ flex: 1 }} />}
        </Pressable>
      </Modal>
    </Screen>
  )
}
