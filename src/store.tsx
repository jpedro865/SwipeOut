import { File, Paths } from 'expo-file-system'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { applyFreezes, dayKey, initialData, type Data } from './logic'

type Store = { data: Data; update: (f: (s: Data) => Data) => void }
const Ctx = createContext<Store | null>(null)

const path = () => new File(Paths.document, 'swipeout.json')

async function load(): Promise<Data> {
  const f = path()
  if (!f.exists) return initialData
  try {
    const saved = JSON.parse(await f.text())
    return { ...initialData, ...saved, settings: { ...initialData.settings, ...saved.settings } }
  } catch (e) {
    console.warn('swipeout: could not read saved progress', e)
    return initialData
  }
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
      const tmp = new File(Paths.document, 'swipeout.json.tmp')
      await tmp.write(json)
      await tmp.move(path(), { overwrite: true })
    } catch (e) {
      console.warn('swipeout: save failed', e)
    }
  }
  busy = false
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    load().then(d => setData(applyFreezes(d, dayKey())))
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') setData(s => s && applyFreezes(s, dayKey()))
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (data) save(data)
  }, [data])

  if (!data) return null
  return <Ctx.Provider value={{ data, update: f => setData(s => s && f(s)) }}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
