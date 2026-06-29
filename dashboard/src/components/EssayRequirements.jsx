import { useState } from 'react'
import { PenLine, ExternalLink, BadgeCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { SectionCard } from './ui'

/* Layer A (§3.5) — the exact, verbatim official essay requirements, produced
 * and verified by the pipeline. Card UX: section + limit badge + "answer X of
 * Y" → Read more (full verbatim text) → source link + "✓ verified [date]". */

const PLATFORM = { common_app: 'Common App', uc: 'UC Application', coalition: 'Coalition', direct: 'Direct' }

function limitBadge(p) {
  if (p.word_limit) return `${p.word_limit} words`
  if (p.char_limit) return `${p.char_limit} chars`
  return null
}

function PromptItem({ p }) {
  const [open, setOpen] = useState(false)
  const text = String(p.prompt_text || '')
  const long = text.length > 170
  const shown = open || !long ? text : text.slice(0, 170).trimEnd() + '…'
  const lb = limitBadge(p)
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{shown}</p>
        {lb && <span className="chip shrink-0 bg-ink-100 text-ink-600">{lb}</span>}
      </div>
      {long && (
        <button onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
          {open ? <>Show less <ChevronUp size={12} /></> : <>Read more <ChevronDown size={12} /></>}
        </button>
      )}
    </li>
  )
}

export default function EssayRequirements({ requirements }) {
  if (!requirements || requirements.length === 0) return null

  // group by section, preserving published order
  const sections = []
  const idx = {}
  for (const r of requirements) {
    const key = r.section || '—'
    if (!(key in idx)) {
      idx[key] = sections.length
      sections.push({ name: key, choose_count: r.choose_count, choose_of: r.choose_of, conditions: r.conditions, platform: r.platform, prompts: [] })
    }
    sections[idx[key]].prompts.push(r)
  }
  const meta = requirements[0]
  const verifiedDate = meta.verified_at
    ? new Date(meta.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <SectionCard
      icon={PenLine}
      title="Official Essay Requirements"
      accent="emerald"
      action={<span className="chip bg-emerald-50 text-emerald-700"><BadgeCheck size={13} /> Verified{verifiedDate ? ` · ${verifiedDate}` : ''}</span>}
    >
      <div className="space-y-5">
        {sections.map((s, i) => (
          <div key={i}>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-ink-900">{s.name}</h4>
              {s.choose_count && <span className="chip bg-amber-50 text-amber-700">Answer {s.choose_count} of {s.choose_of}</span>}
              {s.platform && <span className="chip bg-ink-100 text-ink-500">{PLATFORM[s.platform] || s.platform}</span>}
            </div>
            {s.conditions && <p className="mb-1.5 text-xs italic text-ink-500">{s.conditions}</p>}
            <ul className="divide-y divide-ink-100">
              {s.prompts.map((p, j) => <PromptItem key={j} p={p} />)}
            </ul>
          </div>
        ))}
      </div>
      {meta.source_url && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
          <BadgeCheck size={13} className="text-emerald-500" /> Verified verbatim from
          <a href={meta.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
            official source <ExternalLink size={11} />
          </a>
          {meta.cycle_year && <span className="text-ink-400">· cycle {meta.cycle_year}</span>}
        </div>
      )}
    </SectionCard>
  )
}
