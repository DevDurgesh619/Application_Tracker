import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // load the counsellor's role (gates the curator surface)
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) { setRole(null); return }
    let alive = true
    supabase.from('counsellors').select('role').eq('id', uid).maybeSingle()
      .then(({ data }) => { if (alive) setRole(data?.role || null) })
    return () => { alive = false }
  }, [session?.user?.id])

  const value = {
    session,
    ready,
    user: session?.user || null,
    role,
    isCurator: role === 'curator' || role === 'admin',
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>')
  return ctx
}
