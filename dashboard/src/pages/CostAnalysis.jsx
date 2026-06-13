import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar as RBar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from 'recharts'
import { Wallet, TrendingDown, Banknote, Info } from 'lucide-react'
import { universities, tier, country, fmtL } from '../data/store'
import { PageHeader, Flag, TierBadge } from '../components/ui'

const tipStyle = { borderRadius: 12, border: '1px solid #eceef2', boxShadow: '0 4px 16px rgba(16,24,40,0.08)', fontSize: 12 }

export default function CostAnalysis() {
  const [sort, setSort] = useState('total') // total | best | fouryear

  const withCost = universities.filter((u) => u.cost.total)
  const avg = withCost.reduce((s, u) => s + u.cost.total, 0) / withCost.length

  const chartData = [...withCost]
    .sort((a, b) =>
      sort === 'best' ? (a.cost.bestCase ?? a.cost.total) - (b.cost.bestCase ?? b.cost.total)
      : sort === 'fouryear' ? a.cost.fourYear - b.cost.fourYear
      : a.cost.total - b.cost.total
    )
    .map((u) => ({
      id: u.id,
      name: u.name.length > 18 ? u.name.slice(0, 17) + '…' : u.name,
      full: u.name,
      tuition: u.cost.tuition,
      living: u.cost.living,
      other: u.cost.other,
      total: u.cost.total,
      best: u.cost.bestCase,
      fourYear: u.cost.fourYear,
      flag: country(u.country).flag,
      hex: tier(u.tier).hex,
    }))

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Cost Analysis" subtitle="All figures in ₹ Lakh/yr · rates: $1=₹84 · A$1=₹55 · S$1=₹63">
        <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1">
          {[['total', 'Total/yr'], ['best', 'Best-case'], ['fouryear', '4-year']].map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${sort === k ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Average total / yr" value={fmtL(Math.round(avg * 10) / 10)} icon={Wallet} accent="brand" />
        <SummaryCard label="Most affordable" value={fmtL(chartData[0]?.total)} sub={chartData[0]?.full} icon={TrendingDown} accent="emerald" />
        <SummaryCard label="Cheapest 4-yr" value={fmtL(Math.min(...withCost.map((u) => u.cost.fourYear)))} icon={Banknote} accent="emerald" />
        <SummaryCard label="Priciest 4-yr" value={fmtL(Math.max(...withCost.map((u) => u.cost.fourYear)))} icon={Banknote} accent="rose" />
      </div>

      {/* stacked bar chart */}
      <div className="card mb-6 p-5">
        <h2 className="mb-1 text-sm font-bold text-ink-900">
          {sort === 'best' ? 'Best-case annual cost (with aid/scholarships)' : sort === 'fouryear' ? '4-year total cost' : 'Annual cost breakdown — tuition · living · other'}
        </h2>
        <p className="mb-4 text-xs text-ink-400">Sorted ascending · hover for details · click a bar to open the profile</p>
        <div style={{ height: Math.max(360, chartData.length * 26) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#eceef2" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#828ea3' }} axisLine={false} tickLine={false} unit="L" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#40495a' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: '#f6f7f9' }} formatter={(v, n) => [`₹${v}L`, n]} labelFormatter={(l, p) => p?.[0]?.payload?.full || l} />
              {sort === 'total' ? (
                <>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <RBar dataKey="tuition" stackId="a" fill="#3563f0" name="Tuition" radius={[0, 0, 0, 0]} />
                  <RBar dataKey="living" stackId="a" fill="#8eb6ff" name="Living" />
                  <RBar dataKey="other" stackId="a" fill="#d9e6ff" name="Other" radius={[0, 6, 6, 0]} />
                </>
              ) : (
                <RBar dataKey={sort === 'best' ? 'best' : 'fourYear'} radius={[0, 6, 6, 0]} barSize={18} name={sort === 'best' ? 'Best-case/yr' : '4-yr total'}>
                  {chartData.map((d) => <Cell key={d.id} fill={d.hex} />)}
                </RBar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* detailed table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-400">
              <th className="px-5 py-3 font-semibold">University</th>
              <th className="px-3 py-3 font-semibold">Tier</th>
              <th className="px-3 py-3 text-right font-semibold">Tuition</th>
              <th className="px-3 py-3 text-right font-semibold">Living</th>
              <th className="px-3 py-3 text-right font-semibold">Other</th>
              <th className="px-3 py-3 text-right font-semibold">Total/yr</th>
              <th className="px-3 py-3 text-right font-semibold">Best/yr</th>
              <th className="px-5 py-3 text-right font-semibold">4-yr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {chartData.map((d) => {
              const u = universities.find((x) => x.id === d.id)
              return (
                <tr key={d.id} className="transition hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link to={`/university/${d.id}`} className="flex items-center gap-2 font-semibold text-ink-800 hover:text-brand-600">
                      <span>{d.flag}</span> {d.full}
                    </Link>
                  </td>
                  <td className="px-3 py-3"><TierBadge tier={u.tier} /></td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-600">{fmtL(d.tuition)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-600">{fmtL(d.living)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-600">{fmtL(d.other)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-ink-900">{fmtL(d.total)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{d.best != null ? fmtL(d.best) : '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink-800">{fmtL(d.fourYear)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <Info size={15} className="mt-0.5 shrink-0" />
        Singapore "best-case" assumes the MOE Tuition Grant (3-year SG work bond). Yale is need-blind — best-case can fall near ₹0 tuition if full need is demonstrated. Australian fees reflect international BCom rates.
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, icon: Icon, accent }) {
  const tones = { brand: 'text-brand-600 bg-brand-50', emerald: 'text-emerald-600 bg-emerald-50', rose: 'text-rose-600 bg-rose-50' }
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="label">{label}</div>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${tones[accent]}`}><Icon size={16} /></div>
      </div>
      <div className="mt-2 text-2xl font-bold text-ink-900">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-ink-500">{sub}</div>}
    </div>
  )
}
