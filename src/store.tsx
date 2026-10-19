import { File, Paths } from 'expo-file-system'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { applyFreezes, dayKey, initialData, type Data } from './logic'

type Store = { data: Data; update: (f: (s: Data) => Data) => void }
const Ctx = createContext<Store | null>(null)

const file = (name: string) => new File(Paths.document, name)

// Falls back to the tmp file (iOS move() removes the target first, so a kill there leaves only tmp),
// and moves an unreadable save aside rather than letting the next save overwrite it.
async function load(): Promise<Data> {
  for (const name of ['swipeout.json', 'swipeout.json.tmp']) {
    const f = file(name)
    if (!f.exists) continue
    try {
      const saved = JSON.parse(await f.text())
      return { ...initialData, ...saved, settings: { ...initialData.settings, ...saved.settings } }
    } catch (e) {
      console.warn(`swipeout: unreadable ${name}, kept as ${name}.bad`, e)
      await f.move(file(`${name}.bad`), { overwrite: true }).catch(() => {})
    }
  }
  return initialData
}

// Writes coalesce to the latest state; tmp + move so a kill mid-write can't truncate the save.
let latest: Data | null = null
let busy = false
async function save(d: Data) {
  latest = d
  if (busy) return
  busy = true
  while (latest) {
    const json = JSON.stringify(latest)
    latest = null
    try {
      const tmp = file('swipeout.json.tmp')
      await tmp.write(json)
      await tmp.move(file('swipeout.json'), { overwrite: true })
    } catch (e) {
      console.warn('swipeout: save failed', e)
    }
  }
  busy = false
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null)
  const update = useCallback((f: (s: Data) => Data) => setData(s => s && f(s)), []) // stable, so memoized screens can skip renders

  useEffect(() => {
    load().then(d => setData(applyFreezes(d, dayKey())))
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') setData(s => s && { ...applyFreezes(s, dayKey()) }) // new object: re-render so 'today' rolls over
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (data) save(data)
  }, [data])

  if (!data) return null
  return <Ctx.Provider value={{ data, update }}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
