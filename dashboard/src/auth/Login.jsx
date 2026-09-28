import { useState } from 'react'
import { GraduationCap, LogIn, Mail } from 'lucide-react'
import { useAuth } from './AuthContext'

const inputCls = 'w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

export default function Login() {
  const { signIn, sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const addr = email.trim()
    if (usePassword) {
      const { error } = await signIn(addr, password)
      if (error) setError(error.message)
    } else {
      const { error } = await sendMagicLink(addr)
      if (error) setError(error.message)
      else setSentTo(addr)
    }
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

        {sentTo ? (
          <div className="card space-y-3 p-6 text-center">
            <Mail size={22} className="mx-auto text-brand-600" />
            <p className="text-sm text-ink-700">
              Sign-in link sent to <span className="font-semibold">{sentTo}</span>. Open it on this device to continue.
            </p>
            <button type="button" onClick={() => setSentTo(null)} className="text-xs font-medium text-brand-600 hover:underline">
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4 p-6">
            <div>
              <label className="label mb-1 block">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                className={inputCls}
              />
            </div>
            {usePassword && (
              <div>
                <label className="label mb-1 block">Password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className={inputCls}
                />
              </div>
            )}
            {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</div>}
            <button
              type="submit" disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {usePassword
                ? <><LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}</>
                : <><Mail size={16} /> {busy ? 'Sending…' : 'Email me a sign-in link'}</>}
            </button>
            <button
              type="button" onClick={() => { setUsePassword(!usePassword); setError(null) }}
              className="block w-full text-center text-xs font-medium text-ink-400 hover:text-ink-600"
            >
              {usePassword ? 'Sign in with an email link instead' : 'Sign in with a password instead'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
