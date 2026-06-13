import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, ExternalLink, ArrowRight, AlertTriangle, Search,
} from 'lucide-react'
import { audit, VERDICTS, verdictBucket, auditSummary, bigErrors, getUniversity } from '../data/store'
import { PageHeader, Flag } from '../components/ui'

function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default function Verification() {
  const [bucket, setBucket] = useState('all')
  const [q, setQ] = useState('')
  const summary = auditSummary()

  const filtered = useMemo(
    () =>
      audit.filter((a) => {
        if (bucket !== 'all' && a.bucket !== bucket) return false
        if (q) {
          const hay = `${a.scope} ${a.field} ${a.trackerValue} ${a.verified}`.toLowerCase()
          if (!hay.includes(q.toLowerCase())) return false
        }
        return true
      }),
    [bucket, q],
  )

  // group filtered by scope label
  const groups = useMemo(() => {
    const m = new Map()
    for (const a of filtered) {
      if (!m.has(a.scope)) m.set(a.scope, [])
      m.get(a.scope).push(a)
    }
    return [...m.entries()]
  }, [filtered])

  return (
    <div className="animate-fadeUp">
      <PageHeader
        title="Data Verification"
        subtitle={`${audit.length} figures checked against official university sources · 2026–27 cycle, verified Jun 2026`}
      />

      {/* trust banner */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-white shadow-soft">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15"><ShieldCheck size={26} /></div>
        <div className="flex-1">
          <div className="text-lg font-bold">Every figure was cross-checked with the source</div>
          <div className="text-sm text-emerald-100">Use this before quoting any tuition, deadline, test policy or scholarship to the student. Red = was wrong, now corrected.</div>
        </div>
      </div>

      {/* summary tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['all', 'All checks', audit.length, 'text-ink-600 bg-ink-100', '#637088'],
          ['wrong', VERDICTS.wrong.label, summary.wrong, 'text-rose-600 bg-rose-50', VERDICTS.wrong.hex],
          ['warning', VERDICTS.warning.label, summary.warning, 'text-amber-600 bg-amber-50', VERDICTS.warning.hex],
          ['correct', VERDICTS.correct.label, summary.correct, 'text-emerald-600 bg-emerald-50', VERDICTS.correct.hex],
        ].map(([key, label, val, tone]) => (
          <button
            key={key}
            onClick={() => setBucket(key)}
            className={`card p-5 text-left transition ${bucket === key ? 'ring-2 ring-brand-400' : 'hover:shadow-soft'}`}
          >
            <div className="flex items-center justify-between">
              <span className="label">{label}</span>
              <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm ${tone}`}>
                {key === 'all' ? '∑' : VERDICTS[key].emoji}
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold text-ink-900">{val}</div>
          </button>
        ))}
      </div>

      {/* biggest errors callout */}
      {bigErrors.length > 0 && (
        <div className="mb-6 card border-rose-200 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-rose-700">
            <AlertTriangle size={16} /> Biggest errors to fix first
          </h2>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {bigErrors.map((e, i) => (
              <li key={i} className="flex gap-2 rounded-xl bg-rose-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-700">
                <span className="font-bold text-rose-500">{i + 1}.</span> {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a school, field or value…"
            className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1">
          {[['all', 'All'], ['wrong', '❌'], ['warning', '⚠️'], ['correct', '✅'], ['note', 'ℹ️']].map(([k, l]) => (
            <button key={k} onClick={() => setBucket(k)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${bucket === k ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* grouped audit list */}
      <div className="space-y-6">
        {groups.map(([scope, items]) => {
          const uni = items[0].uniIds.length === 1 ? getUniversity(items[0].uniIds[0]) : null
          return (
            <div key={scope} className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-ink-100 bg-ink-50/50 px-5 py-3">
                <div className="flex items-center gap-2 font-bold text-ink-900">
                  {uni && <Flag country={uni.country} />} {scope}
                  {items[0].uniIds.length > 1 && <span className="chip bg-ink-100 text-ink-500">{items[0].uniIds.length} campuses</span>}
                </div>
                {uni && (
                  <Link to={`/university/${uni.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                    Open profile <ArrowRight size={13} />
                  </Link>
                )}
              </header>
              <ul className="divide-y divide-ink-100">
                {items.map((a) => <AuditRow key={a.id} a={a} />)}
              </ul>
            </div>
          )
        })}
        {groups.length === 0 && <div className="card p-10 text-center text-ink-400">No checks match your filters.</div>}
      </div>
    </div>
  )
}

export function AuditRow({ a }) {
  const v = verdictBucket(a.verdict)
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip border ${v.bg} ${v.text} ${v.border}`}>{v.emoji} {a.verdict}</span>
        <span className="text-sm font-bold text-ink-800">{a.field}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`rounded-xl border p-3 ${v.key === 'correct' ? 'border-ink-100 bg-ink-50/50' : 'border-rose-200 bg-rose-50/40'}`}>
          <div className="label mb-1 flex items-center gap-1">
            {v.key === 'correct' ? 'Tracker value' : 'Tracker said'}
          </div>
          <div className={`text-sm ${v.key === 'correct' ? 'text-ink-700' : 'text-rose-900/80 line-through decoration-rose-300'}`}>{a.trackerValue || '—'}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="label mb-1 text-emerald-600">Verified value</div>
          <div className="text-sm font-medium text-ink-800">{a.verified || '—'}</div>
        </div>
      </div>
      {a.source && (
        <a href={a.source} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
          <ExternalLink size={12} /> Official source
          <span className="font-normal text-ink-400">· {sourceHost(a.source)}</span>
        </a>
      )}
    </li>
  )
}
