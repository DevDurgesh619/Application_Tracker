import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Check, Archive, RotateCcw, Loader2, GraduationCap } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { useStudents } from './StudentsContext'
import { listStudents, archiveStudent, restoreStudent } from '../data/students'

export default function StudentsList() {
  const navigate = useNavigate()
  const { currentId, setCurrentStudent, refresh } = useStudents()
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function reload() {
    try { setRows(await listStudents()) } catch (e) { setErr(e?.message) }
  }
  useEffect(() => { reload() }, [])

  const run = async (fn) => { setBusy(true); setErr(null); try { await fn(); await reload(); await refresh() } catch (e) { setErr(e?.message || 'Action failed') } finally { setBusy(false) } }

  if (!rows) return <div className="grid h-64 place-items-center text-ink-400"><Loader2 className="animate-spin" /></div>

  const active = rows.filter((s) => s.status === 'active')
  const archived = rows.filter((s) => s.status === 'archived')

  function switchTo(id) { setCurrentStudent(id); navigate('/') }

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Students" subtitle={`${active.length} active · ${archived.length} archived`}>
        <button onClick={() => navigate('/students/new')} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"><Plus size={16} /> Onboard student</button>
      </PageHeader>

      {err && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{err}</div>}

      <div className="card divide-y divide-ink-100 overflow-hidden">
        {active.map((s) => (
          <Row key={s.id} s={s} current={s.id === currentId} busy={busy}
            onSwitch={() => switchTo(s.id)} onArchive={() => run(() => archiveStudent(s.id))} />
        ))}
        {active.length === 0 && <div className="p-6 text-center text-sm text-ink-400">No active students. Onboard your first.</div>}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-bold text-ink-500">Archived</h2>
          <div className="card divide-y divide-ink-100 overflow-hidden opacity-75">
            {archived.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-400"><GraduationCap size={18} /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink-700">{s.full_name}</div><div className="text-xs text-ink-400">{s.profile_summary}</div></div>
                <button onClick={() => run(() => restoreStudent(s.id))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"><RotateCcw size={13} /> Restore</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ s, current, busy, onSwitch, onArchive }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 ${current ? 'bg-brand-50/40' : ''}`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${current ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}><GraduationCap size={20} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-ink-900">{s.full_name}</span>
          {current && <span className="chip bg-brand-100 text-brand-700"><Check size={11} /> current</span>}
        </div>
        <div className="text-xs text-ink-500">{s.profile_summary || '—'}{s.class_of ? ` · Class of ${s.class_of}` : ''} · {s.appCount} schools</div>
      </div>
      {!current && <button onClick={onSwitch} className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">Open</button>}
      <button onClick={onArchive} disabled={busy} title="Archive (restorable)" className="rounded-lg p-2 text-ink-300 hover:bg-ink-50 hover:text-ink-500"><Archive size={15} /></button>
    </div>
  )
}
