import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, CalendarClock, Wallet, MapPin } from 'lucide-react'
import {
  universities, tier, country, TIERS, COUNTRY, fmtL,
  primaryDeadline, daysUntil, fmtDate,
} from '../data/store'
import { PageHeader, TierBadge, StatusBadge, Flag } from '../components/ui'

const TIER_ORDER = Object.keys(TIERS)

export default function Universities() {
  const [q, setQ] = useState('')
  const [tierF, setTierF] = useState('All')
  const [countryF, setCountryF] = useState('All')

  const filtered = useMemo(() => {
    return universities.filter((u) => {
      if (tierF !== 'All' && u.tier !== tierF) return false
      if (countryF !== 'All' && u.country !== countryF) return false
      if (q) {
        const hay = `${u.name} ${u.programme} ${u.country} ${u.tier}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [q, tierF, countryF])

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Universities" subtitle={`${universities.length} schools · click any card to open its full master profile`} />

      {/* filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search universities, programmes…"
            className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <Segmented label="Tier" value={tierF} setValue={setTierF} options={['All', ...TIER_ORDER]} />
        <Segmented label="Country" value={countryF} setValue={setCountryF} options={['All', ...Object.keys(COUNTRY)]} />
      </div>

      {/* tier legend counts */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TIER_ORDER.map((t) => {
          const n = universities.filter((u) => u.tier === t).length
          const c = tier(t)
          return (
            <span key={t} className={`chip ${c.bg} ${c.text} border ${c.border}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} /> {t} · {n}
            </span>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((u) => (
          <UniCard key={u.id} u={u} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="card p-10 text-center text-ink-400">No universities match your filters.</div>
      )}
    </div>
  )
}

function Segmented({ label, value, setValue, options }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => setValue(o)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            value === o ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:bg-ink-50'
          }`}
        >
          {o === 'All' ? `All ${label}` : (COUNTRY[o]?.flag ? `${COUNTRY[o].flag} ${o}` : o)}
        </button>
      ))}
    </div>
  )
}

function UniCard({ u }) {
  const t = tier(u.tier)
  const d = primaryDeadline(u)
  const days = daysUntil(d)
  return (
    <Link
      to={`/university/${u.id}`}
      className="group card relative flex flex-col overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: t.hex }} />
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{country(u.country).flag}</span>
          <TierBadge tier={u.tier} />
        </div>
        <span className="text-xs font-semibold text-ink-300">#{u.num}</span>
      </div>

      <h3 className="text-base font-bold leading-snug text-ink-900 group-hover:text-brand-700">{u.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-ink-500">{u.programme}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3.5">
        <div>
          <div className="label flex items-center gap-1"><CalendarClock size={11} /> Deadline</div>
          <div className="mt-0.5 text-sm font-semibold text-ink-800">{d ? fmtDate(d) : 'Rolling'}</div>
          {days !== null && (
            <div className={`text-xs font-medium ${days <= 30 ? 'text-rose-600' : days <= 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {days < 0 ? 'passed' : `${days} days`}
            </div>
          )}
        </div>
        <div>
          <div className="label flex items-center gap-1"><Wallet size={11} /> Total / yr</div>
          <div className="mt-0.5 text-sm font-semibold text-ink-800">{fmtL(u.cost.total)}</div>
          <div className="text-xs text-ink-400">{u.tests?.includes('Blind') ? 'Test-blind' : u.tests?.includes('Optional') ? 'Test-optional' : u.tests?.includes('Required') ? 'Test-required' : ''}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <StatusBadge status={u.status} />
        <span className="flex items-center gap-0.5 text-xs font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
          Open profile <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  )
}
