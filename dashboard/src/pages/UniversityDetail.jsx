import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CalendarClock, Wallet, BarChart3, GraduationCap, PenLine, Mic,
  Link2, StickyNote, ExternalLink, FileText, BadgeCheck,
  TestTube, Banknote, AlertTriangle, ShieldCheck,
} from 'lucide-react'
import {
  getUniversity, universities, essaysForUniversity, interviewsForUniversity,
  auditForUniversity,
  tier, country, fmtL, primaryDeadline, daysUntil,
} from '../data/store'
import { TierBadge, StatusBadge, SectionCard, Field, Flag, Empty } from '../components/ui'
import { AuditRow } from './Verification'

function CountdownPill({ uni }) {
  const d = primaryDeadline(uni)
  const days = daysUntil(d)
  if (days === null) return <span className="chip bg-ink-100 text-ink-500">Rolling / TBC</span>
  const tone =
    days < 0 ? 'bg-ink-100 text-ink-500'
    : days <= 30 ? 'bg-rose-50 text-rose-700'
    : days <= 90 ? 'bg-amber-50 text-amber-700'
    : 'bg-emerald-50 text-emerald-700'
  return (
    <span className={`chip ${tone}`}>
      <CalendarClock size={13} />
      {days < 0 ? 'Deadline passed' : `${days} days to deadline`}
    </span>
  )
}

const ML = ({ text }) =>
  String(text || '—')
    .split('\n')
    .map((line, i) => (
      <span key={i} className="block">
        {line}
      </span>
    ))

export default function UniversityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const u = getUniversity(id)
  if (!u) return <div className="card p-8 text-center text-ink-500">University not found.</div>

  const t = tier(u.tier)
  const c = country(u.country)
  const essays = essaysForUniversity(u.id)
  const ivs = interviewsForUniversity(u.id)
  const auditItems = auditForUniversity(u.id)
  const auditCounts = auditItems.reduce((m, a) => ((m[a.bucket] = (m[a.bucket] || 0) + 1), m), {})
  const idx = universities.findIndex((x) => x.id === u.id)
  const prev = universities[idx - 1]
  const next = universities[idx + 1]

  const isStem = /yes|✓/i.test(u.stemOpt || '')
  const noStem = /no|❌/i.test(u.stemOpt || '')

  const c2 = u.cost
  const costRows = [
    ['Tuition / yr', c2.tuition],
    ['Living costs / yr', c2.living],
    ['Other fees / yr', c2.other],
  ]

  return (
    <div className="animate-fadeUp">
      {/* breadcrumb / nav */}
      <div className="mb-5 flex items-center justify-between">
        <Link to="/universities" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
          <ArrowLeft size={16} /> All Universities
        </Link>
        <div className="flex items-center gap-1">
          {prev && (
            <button onClick={() => navigate(`/university/${prev.id}`)} className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50">
              ← {prev.name.split(' ')[0]}
            </button>
          )}
          {next && (
            <button onClick={() => navigate(`/university/${next.id}`)} className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50">
              {next.name.split(' ')[0]} →
            </button>
          )}
        </div>
      </div>

      {/* HERO */}
      <div className={`card mb-6 overflow-hidden border-l-4 ${t.border}`} style={{ borderLeftColor: t.hex }}>
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TierBadge tier={u.tier} size="lg" />
              <span className="chip bg-ink-100 text-ink-600">
                <Flag country={u.country} /> {c.label}
              </span>
              <span className="chip bg-ink-100 text-ink-600">#{u.num} on list</span>
            </div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-ink-900">
              {u.name}
            </h1>
            <p className="mt-1.5 flex items-center gap-2 text-base font-medium text-ink-600">
              <GraduationCap size={18} className="text-ink-400" /> {u.programme}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <CountdownPill uni={u} />
            <StatusBadge status={u.status} />
            {(auditCounts.wrong || auditCounts.warning) && (
              <a href="#verification" className="chip bg-rose-50 text-rose-700 hover:bg-rose-100">
                <AlertTriangle size={13} />
                {auditCounts.wrong ? `${auditCounts.wrong} corrected` : `${auditCounts.warning} to verify`}
              </a>
            )}
            {(isStem || noStem) && (
              <span className={`chip ${isStem ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {isStem ? <BadgeCheck size={13} /> : <AlertTriangle size={13} />}
                {isStem ? 'STEM-OPT eligible' : 'Not STEM-designated'}
              </span>
            )}
          </div>
        </div>

        {/* quick facts strip */}
        <div className="grid grid-cols-2 gap-px border-t border-ink-100 bg-ink-100 sm:grid-cols-4">
          {[
            ['Total / yr', fmtL(c2.total), 'text-ink-900'],
            ['4-yr total', fmtL(c2.fourYear), 'text-ink-900'],
            ['Test policy', u.tests, 'text-ink-900'],
            ['Aid policy', u.aidPolicy, 'text-ink-900'],
          ].map(([label, val, cl]) => (
            <div key={label} className="bg-white px-5 py-3.5">
              <div className="label">{label}</div>
              <div className={`mt-1 text-sm font-bold ${cl}`}>{val || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AGGREGATED GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Application & deadlines */}
          <SectionCard icon={CalendarClock} title="Application & Deadlines" accent="brand">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Field label="Key Deadline"><ML text={u.keyDeadline} /></Field>
              <Field label="Application Type"><ML text={u.applicationType} /></Field>
              <Field label="Platform">{u.appPlatform}</Field>
              <Field label="Decision Date"><ML text={u.decisionDate} /></Field>
              <Field label="Scholarship Deadline"><ML text={u.scholDeadline} /></Field>
              <Field label="Priority">{u.priority}</Field>
            </div>
          </SectionCard>

          {/* Admissions requirements */}
          <SectionCard icon={TestTube} title="Admissions & Requirements" accent="violet">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Field label="Entry Requirements">{u.entryRequirements}</Field>
              <Field label="Test Policy">{u.tests}</Field>
              <Field label="STEM-OPT">{u.stemOpt}</Field>
              <Field label="Interview">{u.interview}</Field>
              <Field label="Scholarship / Aid">{u.scholarship}</Field>
              <Field label="Aid Policy">{u.aidPolicy}</Field>
            </div>
          </SectionCard>

          {/* SAT */}
          <SectionCard icon={BarChart3} title="SAT & Stats" accent="amber">
            {u.sat ? (
              <SatPanel sat={u.sat} />
            ) : (
              <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-500">
                No SAT comparison — {u.country !== 'USA' ? `${u.country} uses a different assessment system (IB-based).` : 'no published percentile data.'}
              </div>
            )}
          </SectionCard>

          {/* Essays */}
          <SectionCard
            icon={PenLine}
            title={`Essays for ${u.name.split(' ')[0]}`}
            accent="emerald"
            action={<Link to="/essays" className="text-xs font-semibold text-brand-600 hover:underline">All essays →</Link>}
          >
            {essays.length ? (
              <ul className="divide-y divide-ink-100">
                {essays.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                        <FileText size={14} className="shrink-0 text-ink-400" /> {e.prompt}
                      </div>
                      {e.themes && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{e.themes}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="chip bg-ink-100 text-ink-600">{e.wordLimit} {typeof e.wordLimit === 'number' ? 'words' : ''}</span>
                      <StatusBadge status={e.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No school-specific essays recorded.</Empty>
            )}
          </SectionCard>

          {/* Interviews */}
          {ivs.length > 0 && (
            <SectionCard icon={Mic} title="Interviews" accent="rose">
              <ul className="space-y-3">
                {ivs.map((iv) => (
                  <li key={iv.id} className="rounded-xl border border-ink-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-800">{iv.format}</span>
                      <span className="chip bg-amber-50 text-amber-700">{iv.prep || 'Prep TBD'}</span>
                    </div>
                    {iv.notes && <p className="mt-1.5 text-xs text-ink-500">{iv.notes}</p>}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Data verification */}
          {auditItems.length > 0 && (
            <div id="verification" className="scroll-mt-6">
              <SectionCard
                icon={ShieldCheck}
                title="Data Verification"
                accent={auditCounts.wrong ? 'rose' : 'emerald'}
                action={<Link to="/verification" className="text-xs font-semibold text-brand-600 hover:underline">Full audit →</Link>}
              >
                <p className="-mt-1 mb-3 text-xs text-ink-500">
                  {auditItems.length} figure{auditItems.length > 1 ? 's' : ''} checked against official sources.
                  {auditCounts.wrong ? ` ${auditCounts.wrong} were wrong and corrected — verify before quoting to the student.` : ''}
                </p>
                <div className="-mx-5 -mb-5 divide-y divide-ink-100 border-t border-ink-100">
                  {auditItems.map((a) => <AuditRow key={a.id} a={a} />)}
                </div>
              </SectionCard>
            </div>
          )}
        </div>

        {/* RIGHT column (1/3) */}
        <div className="space-y-6">
          {/* Cost */}
          <SectionCard icon={Wallet} title="Cost Breakdown" accent="emerald">
            <div className="space-y-2.5">
              {costRows.map(([label, v]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">{label}</span>
                  <span className="font-semibold text-ink-800">{fmtL(v)}</span>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-ink-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-700">Total / yr</span>
                <span className="text-lg font-bold text-ink-900">{fmtL(c2.total)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                <span className="text-xs font-medium text-ink-500">4-year total</span>
                <span className="text-sm font-bold text-ink-800">{fmtL(c2.fourYear)}</span>
              </div>
              {c2.bestCase !== null && c2.bestCase !== c2.total && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="text-xs font-medium text-emerald-700">Best-case / yr (with aid)</span>
                  <span className="text-sm font-bold text-emerald-700">{fmtL(c2.bestCase)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 text-xs text-ink-400">
                <span>Application fee</span>
                <span className="font-medium text-ink-600">{c2.appFee === 'Free' ? 'Free' : c2.appFee ? `₹${Number(c2.appFee).toLocaleString('en-IN')}` : '—'}</span>
              </div>
            </div>
          </SectionCard>

          {/* Links */}
          <SectionCard icon={Link2} title="Official Links" accent="brand">
            <div className="space-y-2">
              {[
                ['Apply', u.links.apply, GraduationCap],
                ['Course / Programme', u.links.course, FileText],
                ['Aid / Scholarships', u.links.aid, Banknote],
              ].map(([label, href, Icon]) =>
                href ? (
                  <a key={label} href={href} target="_blank" rel="noreferrer"
                     className="group flex items-center justify-between rounded-xl border border-ink-100 px-3.5 py-2.5 text-sm transition-colors hover:border-brand-200 hover:bg-brand-50">
                    <span className="flex items-center gap-2.5 font-medium text-ink-700">
                      <Icon size={15} className="text-ink-400 group-hover:text-brand-600" /> {label}
                    </span>
                    <ExternalLink size={14} className="text-ink-300 group-hover:text-brand-600" />
                  </a>
                ) : null,
              )}
            </div>
          </SectionCard>

          {/* Counsellor notes */}
          <SectionCard icon={StickyNote} title="Counsellor Notes" accent="amber">
            <div className="rounded-xl bg-amber-50/60 p-4 text-sm leading-relaxed text-ink-700">
              {u.notes ? <ML text={u.notes} /> : <span className="text-ink-400">No notes yet.</span>}
            </div>
            {u.links.note && (
              <div className="mt-3 flex items-start gap-2 text-xs text-ink-500">
                <Link2 size={13} className="mt-0.5 shrink-0" /> {u.links.note}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function SatPanel({ sat }) {
  const lo = 1000, hi = 1600
  const span = hi - lo
  const pct = (v) => `${((v - lo) / span) * 100}%`
  const inRange = sat.yourScore >= sat.p25 && sat.yourScore <= sat.p75
  const above = sat.yourScore > sat.p75
  return (
    <div>
      <div className="mb-4 flex items-end gap-6">
        <div>
          <div className="label flex items-center gap-1.5">
            Mehek's score
            {sat.estimated && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">Est.</span>}
          </div>
          <div className="text-2xl font-bold text-ink-900">{sat.yourScore}</div>
        </div>
        <div>
          <div className="label">Mid-50% range</div>
          <div className="text-2xl font-bold text-ink-900">{sat.p25}–{sat.p75}</div>
        </div>
        <div className="ml-auto text-right">
          <span className={`chip ${above ? 'bg-emerald-50 text-emerald-700' : inRange ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
            {above ? 'Above 75th' : inRange ? 'In range' : 'Below 25th'}
          </span>
        </div>
      </div>
      {/* visual band */}
      <div className="relative mt-2 h-9">
        <div className="absolute inset-x-0 top-3.5 h-2 rounded-full bg-ink-100" />
        <div className="absolute top-3.5 h-2 rounded-full bg-brand-200" style={{ left: pct(sat.p25), width: `calc(${pct(sat.p75)} - ${pct(sat.p25)})` }} />
        {/* your score marker */}
        <div className="absolute -translate-x-1/2" style={{ left: pct(sat.yourScore) }}>
          <div className="h-9 w-0.5 bg-ink-900" />
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold text-white">{sat.yourScore}</div>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-ink-400">
        <span>{lo}</span><span>1300</span><span>1600</span>
      </div>
      {sat.estimated && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Score is an <strong>estimate</strong> (~{sat.yourScore}) — official SAT result pending. Gaps recalculate automatically once the real score is entered.
        </p>
      )}
      {sat.note && (
        <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">{sat.note}</p>
      )}
    </div>
  )
}
