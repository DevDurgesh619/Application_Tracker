import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Database, ShieldCheck, AlertTriangle, FileText, CalendarClock,
  ChevronRight, CheckCircle2, Circle, Loader2, RefreshCw,
  GraduationCap, DollarSign, Percent, Wallet, ClipboardCheck, Check, X,
} from 'lucide-react'
import { listSources, listQueue, listProposedSources, confirmSource, rejectSource } from './api'

const FACT_ICON = {
  essay: FileText, deadline: CalendarClock, sat: GraduationCap, test_policy: ClipboardCheck,
  admit_rate: Percent, cost: Wallet, scholarship: DollarSign,
}

function sourceState(s) {
  if (!s.latest) return { label: 'not fetched', tone: 'bg-ink-100 text-ink-500', Icon: Circle }
  if (s.latest.error) return { label: `fetch error`, tone: 'bg-rose-50 text-rose-700', Icon: AlertTriangle }
  if (s.draft?.status === 'approved') return { label: 'published', tone: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 }
  if (s.draft?.status === 'needs_review') return { label: 'needs review', tone: 'bg-amber-50 text-amber-700', Icon: AlertTriangle }
  if (s.draft) return { label: 'draft staged', tone: 'bg-brand-50 text-brand-700', Icon: FileText }
  return { label: 'captured (no draft)', tone: 'bg-violet-50 text-violet-700', Icon: Circle }
}

export default function CuratorBoard() {
  const [sources, setSources] = useState(null)
  const [queue, setQueue] = useState([])
  const [proposed, setProposed] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const flash = useLocation().state?.flash

  async function load() {
    setBusy(true); setError(null)
    try {
      const [s, q, p] = await Promise.all([listSources(), listQueue(), listProposedSources()])
      setSources(s); setQueue(q); setProposed(p)
    } catch (e) { setError(e?.message || 'Failed to load') }
    finally { setBusy(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="animate-fadeUp">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-600">
            <Database size={16} /> Data Curator
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Verification &amp; Publishing</h1>
          <p className="mt-1 text-sm text-ink-500">Review machine-extracted facts against the official source, then publish to the live catalog.</p>
        </div>
        <button onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh
        </button>
      </div>

      {flash && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{flash}</div>}
      {error && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</div>}

      {/* QUEUE — needs attention */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900">
          <ShieldCheck size={16} className="text-brand-600" /> Review queue
          <span className="chip bg-ink-100 text-ink-600">{queue.length}</span>
        </h2>
        {queue.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">Nothing awaiting review. Staged drafts appear here.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {queue.map((q) => {
              const Icon = FACT_ICON[q.fact_type] || FileText
              return (
                <Link key={q.id} to={`/curator/review/${q.id}`} className="card group flex items-center gap-3 p-4 transition hover:shadow-soft">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink-900">{q.university_name}</div>
                    <div className="text-xs text-ink-500 capitalize">{q.fact_type}{q.platform ? ` · ${q.platform}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.integrity_ok === false && <span className="chip bg-amber-50 text-amber-700"><AlertTriangle size={12} /> verbatim</span>}
                    <span className={`chip ${q.status === 'needs_review' ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>{q.status.replace('_', ' ')}</span>
                    <ChevronRight size={16} className="text-ink-300 group-hover:text-brand-600" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* PROPOSED SOURCES — confirm the right url before any scrape */}
      {proposed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-900">
            <ClipboardCheck size={16} className="text-violet-600" /> Proposed sources
            <span className="chip bg-violet-50 text-violet-700">{proposed.length}</span>
          </h2>
          <p className="mb-3 text-xs text-ink-400">Auto-discovered URLs (firecrawl map). Confirm or fix each before fetching — only confirmed sources are scraped.</p>
          <div className="card divide-y divide-ink-100 overflow-hidden">
            {proposed.map((p) => (
              <ProposedRow key={p.id} p={p} onChange={load} onError={setError} />
            ))}
          </div>
        </section>
      )}

      {/* COVERAGE BOARD */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">Coverage board</h2>
        {sources === null ? (
          <div className="card p-6 text-center text-sm text-ink-400"><Loader2 size={16} className="mx-auto animate-spin" /></div>
        ) : sources.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">
            No sources registered. Use <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">scripts/pipeline/register-source.mjs</code>.
          </div>
        ) : (
          <div className="card divide-y divide-ink-100 overflow-hidden">
            {sources.map((s) => {
              const st = sourceState(s)
              const Icon = FACT_ICON[s.fact_type] || FileText
              const reviewable = s.draft && s.draft.status !== 'approved'
              const inner = (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Icon size={16} className="shrink-0 text-ink-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink-800">{s.university?.name || 'university-agnostic'}</div>
                    <div className="truncate text-xs text-ink-400">{s.fact_type}{s.platform ? ` · ${s.platform}` : ''} · {s.source_url}</div>
                  </div>
                  <span className={`chip ${st.tone}`}><st.Icon size={12} /> {st.label}</span>
                  {reviewable && <ChevronRight size={16} className="text-ink-300" />}
                </div>
              )
              return reviewable
                ? <Link key={s.id} to={`/curator/review/${s.draft.id}`} className="block transition hover:bg-ink-50">{inner}</Link>
                : <div key={s.id}>{inner}</div>
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-400">
          Fetch &amp; extract run via the pipeline CLI (<code className="rounded bg-ink-100 px-1 py-0.5">fetch-source</code> → <code className="rounded bg-ink-100 px-1 py-0.5">extract-snapshot</code>). A one-click “fetch now” button arrives with Edge Functions in Pipeline D.
        </p>
      </section>
    </div>
  )
}

function ProposedRow({ p, onChange, onError }) {
  const Icon = FACT_ICON[p.fact_type] || FileText
  const candidates = Array.isArray(p.candidate_urls) ? p.candidate_urls : [p.source_url]
  const [url, setUrl] = useState(p.source_url)
  const [busy, setBusy] = useState(null)

  const run = async (fn, kind) => {
    setBusy(kind); onError(null)
    try { await fn(); await onChange() }
    catch (e) { onError(e?.message || 'Action failed'); setBusy(null) }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Icon size={16} className="shrink-0 text-ink-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-800">{p.university_name} <span className="font-normal text-ink-400">· {p.fact_type}</span></div>
        <div className="mt-1 flex items-center gap-2">
          <select value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-ink-200 px-2 py-1 text-xs text-ink-700 outline-none focus:ring-2 focus:ring-brand-100">
            {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
            {!candidates.includes(url) && <option value={url}>{url}</option>}
          </select>
          <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-brand-600 hover:underline">open</a>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={() => run(() => confirmSource(p.id, url), 'confirm')} disabled={!!busy}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy === 'confirm' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirm
        </button>
        <button onClick={() => run(() => rejectSource(p.id), 'reject')} disabled={!!busy}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
          {busy === 'reject' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Reject
        </button>
      </div>
    </div>
  )
}
