import { Award, Trophy, Briefcase, Sparkles, Target } from 'lucide-react'
import { activities, honors } from '../data/store'
import { PageHeader } from '../components/ui'

export default function Activities() {
  return (
    <div className="animate-fadeUp">
      <PageHeader title="Activities & Honors" subtitle={`${activities.length} activities · ${honors.length} honors — Common App allows 10 activities + 5 honors`} />

      {/* note banner */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-800 px-5 py-4 text-white">
        <Target size={20} />
        <div className="text-sm">
          <span className="font-bold">Common App limits:</span> pick the strongest <span className="font-bold">10 activities</span> and top <span className="font-bold">5 of {honors.length} honors</span>.
        </div>
      </div>

      {/* Activities */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700"><Briefcase size={16} /> Activities</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {activities.map((a, i) => (
          <div key={a.id} className="card group p-5 transition hover:shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-600">{i + 1}</div>
                <div>
                  <h3 className="font-bold leading-snug text-ink-900">{a.name}</h3>
                  <div className="mt-0.5 text-xs font-medium text-ink-500">{a.org}</div>
                </div>
              </div>
            </div>
            {a.position && (
              <div className="mt-3 inline-block rounded-lg bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-600">{a.position}</div>
            )}
            {a.description && <p className="mt-3 text-sm leading-relaxed text-ink-600">{a.description}</p>}
            {a.impact && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {String(a.impact).split('|').map((chip, j) => (
                  <span key={j} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <Sparkles size={11} /> {chip.trim()}
                  </span>
                ))}
              </div>
            )}
            {a.skills && (
              <p className="mt-3 border-t border-ink-100 pt-2.5 text-xs text-ink-400">
                <span className="font-semibold text-ink-500">Skills:</span> {a.skills}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Honors */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700"><Trophy size={16} /> Honors & Awards</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {honors.map((h) => (
          <div key={h.id} className="card relative overflow-hidden p-5">
            <div className="absolute right-0 top-0 h-16 w-16 -translate-y-6 translate-x-6 rounded-full bg-amber-100/60" />
            <div className="relative">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><Award size={20} /></div>
              <h3 className="mt-3 font-bold leading-snug text-ink-900">{h.name}</h3>
              <div className="mt-0.5 text-xs font-medium text-ink-500">{h.body}</div>
              {h.level && <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">{h.level}</span>}
              {h.why && <p className="mt-3 text-xs leading-relaxed text-ink-500">{h.why}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
