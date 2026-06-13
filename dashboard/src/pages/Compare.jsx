import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, Columns3, ChevronRight } from 'lucide-react'
import {
  universities, getUniversity, tier, country, fmtL, primaryDeadline, daysUntil, fmtDate,
} from '../data/store'
import { PageHeader, TierBadge, Flag } from '../components/ui'

const ROWS = [
  { key: 'tier', label: 'Tier', render: (u) => <TierBadge tier={u.tier} /> },
  { key: 'country', label: 'Country', render: (u) => <span className="flex items-center gap-1.5 text-sm font-medium"><Flag country={u.country} /> {country(u.country).label}</span> },
  { key: 'programme', label: 'Programme', render: (u) => <span className="text-sm">{u.programme}</span> },
  { key: 'deadline', label: 'Key deadline', render: (u) => { const d = primaryDeadline(u); const days = daysUntil(d); return <span className="text-sm"><span className="font-semibold">{d ? fmtDate(d) : 'Rolling'}</span>{days != null && <span className="block text-xs text-ink-400">{days < 0 ? 'passed' : `${days} days`}</span>}</span> } },
  { key: 'appType', label: 'Application type', render: (u) => <span className="text-sm">{firstLine(u.applicationType)}</span> },
  { key: 'platform', label: 'Platform', render: (u) => <span className="text-sm">{u.appPlatform}</span> },
  { key: 'tests', label: 'Test policy', render: (u) => <span className="text-sm">{u.tests}</span> },
  { key: 'entry', label: 'Entry req.', render: (u) => <span className="text-sm">{u.entryRequirements}</span> },
  { key: 'stem', label: 'STEM-OPT', render: (u) => <Yn v={u.stemOpt} /> },
  { key: 'interview', label: 'Interview', render: (u) => <span className="text-sm">{u.interview}</span> },
  { key: 'aid', label: 'Aid policy', render: (u) => <span className="text-sm">{u.aidPolicy}</span> },
  { key: 'scholarship', label: 'Scholarship', render: (u) => <span className="text-sm">{u.scholarship}</span> },
  { key: 'tuition', label: 'Tuition / yr', render: (u) => <Money v={u.cost.tuition} all={(c) => c.tuition} u={u} /> },
  { key: 'total', label: 'Total / yr', render: (u) => <Money v={u.cost.total} bold all={(c) => c.total} u={u} /> },
  { key: 'best', label: 'Best-case / yr', render: (u) => <span className="text-sm font-medium text-emerald-600">{u.cost.bestCase != null ? fmtL(u.cost.bestCase) : '—'}</span> },
  { key: 'fourYear', label: '4-year total', render: (u) => <Money v={u.cost.fourYear} all={(c) => c.fourYear} u={u} /> },
]

function firstLine(s) { return String(s || '').split('\n')[0] }
function Yn({ v }) {
  const yes = /yes|✓/i.test(v || '')
  const no = /no|❌/i.test(v || '')
  return <span className={`chip ${yes ? 'bg-emerald-50 text-emerald-700' : no ? 'bg-rose-50 text-rose-700' : 'bg-ink-100 text-ink-500'}`}>{v}</span>
}
function Money({ v, bold }) {
  return <span className={`text-sm tabular-nums ${bold ? 'font-bold text-ink-900' : 'text-ink-700'}`}>{fmtL(v)}</span>
}

export default function Compare() {
  const [selected, setSelected] = useState(['yale-university', 'university-of-michigan', 'ashoka-university'])
  const [picker, setPicker] = useState(false)

  const cols = selected.map(getUniversity).filter(Boolean)

  const add = (id) => { if (!selected.includes(id) && selected.length < 5) setSelected([...selected, id]); setPicker(false) }
  const remove = (id) => setSelected(selected.filter((s) => s !== id))

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Compare Universities" subtitle="Place up to 5 schools side by side — every field from the master record" />

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-44 border-b border-r border-ink-100 bg-white px-4 py-4 text-left align-bottom">
                <span className="label">Field</span>
              </th>
              {cols.map((u) => (
                <th key={u.id} className="min-w-[200px] border-b border-ink-100 bg-white p-4 text-left align-top">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/university/${u.id}`} className="group">
                      <div className="text-2xl">{country(u.country).flag}</div>
                      <div className="mt-1 font-bold leading-snug text-ink-900 group-hover:text-brand-600">{u.name}</div>
                    </Link>
                    <button onClick={() => remove(u.id)} className="rounded-lg p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500">
                      <X size={15} />
                    </button>
                  </div>
                </th>
              ))}
              {selected.length < 5 && (
                <th className="min-w-[180px] border-b border-ink-100 bg-white p-4 align-top">
                  <button onClick={() => setPicker((p) => !p)} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 py-6 text-sm font-semibold text-ink-400 hover:border-brand-300 hover:text-brand-600">
                    <Plus size={16} /> Add school
                  </button>
                  {picker && (
                    <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-ink-100 bg-white p-1 shadow-lift">
                      {universities.filter((u) => !selected.includes(u.id)).map((u) => (
                        <button key={u.id} onClick={() => add(u.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-ink-50">
                          <Flag country={u.country} /> <span className="truncate">{u.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={row.key} className={ri % 2 ? 'bg-ink-50/40' : ''}>
                <td className="sticky left-0 z-10 border-r border-ink-100 bg-inherit px-4 py-3 align-top">
                  <span className="text-xs font-semibold text-ink-500">{row.label}</span>
                </td>
                {cols.map((u) => (
                  <td key={u.id} className="px-4 py-3 align-top">{row.render(u)}</td>
                ))}
                {selected.length < 5 && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cols.length === 0 && (
        <div className="card mt-4 flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Columns3 size={32} /> Add schools above to start comparing.
        </div>
      )}
    </div>
  )
}
