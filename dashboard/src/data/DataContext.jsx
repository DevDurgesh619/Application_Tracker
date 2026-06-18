import { createContext, useContext, useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { loadRawData } from './source'
import { buildDataset } from './dataset'

/* ------------------------------------------------------------------ *
 *  DataProvider — loads raw data from the (swappable) source once,
 *  builds the derived dataset, and serves it to the app via useData().
 *  This is the single async boundary; pages read data synchronously
 *  from context, so the UI never deals with the source directly.
 * ------------------------------------------------------------------ */

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    let alive = true
    loadRawData()
      .then((raw) => {
        if (alive) setState({ status: 'ready', data: buildDataset(raw), error: null })
      })
      .catch((error) => {
        if (alive) setState({ status: 'error', data: null, error })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') return <LoadingScreen />
  if (state.status === 'error') return <ErrorScreen error={state.error} />

  return <DataContext.Provider value={state.data}>{children}</DataContext.Provider>
}

/** access the loaded dataset (universities, essays, helpers, …) */
export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData() must be used within <DataProvider>')
  return ctx
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50">
      <div className="flex flex-col items-center gap-3 text-ink-400">
        <div className="grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-brand-600 text-white">
          <GraduationCap size={26} />
        </div>
        <div className="text-sm font-medium">Loading tracker…</div>
      </div>
    </div>
  )
}

function ErrorScreen({ error }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 p-6">
      <div className="card max-w-md p-6 text-center">
        <div className="text-lg font-bold text-rose-600">Couldn't load data</div>
        <p className="mt-2 text-sm text-ink-500">{String(error?.message || error)}</p>
      </div>
    </div>
  )
}
