import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, GraduationCap, PenLine, Mic, Wallet,
  Award, CalendarDays, Columns3, Sparkles, ShieldCheck, LogOut, Database, ChevronsUpDown, Plus, Check,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useData } from '../data/DataContext'
import { useAuth } from '../auth/AuthContext'
import { useStudents } from '../students/StudentsContext'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/universities', label: 'Universities', icon: GraduationCap },
  { to: '/essays', label: 'Essay Tracker', icon: PenLine },
  { to: '/interviews', label: 'Interview Tracker', icon: Mic },
  { to: '/cost', label: 'Cost Analysis', icon: Wallet },
  { to: '/activities', label: 'Activities & Honors', icon: Award },
  { to: '/calendar', label: 'Deadline Calendar', icon: CalendarDays },
  { to: '/compare', label: 'Compare', icon: Columns3 },
  { to: '/verification', label: 'Data Verification', icon: ShieldCheck },
]

export default function Sidebar() {
  const { student, universities } = useData()
  const { signOut, isCurator } = useAuth()
  const { activeStudents, currentId, setCurrentStudent } = useStudents()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-ink-100 bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-soft">
          <GraduationCap size={22} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink-900">College Tracker</div>
          <div className="truncate text-xs text-ink-400">Class of {student.classOf}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} strokeWidth={2.1} className={isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}

        {isCurator && (
          <>
            <div className="mx-3 my-2 border-t border-ink-100" />
            <NavLink
              to="/curator"
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Database size={18} strokeWidth={2.1} className={isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'} />
                  Data Curator
                </>
              )}
            </NavLink>
          </>
        )}
      </nav>

      <div className="relative mx-3 mb-3" ref={ref}>
        <button onClick={() => setOpen((o) => !o)} className="w-full rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-left text-white">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-brand-100">
            <span className="flex items-center gap-2"><Sparkles size={14} /> Student</span>
            <ChevronsUpDown size={14} className="text-brand-200" />
          </div>
          <div className="mt-1.5 truncate text-base font-bold leading-tight">{student.name}</div>
          <div className="mt-0.5 truncate text-xs text-brand-100">{student.profile}</div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/15 pt-3 text-xs text-brand-100">
            <span className="font-bold text-white">{universities.length}</span> schools tracked
          </div>
        </button>

        {open && (
          <div className="absolute bottom-full left-0 z-30 mb-2 w-full overflow-hidden rounded-xl border border-ink-100 bg-white shadow-lift">
            <div className="max-h-64 overflow-auto py-1">
              {activeStudents.map((s) => (
                <button key={s.id} onClick={() => { setCurrentStudent(s.id); setOpen(false); navigate('/') }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600"><GraduationCap size={13} /></span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-800">{s.full_name}</span>
                  {s.id === currentId && <Check size={14} className="shrink-0 text-brand-600" />}
                </button>
              ))}
            </div>
            <div className="border-t border-ink-100">
              <button onClick={() => { setOpen(false); navigate('/students/new') }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"><Plus size={14} /> Onboard student</button>
              <button onClick={() => { setOpen(false); navigate('/students') }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-600 hover:bg-ink-50"><Sparkles size={14} /> Manage students</button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={signOut}
        className="mx-3 mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
      >
        <LogOut size={16} /> Sign out
      </button>
    </aside>
  )
}
