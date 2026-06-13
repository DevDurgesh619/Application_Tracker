import { Link } from 'react-router-dom'
import {
  GraduationCap, CalendarClock, Wallet, PenLine, Mic, Trophy,
  Target, TrendingUp, ArrowUpRight, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar as RBar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import {
  universities, essays, interviews, activities, honors, student,
  tier, TIERS, COUNTRY, fmtL, daysUntil, deadlineEvents,
  audit, auditSummary,
} from '../data/store'
import { StatCard, TierBadge, Flag, SectionCard } from '../components/ui'

export default function Overview() {
  const tierCounts = Object.keys(TIERS).map((t) => ({
    name: t, value: universities.filter((u) => u.tier === t).length, color: tier(t).hex,
  }))
  const countryCounts = Object.keys(COUNTRY).map((c) => ({
    name: c, flag: COUNTRY[c].flag, value: universities.filter((u) => u.country === c).length,
  })).filter((c) => c.value)

  const essaysDone = essays.filter((e) => /complete|done|submitted/i.test(e.status)).length
  const interviewsReq = interviews.length

  const cheapest = [...universities].filter((u) => u.cost.total).sort((a, b) => a.cost.total - b.cost.total)[0]
  const priciest = [...universities].filter((u) => u.cost.total).sort((a, b) => b.cost.total - a.cost.total)[0]

  // upcoming deadlines
  const today = new Date()
  const upcoming = deadlineEvents()
    .filter((e) => e.date && e.kind === 'deadline' && daysUntil(e.date, today) >= 0)
    .sort((a, b) => a.date - b.date)
    .slice(0, 6)

  // cost by country (avg total)
  const costByCountry = countryCounts.map((c) => {
    const us = universities.filter((u) => u.country === c.name && u.cost.total)
    const avg = us.reduce((s, u) => s + u.cost.total, 0) / (us.length || 1)
    return { name: `${c.flag} ${c.name}`, avg: Math.round(avg * 10) / 10 }
  }).sort((a, b) => b.avg - a.avg)

  return (
    <div className="animate-fadeUp">
      {/* hero */}
      <div className="mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-700 to-brand-900 p-7 text-white shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-brand-200">College Application Tracker</div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{student.name}</h1>
            <p className="mt-1 text-brand-100">{student.profile} · Class of {student.classOf}</p>
          </div>
          <div className="flex gap-6">
            {tierCounts.map((t) => (
              <div key={t.name} className="text-center">
                <div className="text-3xl font-extrabold">{t.value}</div>
                <div className="text-xs font-medium text-brand-200">{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Universities" value={universities.length} sub={`${countryCounts.length} countries`} accent="brand" />
        <StatCard icon={PenLine} label="Essays" value={essays.length} sub={`${essaysDone} complete`} accent="emerald" />
        <StatCard icon={Mic} label="Interviews" value={interviewsReq} sub="to prepare / log" accent="rose" />
        <StatCard icon={Trophy} label="Activities & Honors" value={`${activities.length}+${honors.length}`} sub="for Common App" accent="amber" />
      </div>

      {/* data verification strip */}
      <Link to="/verification" className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 transition hover:shadow-soft">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><ShieldCheck size={22} /></div>
        <div className="flex-1">
          <div className="text-sm font-bold text-ink-900">{audit.length} figures verified against official university sources</div>
          <div className="text-xs text-ink-500">Tuition, deadlines, test policies & scholarships cross-checked for the 2026–27 cycle.</div>
        </div>
        <div className="flex items-center gap-4">
          <VStat n={auditSummary().wrong} label="corrected" tone="text-rose-600" icon={AlertTriangle} />
          <VStat n={auditSummary().warning} label="to verify" tone="text-amber-600" />
          <VStat n={auditSummary().correct} label="confirmed" tone="text-emerald-600" />
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* upcoming deadlines */}
        <div className="lg:col-span-2">
          <SectionCard
            icon={CalendarClock}
            title="Upcoming Deadlines"
            accent="rose"
            action={<Link to="/calendar" className="text-xs font-semibold text-brand-600 hover:underline">Full calendar →</Link>}
          >
            <ul className="divide-y divide-ink-100">
              {upcoming.map((e, i) => {
                const days = daysUntil(e.date, today)
                return (
                  <li key={i}>
                    <Link to={`/university/${e.uni.id}`} className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-ink-50">
                      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-ink-50 py-1.5 group-hover:bg-white">
                        <span className="text-[10px] font-bold uppercase text-rose-500">{e.date.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-lg font-extrabold leading-none text-ink-900">{e.date.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                          <Flag country={e.uni.country} /> {e.uni.name}
                        </div>
                        <div className="truncate text-xs text-ink-500">{e.label}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${days <= 30 ? 'text-rose-600' : days <= 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{days}d</div>
                        <TierBadge tier={e.uni.tier} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        </div>

        {/* tier donut */}
        <SectionCard icon={Target} title="Portfolio Balance" accent="brand">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tierCounts} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2} stroke="none">
                  {tierCounts.map((t) => <Cell key={t.name} fill={t.color} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {tierCounts.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} /> {t.name}
                </span>
                <span className="font-semibold text-ink-800">{t.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* second row */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* avg cost by country */}
        <div className="lg:col-span-2">
          <SectionCard icon={Wallet} title="Average Annual Cost by Country (₹ Lakh)" accent="emerald" action={<Link to="/cost" className="text-xs font-semibold text-brand-600 hover:underline">Cost analysis →</Link>}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costByCountry} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#eceef2" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#828ea3' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12, fill: '#40495a' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tipStyle} formatter={(v) => [`₹${v}L`, 'Avg total/yr']} cursor={{ fill: '#f6f7f9' }} />
                  <RBar dataKey="avg" fill="#3563f0" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* cost extremes */}
        <div className="space-y-4">
          <CostExtreme label="Most affordable" u={cheapest} accent="emerald" icon={TrendingUp} />
          <CostExtreme label="Most expensive" u={priciest} accent="rose" icon={ArrowUpRight} />
        </div>
      </div>
    </div>
  )
}

const tipStyle = { borderRadius: 12, border: '1px solid #eceef2', boxShadow: '0 4px 16px rgba(16,24,40,0.08)', fontSize: 12 }

function VStat({ n, label, tone, icon: Icon }) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1 text-xl font-extrabold ${tone}`}>
        {Icon && <Icon size={15} />} {n}
      </div>
      <div className="text-[11px] font-medium text-ink-400">{label}</div>
    </div>
  )
}

function CostExtreme({ label, u, accent, icon: Icon }) {
  if (!u) return null
  const tones = { emerald: 'text-emerald-600 bg-emerald-50', rose: 'text-rose-600 bg-rose-50' }
  return (
    <Link to={`/university/${u.id}`} className="card block p-5 transition hover:shadow-soft">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${tones[accent]}`}><Icon size={16} /></div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm font-bold text-ink-900">
        <Flag country={u.country} /> {u.name}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-ink-900">{fmtL(u.cost.total)}<span className="text-sm font-medium text-ink-400">/yr</span></div>
      <div className="text-xs text-ink-500">4-yr total {fmtL(u.cost.fourYear)}</div>
    </Link>
  )
}
