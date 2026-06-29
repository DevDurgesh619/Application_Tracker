import { createContext, useContext, useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { loadRawData } from './source'
import { buildDataset } from './dataset'
import { saveApplication, saveStudent } from './mutations'
import { EDITABLE_FIELDS } from './fields'
import { useStudents } from '../students/StudentsContext'

/* ------------------------------------------------------------------ *
 *  DataProvider — loads raw data from the (swappable) source once,
 *  builds the derived dataset, and serves it to the app via useData().
 *  This is the single async boundary; pages read data synchronously
 *  from context, so the UI never deals with the source directly.
 * ------------------------------------------------------------------ */

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { currentId } = useStudents()
  const [state, setState] = useState({ status: 'loading', raw: null, data: null, error: null })
  const [editTick, setEditTick] = useState(0) // bumps after each save → re-fetch derived reads (change history)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, status: 'loading' }))
    loadRawData(currentId)
      .then((raw) => {
        if (alive) setState({ status: 'ready', raw, data: buildDataset(raw), error: null })
      })
      .catch((error) => {
        if (alive) setState({ status: 'error', raw: null, data: null, error })
      })
    return () => {
      alive = false
    }
  }, [currentId])

  /**
   * Edit one or more application fields. Persists to Supabase + change_log,
   * then optimistically rebuilds the dataset so the change re-sorts and
   * re-colors everywhere (no full reload). `edits` is keyed by the logical
   * field ids in EDITABLE_FIELDS, with display values.
   */
  async function editApplication(uniId, edits) {
    const u = state.raw?.universities.find((x) => x.id === uniId)
    if (!u) throw new Error('University not found.')
    if (!u.appId) throw new Error('This record is read-only.')

    const dbPatch = {}
    const changes = []
    const patched = { ...u }

    for (const [key, rawVal] of Object.entries(edits)) {
      const f = EDITABLE_FIELDS[key]
      if (!f) continue
      const newVal = typeof rawVal === 'string' ? (rawVal.trim() === '' ? null : rawVal.trim()) : rawVal
      const oldVal = u[f.raw] ?? null
      if ((oldVal ?? null) === (newVal ?? null)) continue

      dbPatch[f.db] = newVal
      if (key === 'tier') dbPatch.tier_source = 'overridden'
      changes.push({ field: key, old: oldVal, new: newVal })
      patched[f.raw] = newVal
    }
    if (!changes.length) return

    await saveApplication({ appId: u.appId, dbPatch, changes })

    const raw = {
      ...state.raw,
      universities: state.raw.universities.map((x) => (x.id === uniId ? patched : x)),
    }
    setState((s) => ({ ...s, raw, data: buildDataset(raw) }))
    setEditTick((t) => t + 1)
  }

  /**
   * Edit the student's profile (currently SAT score + estimated flag).
   * Persists to Supabase + change_log, then rebuilds so every SAT gap/status
   * across the app recomputes from the new score.
   */
  async function editStudent(edits) {
    const s = state.raw?.student
    if (!s?.id) throw new Error('Student record is read-only.')

    const dbPatch = {}
    const changes = []
    const patched = { ...s }

    if ('satScore' in edits) {
      const n = edits.satScore === '' || edits.satScore == null ? null : Number(edits.satScore)
      if (n != null && (!Number.isFinite(n) || n < 400 || n > 1600)) {
        throw new Error('SAT must be between 400 and 1600.')
      }
      if ((n ?? null) !== (s.satScore ?? null)) {
        dbPatch.sat_score = n
        changes.push({ field: 'satScore', old: s.satScore, new: n })
        patched.satScore = n
      }
    }
    if ('satEstimated' in edits && edits.satEstimated !== s.satEstimated) {
      dbPatch.sat_estimated = edits.satEstimated
      changes.push({ field: 'satEstimated', old: s.satEstimated, new: edits.satEstimated })
      patched.satEstimated = edits.satEstimated
    }
    if (!changes.length) return

    await saveStudent({ studentId: s.id, dbPatch, changes })

    const raw = { ...state.raw, student: patched }
    setState((st) => ({ ...st, raw, data: buildDataset(raw) }))
    setEditTick((t) => t + 1)
  }

  if (state.status === 'loading') return <LoadingScreen />
  if (state.status === 'error') return <ErrorScreen error={state.error} />

  return (
    <DataContext.Provider value={{ ...state.data, editApplication, editStudent, editTick }}>
      {children}
    </DataContext.Provider>
  )
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
