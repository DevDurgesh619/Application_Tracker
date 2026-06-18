import { useState } from 'react'
import { GraduationCap, LogIn } from 'lucide-react'
import { useAuth } from './AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <GraduationCap size={26} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink-900">College Tracker</h1>
            <p className="text-sm text-ink-400">Counsellor sign in</p>
          </div>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label mb-1 block">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="label mb-1 block">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</div>}
          <button
            type="submit" disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
