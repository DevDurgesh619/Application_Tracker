import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

/* ------------------------------------------------------------------ *
 *  Which student is the app currently scoped to (Phase 2). Holds the
 *  roster + the selected student id (persisted), above DataProvider so
 *  switching reloads the dataset for that student.
 * ------------------------------------------------------------------ */

const StudentsContext = createContext(null)
const LS_KEY = 'currentStudentId'

export function StudentsProvider({ children }) {
  const [students, setStudents] = useState(null)
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(LS_KEY) || null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, status, class_of, profile_summary')
      .order('created_at')
    const list = data || []
    setStudents(list)
    // keep currentId valid + pointing at an active student
    setCurrentId((prev) => {
      const stillValid = prev && list.some((s) => s.id === prev && s.status === 'active')
      if (stillValid) return prev
      return list.find((s) => s.status === 'active')?.id || null
    })
    setReady(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { if (currentId) localStorage.setItem(LS_KEY, currentId); else localStorage.removeItem(LS_KEY) }, [currentId])

  const value = {
    students: students || [],
    activeStudents: (students || []).filter((s) => s.status === 'active'),
    currentId,
    current: (students || []).find((s) => s.id === currentId) || null,
    ready,
    setCurrentStudent: setCurrentId,
    refresh,
  }
  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>
}

export function useStudents() {
  const ctx = useContext(StudentsContext)
  if (!ctx) throw new Error('useStudents() must be used within <StudentsProvider>')
  return ctx
}
