import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, GraduationCap, Banknote, BadgeCheck, AlertTriangle } from 'lucide-react'
import { daysUntil, fmtDate } from '../data/store'
import { useData } from '../data/DataContext'
import { PageHeader, Flag, TierBadge } from '../components/ui'

const KINDS = {
  deadline: { label: 'Application', icon: GraduationCap, tone: 'text-rose-600 bg-rose-50 border-rose-200', dot: '#f43f5e' },
  scholarship: { label: 'Scholarship', icon: Banknote, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: '#10b981' },
  decision: { label: 'Decision', icon: BadgeCheck, tone: 'text-brand-600 bg-brand-50 border-brand-200', dot: '#3563f0' },
}

export default function Calendar() {
  const { deadlineEvents } = useData()
  const [kinds, setKinds] = useState({ deadline: true, scholarship: true, decision: true })
  const today = new Date()

  const events = useMemo(
    () =>
      deadlineEvents()
        .filter((e) => e.date && kinds[e.kind])
        .sort((a, b) => a.date - b.date),
    [kinds],
  )

  const undated = useMemo(() => deadlineEvents().filter((e) => !e.date && e.kind === 'deadline'), [])

  // group by "Month YYYY"
  const groups = useMemo(() => {
    const m = new Map()
    for (const e of events) {
      const key = e.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(e)
    }
    return [...m.entries()]
  }, [events])

  const nextDeadline = events.find((e) => e.kind === 'deadline' && daysUntil(e.date, today) >= 0)

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Deadline Calendar" subtitle="Every application, scholarship and decision date — chronological">
        <div className="flex items-center gap-1.5">
          {Object.entries(KINDS).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}
              className={`chip border transition ${kinds[k] ? cfg.tone : 'border-ink-200 bg-white text-ink-400'}`}
            >
              <cfg.icon size={13} /> {cfg.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {nextDeadline && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-5 text-white shadow-soft">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15"><CalendarDays size={24} /></div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-rose-100">Next deadline</div>
              <div className="text-lg font-bold">{nextDeadline.uni.name}</div>
              <div className="text-sm text-rose-100">{fmtDate(nextDeadline.date)} · {nextDeadline.label}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-extrabold leading-none">{daysUntil(nextDeadline.date, today)}</div>
            <div className="text-xs font-medium text-rose-100">days away</div>
          </div>
        </div>
      )}

      {/* timeline */}
      <div className="relative">
        {groups.map(([month, evs]) => (
          <div key={month} className="mb-8">
            <div className="sticky top-0 z-10 -mx-1 mb-3 bg-ink-50/90 px-1 py-1 backdrop-blur">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">{month}</h2>
            </div>
            <div className="space-y-2.5">
              {evs.map((e, i) => {
                const cfg = KINDS[e.kind]
                const days = daysUntil(e.date, today)
                const passed = days < 0
                return (
                  <Link
                    key={i}
                    to={`/university/${e.uni.id}`}
                    className={`group flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card transition hover:shadow-soft ${passed ? 'opacity-55' : ''}`}
                  >
                    {/* date block */}
                    <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-ink-100 py-1.5">
                      <span className="text-[10px] font-bold uppercase text-ink-400">{e.date.toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-xl font-extrabold leading-none text-ink-900">{e.date.getDate()}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`chip border ${cfg.tone}`}><cfg.icon size={12} /> {cfg.label}</span>
                        {e.approx && <span className="chip bg-ink-100 text-ink-500"><AlertTriangle size={11} /> approx</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 font-bold text-ink-900 group-hover:text-brand-700">
                        <Flag country={e.uni.country} /> {e.uni.name}
                      </div>
                      <div className="truncate text-xs text-ink-500">{e.label}</div>
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                      <div className={`text-sm font-bold ${passed ? 'text-ink-400' : days <= 30 ? 'text-rose-600' : days <= 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {passed ? 'passed' : `${days}d`}
                      </div>
                      <TierBadge tier={e.uni.tier} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {undated.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-500">Dates not yet announced</h2>
          <p className="mb-3 max-w-2xl text-xs text-ink-400">
            These schools haven’t published their next-cycle deadline yet (most open in autumn 2026). We show them here instead of guessing a date — exact deadlines appear above automatically once each school posts them.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {undated.map((e, i) => (
              <Link key={i} to={`/university/${e.uni.id}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-white p-4 hover:border-brand-300">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-500"><CalendarDays size={18} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold text-ink-800"><Flag country={e.uni.country} /> {e.uni.name}</div>
                  <div className="truncate text-xs text-ink-500">{e.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
