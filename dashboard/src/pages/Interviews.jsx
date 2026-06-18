import { Link } from 'react-router-dom'
import { Mic, Video, Users, Calendar, ChevronRight, AlertCircle } from 'lucide-react'
import { useData } from '../data/DataContext'
import { PageHeader, Flag, TierBadge, StatusBadge } from '../components/ui'

function formatIcon(fmt) {
  if (/video|online/i.test(fmt || '')) return Video
  if (/panel/i.test(fmt || '')) return Users
  if (/alumni/i.test(fmt || '')) return Users
  return Mic
}

export default function Interviews() {
  const { interviews } = useData()
  const required = interviews.filter((iv) => /required/i.test(iv.notes || '') || /required/i.test(iv.format || ''))
  const optional = interviews.filter((iv) => !required.includes(iv))

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Interview Tracker" subtitle={`${interviews.length} interviews to prepare, schedule and log`} />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="label">Total interviews</div>
          <div className="mt-2 text-3xl font-bold text-ink-900">{interviews.length}</div>
        </div>
        <div className="card border-rose-200 bg-rose-50 p-5">
          <div className="label text-rose-500">Required</div>
          <div className="mt-2 text-3xl font-bold text-rose-700">{required.length}</div>
          <div className="text-xs text-rose-600/80">must complete</div>
        </div>
        <div className="card p-5">
          <div className="label">Optional / recommended</div>
          <div className="mt-2 text-3xl font-bold text-ink-900">{optional.length}</div>
        </div>
      </div>

      {required.length > 0 && (
        <>
          <SubHead icon={AlertCircle} tone="text-rose-600">Required Interviews</SubHead>
          <div className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2">
            {required.map((iv) => <InterviewCard key={iv.id} iv={iv} required />)}
          </div>
        </>
      )}

      <SubHead icon={Mic} tone="text-ink-500">Optional / Recommended</SubHead>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {optional.map((iv) => <InterviewCard key={iv.id} iv={iv} />)}
      </div>
    </div>
  )
}

function SubHead({ icon: Icon, tone, children }) {
  return (
    <h2 className={`mb-3 flex items-center gap-2 text-sm font-bold ${tone}`}>
      <Icon size={16} /> {children}
    </h2>
  )
}

function InterviewCard({ iv, required }) {
  const Icon = formatIcon(iv.format)
  const u = iv.uni
  return (
    <div className={`card p-5 ${required ? 'border-l-4 border-l-rose-400' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-600">
            <Icon size={17} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-ink-900">
              {u && <Flag country={u.country} />} {iv.scope}
            </div>
            <div className="text-xs text-ink-500">{iv.format}</div>
          </div>
        </div>
        {u && <TierBadge tier={u.tier} />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3">
        <div>
          <div className="label flex items-center gap-1"><Calendar size={11} /> Date</div>
          <div className="mt-0.5 text-sm font-semibold text-ink-800">{iv.date || 'TBD'}</div>
        </div>
        <div>
          <div className="label">Prep status</div>
          <div className="mt-0.5"><span className="chip bg-amber-50 text-amber-700">{iv.prep || 'Not started'}</span></div>
        </div>
      </div>

      {iv.notes && <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{iv.notes}</p>}

      {u && (
        <Link to={`/university/${u.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
          Open {u.name.split(' ')[0]} profile <ChevronRight size={13} />
        </Link>
      )}
    </div>
  )
}
