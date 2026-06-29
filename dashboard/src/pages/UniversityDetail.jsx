import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CalendarClock, Wallet, BarChart3, GraduationCap, PenLine, Mic,
  Link2, StickyNote, ExternalLink, FileText, BadgeCheck,
  TestTube, Banknote, AlertTriangle, ShieldCheck, ChevronDown, Check, Loader2, History, ArrowRight, Pencil, X,
} from 'lucide-react'
import { tier, country, fmtMoney, primaryDeadline, daysUntil, STATUS, TIERS } from '../data/store'
import { useData } from '../data/DataContext'
import { fetchChangeLog } from '../data/mutations'
import { EDITABLE_FIELDS } from '../data/fields'
import { TierBadge, StatusBadge, SectionCard, Field, Flag, Empty } from '../components/ui'
import EssayRequirements from '../components/EssayRequirements'
import RequirementsChecklist from '../components/RequirementsChecklist'
import { AuditRow } from './Verification'

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const s = Math.round((Date.now() - then) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* Audit trail for this application — reads change_log, refreshes after each edit */
function ChangeHistory({ appId }) {
  const { editTick } = useData()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    fetchChangeLog(appId)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e?.message || 'Could not load history'))
    return () => {
      alive = false
    }
  }, [appId, editTick])

  return (
    <SectionCard icon={History} title="Change History" accent="ink">
      {error ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</div>
      ) : rows === null ? (
        <div className="flex items-center gap-2 py-2 text-sm text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Empty>No edits yet. Changes to status or tier will appear here.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-ink-700">
                  <span className="font-semibold">{EDITABLE_FIELDS[r.field]?.label || r.field}</span>
                  <span className="text-ink-400">changed</span>
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500 line-through">{r.old_value || '—'}</span>
                  <ArrowRight size={12} className="text-ink-300" />
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">{r.new_value || '—'}</span>
                </div>
                <div className="mt-0.5 text-xs text-ink-400">{timeAgo(r.at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

const STATUS_OPTIONS = Object.keys(STATUS)
const TIER_OPTIONS = Object.keys(TIERS)

/* Inline dropdown editor — renders a badge trigger; on select, saves and
 * shows a spinner. Closes on outside-click / Escape. `renderBadge(value)`
 * lets it reuse the existing TierBadge / StatusBadge styling. */
function InlineEditBadge({ value, options, onSave, renderBadge, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const opts = options.includes(value) || value == null ? options : [value, ...options]

  async function choose(opt) {
    setOpen(false)
    if (opt === value) return
    setSaving(true)
    setError(null)
    try {
      await onSave(opt)
    } catch (e) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className="group inline-flex items-center gap-1 rounded-full outline-none transition disabled:opacity-70"
        title="Click to edit"
      >
        {renderBadge(value)}
        {saving ? (
          <Loader2 size={12} className="animate-spin text-ink-400" />
        ) : (
          <ChevronDown size={12} className="text-ink-300 group-hover:text-ink-500" />
        )}
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1.5 w-48 rounded-xl border border-ink-100 bg-white p-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => choose(opt)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink-50"
            >
              {renderBadge(opt)}
              {opt === value && <Check size={14} className="shrink-0 text-brand-600" />}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className={`absolute top-full z-30 mt-1 w-48 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 shadow ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {error}
        </div>
      )}
    </div>
  )
}

/* Inline free-text editor — click to edit, Save/Cancel. Enter saves a
 * single-line field; Esc cancels. Used for priority, deadlines, notes. */
function EditableText({ value, onSave, multiline = false, placeholder = '—' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  async function commit() {
    if ((draft ?? '') === (value ?? '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (e) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }
  function cancel() {
    setDraft(value ?? '')
    setError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        {multiline ? (
          <textarea
            autoFocus
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && cancel()}
            className="w-full rounded-lg border border-brand-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-100"
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
              if (e.key === 'Escape') cancel()
            }}
            className="w-full rounded-lg border border-brand-300 bg-white px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-100"
          />
        )}
        {error && <div className="text-xs font-medium text-rose-600">{error}</div>}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-ink-50"
          >
            <X size={11} /> Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex w-full items-start gap-1.5 text-left"
      title="Click to edit"
    >
      <span className={`min-w-0 flex-1 ${value ? '' : 'text-ink-400'}`}>
        {value ? multiline ? <ML text={value} /> : value : placeholder}
      </span>
      <Pencil size={12} className="mt-0.5 shrink-0 text-ink-300 opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}

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

/* Small "✓ verified · source" marker for a catalog field published by the
 * verification pipeline (Pipeline E). `prov` = u.fieldProvenance[column]. */
function VerifiedBadge({ prov }) {
  if (!prov) return null
  const when = prov.verified_at ? new Date(prov.verified_at).toLocaleDateString() : ''
  const title = `Verified${when ? ` ${when}` : ''}${prov.cycle_year ? ` · ${prov.cycle_year}` : ''}${prov.quote ? `\n“${prov.quote}”` : ''}`
  const badge = (
    <span title={title} className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] font-bold text-emerald-600">
      <BadgeCheck size={11} /> verified
    </span>
  )
  return prov.source_url
    ? <a href={prov.source_url} target="_blank" rel="noreferrer" className="hover:underline">{badge}</a>
    : badge
}

export default function UniversityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getUniversity, universities, essaysForUniversity, interviewsForUniversity, auditForUniversity, editApplication } = useData()
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
  const cu = c2.usd || {}
  // all-USD breakdown; ✓ flags the verified official figure
  const costRows = [
    ['Tuition / yr', cu.tuition, cu.tuitionVerified],
    ['Living costs / yr', cu.living, false],
    ['Other fees / yr', cu.other, false],
  ]

  // editable free-text field (falls back to static render for read-only records)
  const ed = (field, value, multiline = false, fallback = null) =>
    u.appId ? (
      <EditableText value={value} multiline={multiline} onSave={(v) => editApplication(u.id, { [field]: v })} />
    ) : (
      fallback ?? value ?? '—'
    )

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
              {u.appId ? (
                <InlineEditBadge
                  value={u.tier}
                  options={TIER_OPTIONS}
                  onSave={(v) => editApplication(u.id, { tier: v })}
                  renderBadge={(v) => <TierBadge tier={v} size="lg" />}
                  align="left"
                />
              ) : (
                <TierBadge tier={u.tier} size="lg" />
              )}
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
            {u.appId ? (
              <InlineEditBadge
                value={u.status}
                options={STATUS_OPTIONS}
                onSave={(v) => editApplication(u.id, { status: v })}
                renderBadge={(v) => <StatusBadge status={v} />}
                align="right"
              />
            ) : (
              <StatusBadge status={u.status} />
            )}
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
            ['Total / yr', fmtMoney(c2.usd?.total, 'USD'), 'text-ink-900'],
            ['4-yr total', fmtMoney(c2.usd?.fourYear, 'USD'), 'text-ink-900'],
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
              <Field label="Key Deadline">{ed('keyDeadline', u.keyDeadline, true, <ML text={u.keyDeadline} />)}</Field>
              <Field label="Application Type"><ML text={u.applicationType} /></Field>
              <Field label="Platform">{u.appPlatform}</Field>
              <Field label="Decision Date">{ed('decisionDate', u.decisionDate, false, <ML text={u.decisionDate} />)}</Field>
              <Field label="Scholarship Deadline">{ed('scholDeadline', u.scholDeadline, false, <ML text={u.scholDeadline} />)}</Field>
              <Field label="Priority">{ed('priority', u.priority)}</Field>
            </div>
            {u.verifiedDeadlines?.length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <BadgeCheck size={13} /> Verified official deadlines
                </div>
                <ul className="space-y-1">
                  {u.verifiedDeadlines.map((d) => (
                    <li key={d.id} className="text-sm text-ink-700">{d.deadline_text || d.round}</li>
                  ))}
                </ul>
                {u.verifiedDeadlines[0].source_url && (
                  <a href={u.verifiedDeadlines[0].source_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                    source <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}
          </SectionCard>

          {/* Admissions requirements */}
          <SectionCard icon={TestTube} title="Admissions & Requirements" accent="violet">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Field label="Entry Requirements">{u.entryRequirements}</Field>
              <Field label="Test Policy">{u.tests || '—'}<VerifiedBadge prov={u.fieldProvenance?.test_policy} /></Field>
              <Field label="Admit Rate">{u.admitRate != null ? `${u.admitRate}%` : '—'}<VerifiedBadge prov={u.fieldProvenance?.admit_rate} /></Field>
              <Field label="STEM-OPT">{u.stemOpt}</Field>
              <Field label="Interview">{u.interview}</Field>
              <Field label="Scholarship / Aid">{u.scholarship}</Field>
              <Field label="Aid Policy">{u.aidPolicy || '—'}<VerifiedBadge prov={u.fieldProvenance?.aid_policy} /></Field>
            </div>
          </SectionCard>

          {/* Requirements checklist (drives derived completion %) */}
          {u.appId && <RequirementsChecklist appId={u.appId} />}

          {/* Admission test — track-aware (SAT for undergrad, LSAT/GMAT for law/mba) */}
          {(u.track || 'undergrad') === 'undergrad' ? (
            <SectionCard icon={BarChart3} title="SAT & Stats" accent="amber" action={<VerifiedBadge prov={u.fieldProvenance?.sat_p25} />}>
              {u.sat ? (
                <SatPanel sat={u.sat} />
              ) : (
                <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-500">
                  No SAT comparison — {u.country !== 'USA' ? `${u.country} uses a different assessment system (IB-based).` : 'no published percentile data.'}
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionCard icon={BarChart3} title={`${u.test?.type || 'Admission Test'} & Stats`} accent="amber" action={<VerifiedBadge prov={u.fieldProvenance?.admission_tests} />}>
              {u.test && (u.test.median != null || u.test.p25 != null || u.test.yourScore != null) ? (
                <TestPanel test={u.test} />
              ) : (
                <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-500">
                  No published {u.test?.type || 'test'} data yet for this school.
                </div>
              )}
            </SectionCard>
          )}

          {/* Official, verified essay requirements (pipeline Layer A) */}
          <EssayRequirements requirements={u.essayRequirements} />

          {/* Student's essay drafts/tracker */}
          <SectionCard
            icon={PenLine}
            title={`Essays for ${u.name.split(' ')[0]}`}
            accent="emerald"
            action={<Link to="/essays" className="text-xs font-semibold text-brand-600 hover:underline">All essays →</Link>}
          >
            {essays.length ? (
              <ul className="divide-y divide-ink-100">
                {essays.map((e) => {
                  const Row = (
                    <>
                      <div className="min-w-0">
                        <div className="flex items-start gap-2 text-sm font-semibold text-ink-800">
                          <FileText size={14} className="mt-0.5 shrink-0 text-ink-400" />
                          <span className="line-clamp-2">{e.prompt}</span>
                          {e.dbId && <span className="shrink-0 text-xs font-normal text-brand-600 opacity-0 transition group-hover:opacity-100">Open workspace →</span>}
                        </div>
                        {e.themes && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{e.themes}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="chip bg-ink-100 text-ink-600">{e.wordLimit} {typeof e.wordLimit === 'number' ? 'words' : ''}</span>
                        <StatusBadge status={e.status} />
                      </div>
                    </>
                  )
                  return e.dbId ? (
                    <li key={e.id}>
                      <Link to={`/essay/${e.dbId}`} className="group -mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-ink-50">{Row}</Link>
                    </li>
                  ) : (
                    <li key={e.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">{Row}</li>
                  )
                })}
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
          {/* Cost — all USD; ✓ marks the verified official figure */}
          <SectionCard icon={Wallet} title="Cost Breakdown" accent="emerald"
            action={cu.verified ? <VerifiedBadge prov={u.fieldProvenance?.cost_reference} /> : null}>
            {cu.verified && c2.verified?.cycleYear && (
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <BadgeCheck size={13} /> Verified official cost · {c2.verified.cycleYear}
                {c2.verified.currency && c2.verified.currency !== 'USD' && <span className="font-normal text-ink-400">(converted from {c2.verified.currency})</span>}
              </div>
            )}
            <div className="space-y-2.5">
              {costRows.map(([label, v, ver]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">{label}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-800">
                    {ver && <span title="verified official figure" className="text-emerald-500">✓</span>}{fmtMoney(v, 'USD')}
                  </span>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-ink-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-700">Total / yr</span>
                <span className="inline-flex items-center gap-1 text-lg font-bold text-ink-900">
                  {cu.totalVerified && <span title="verified official figure" className="text-base text-emerald-500">✓</span>}{fmtMoney(cu.total, 'USD')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                <span className="text-xs font-medium text-ink-500">4-year total</span>
                <span className="text-sm font-bold text-ink-800">{fmtMoney(cu.fourYear, 'USD')}</span>
              </div>
              {cu.best != null && cu.best !== cu.total && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="text-xs font-medium text-emerald-700">Best-case / yr (with aid)</span>
                  <span className="text-sm font-bold text-emerald-700">{fmtMoney(cu.best, 'USD')}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 text-xs text-ink-400">
                <span>Application fee</span>
                <span className="font-medium text-ink-600">{cu.appFee === 'Free' ? 'Free' : cu.appFee != null ? fmtMoney(cu.appFee, 'USD') : '—'}</span>
              </div>
              {c2.verified?.sourceUrl && (
                <a href={c2.verified.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-brand-600 hover:underline">
                  official source <ExternalLink size={11} />
                </a>
              )}
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
              {ed('notes', u.notes, true, u.notes ? <ML text={u.notes} /> : <span className="text-ink-400">No notes yet.</span>)}
            </div>
            {u.links.note && (
              <div className="mt-3 flex items-start gap-2 text-xs text-ink-500">
                <Link2 size={13} className="mt-0.5 shrink-0" /> {u.links.note}
              </div>
            )}
          </SectionCard>

          {/* Change history (audit trail) */}
          {u.appId && <ChangeHistory appId={u.appId} />}
        </div>
      </div>
    </div>
  )
}

/* Generalized admission-test panel for law/mba (LSAT/GMAT/GRE). Scale-agnostic:
 * shows the student's score, the school's median + mid-50% range, and a
 * verdict vs the median. Mirrors SatPanel's read but without the 1600 scale. */
function TestPanel({ test }) {
  const has = (v) => v != null
  const atOrAbove = has(test.yourScore) && has(test.median) && test.yourScore >= test.median
  return (
    <div>
      <div className="flex flex-wrap items-end gap-6">
        {has(test.yourScore) && (
          <div>
            <div className="label">Your {test.type}</div>
            <div className="text-2xl font-bold text-ink-900">{test.yourScore}</div>
          </div>
        )}
        {has(test.median) && (
          <div>
            <div className="label">Median {test.type}</div>
            <div className="text-2xl font-bold text-ink-900">{test.median}</div>
          </div>
        )}
        {has(test.p25) && has(test.p75) && (
          <div>
            <div className="label">Mid-50% range</div>
            <div className="text-2xl font-bold text-ink-900">{test.p25}–{test.p75}</div>
          </div>
        )}
        {has(test.yourScore) && has(test.median) && (
          <span className={`chip ml-auto ${atOrAbove ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {atOrAbove ? 'At/above median' : 'Below median'}
          </span>
        )}
      </div>
      {!has(test.yourScore) && (
        <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          No {test.type} score on file for this student yet — add it to the profile to see the gap.
        </p>
      )}
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
