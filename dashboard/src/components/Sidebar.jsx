import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, GraduationCap, PenLine, Mic, Wallet,
  Award, CalendarDays, Columns3, Sparkles, ShieldCheck, LogOut,
} from 'lucide-react'
import { useData } from '../data/DataContext'
import { useAuth } from '../auth/AuthContext'

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
  const { signOut } = useAuth()
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
      </nav>

      <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-100">
          <Sparkles size={14} /> Student
        </div>
        <div className="mt-1.5 text-base font-bold leading-tight">{student.name}</div>
        <div className="mt-0.5 text-xs text-brand-100">{student.profile}</div>
        <div className="mt-3 flex items-center gap-2 border-t border-white/15 pt-3 text-xs text-brand-100">
          <span className="font-bold text-white">{universities.length}</span> schools tracked
        </div>
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
