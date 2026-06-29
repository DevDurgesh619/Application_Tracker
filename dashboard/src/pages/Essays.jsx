import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, FileText, ExternalLink, Layers } from 'lucide-react'
import { useData } from '../data/DataContext'
import { PageHeader, StatusBadge, Flag, Bar } from '../components/ui'

export default function Essays() {
  const { essays, essayUniIds, getUniversity } = useData()
  const [scope, setScope] = useState('All')

  // group scopes for filter chips
  const scopes = useMemo(() => ['All', ...Array.from(new Set(essays.map((e) => e.scope)))], [])

  const filtered = scope === 'All' ? essays : essays.filter((e) => e.scope === scope)

  const total = essays.length
  const done = essays.filter((e) => /complete|done|submitted/i.test(e.status)).length
  const pct = Math.round((done / total) * 100)

  // total word budget
  const totalWords = essays.reduce((s, e) => s + (typeof e.wordLimit === 'number' ? e.wordLimit : 0), 0)

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Essay Tracker" subtitle={`${total} essays across all schools · shared essays write once, reuse everywhere`} />

      {/* progress summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="label">Overall progress</div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-bold text-ink-900">{done}<span className="text-lg text-ink-400">/{total}</span></span>
            <span className="text-sm font-semibold text-brand-600">{pct}%</span>
          </div>
          <div className="mt-3"><Bar value={pct} /></div>
        </div>
        <div className="card p-5">
          <div className="label">Total word budget</div>
          <div className="mt-2 text-3xl font-bold text-ink-900">{totalWords.toLocaleString()}</div>
          <div className="mt-1 text-sm text-ink-500">words across fixed-length prompts</div>
        </div>
        <div className="card flex flex-col justify-center bg-brand-50 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><Layers size={16} /> Start here</div>
          <div className="mt-1 text-sm text-brand-900/80">Common App Personal Statement feeds 6 schools. UC PIQs (×4) cover all 6 UC campuses. Write the shared pieces first.</div>
        </div>
      </div>

      {/* scope filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        {scopes.map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              scope === s ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* essays table */}
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-400">
              <th className="px-5 py-3 font-semibold">Essay / Prompt</th>
              <th className="px-3 py-3 font-semibold">Applies to</th>
              <th className="px-3 py-3 font-semibold">Words</th>
              <th className="px-3 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.map((e) => {
              const ids = essayUniIds(e)
              return (
                <tr key={e.id} className="align-top transition hover:bg-ink-50/50">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-2">
                      <FileText size={15} className="mt-0.5 shrink-0 text-ink-400" />
                      <div>
                        {e.dbId
                          ? <Link to={`/essay/${e.dbId}`} className="font-semibold text-ink-800 hover:text-brand-700 hover:underline">{e.prompt}</Link>
                          : <div className="font-semibold text-ink-800">{e.prompt}</div>}
                        <div className="mt-0.5 text-xs font-medium text-brand-600">{e.scope}</div>
                        {e.themes && <p className="mt-1 max-w-md text-xs text-ink-500">{e.themes}</p>}
                        {e.notes && (
                          /^https?:/i.test(e.notes) ? (
                            <a href={e.notes} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                              <ExternalLink size={12} /> Prompt link
                            </a>
                          ) : (
                            <p className="mt-1 text-xs italic text-ink-400">{e.notes}</p>
                          )
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex max-w-[160px] flex-wrap gap-1">
                      {ids.length ? ids.map((id) => {
                        const u = getUniversity(id)
                        return (
                          <Link key={id} to={`/university/${id}`} title={u.name} className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600 hover:bg-brand-100 hover:text-brand-700">
                            <Flag country={u.country} /> {u.name.split(' ')[0]}
                          </Link>
                        )
                      }) : <span className="text-xs text-ink-400">{e.scope}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="font-semibold text-ink-700">{e.wordLimit}</span>
                  </td>
                  <td className="px-3 py-4"><StatusBadge status={e.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
