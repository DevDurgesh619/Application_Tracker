import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, ShieldCheck, AlertTriangle, CheckCircle2,
  Loader2, Save, Send, XCircle, FileText,
} from 'lucide-react'
import { getDraft, saveDraftJson, publishDraft, rejectDraft } from './api'
import { verbatimCheck } from './verbatim'

const SCALAR_FACTS = new Set(['sat', 'test_policy', 'admit_rate', 'cost', 'scholarship'])

export default function ReviewDraft() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bundle, setBundle] = useState(null)
  const [json, setJson] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null) // 'save' | 'publish' | 'reject'
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    let alive = true
    getDraft(id)
      .then((b) => { if (alive) { setBundle(b); setJson(structuredClone(b.draft.extracted_json || {})) } })
      .catch((e) => alive && setError(e?.message || 'Failed to load draft'))
    return () => { alive = false }
  }, [id])

  const markdown = bundle?.snapshot?.raw_markdown || ''
  const factType = bundle?.draft?.fact_type
  const gate = useMemo(
    () => (json ? verbatimCheck(factType, json, markdown) : { ok: false, issues: [], checked: 0, failedPaths: new Set() }),
    [json, markdown, factType],
  )

  if (error) return <div className="card p-8 text-center text-rose-600">{error}</div>
  if (!bundle || !json) return <div className="grid h-64 place-items-center text-ink-400"><Loader2 className="animate-spin" /></div>

  const { draft, snapshot, source, university } = bundle
  const published = draft.status === 'approved'

  /* immutable updaters */
  const setSection = (i, key, v) => setJson((j) => { const c = structuredClone(j); c.sections[i][key] = v; return c })
  const setPrompt = (i, k, key, v) => setJson((j) => { const c = structuredClone(j); c.sections[i].prompts[k][key] = v; return c })
  const setRound = (i, key, v) => setJson((j) => { const c = structuredClone(j); c.rounds[i][key] = v; return c })
  const setTop = (key, v) => setJson((j) => ({ ...j, [key]: v }))

  async function doSave() {
    setBusy('save'); setError(null); setFlash(null)
    try { await saveDraftJson(id, json, gate); setFlash('Saved.') }
    catch (e) { setError(e?.message || 'Save failed') }
    finally { setBusy(null) }
  }
  async function doPublish() {
    if (!gate.ok) return
    setBusy('publish'); setError(null); setFlash(null)
    try {
      await saveDraftJson(id, json, gate)
      const { published: n } = await publishDraft({ draft: { ...draft, extracted_json: json }, source })
      navigate('/curator', { state: { flash: `Published ${n} ${factType} record${n === 1 ? '' : 's'} for ${university?.name || 'university'}.` } })
    } catch (e) { setError(e?.message || 'Publish failed'); setBusy(null) }
  }
  async function doReject() {
    const notes = window.prompt('Reject this draft — reason (optional):') ?? null
    setBusy('reject'); setError(null)
    try { await rejectDraft(id, notes); navigate('/curator') }
    catch (e) { setError(e?.message || 'Reject failed'); setBusy(null) }
  }

  return (
    <div className="animate-fadeUp">
      <Link to="/curator" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft size={16} /> Curator board
      </Link>

      {/* header */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink-900">{university?.name || 'University'}</h1>
              <span className="chip bg-ink-100 text-ink-600 capitalize">{factType}{source.platform ? ` · ${source.platform}` : ''}</span>
              {published && <span className="chip bg-emerald-50 text-emerald-700"><CheckCircle2 size={12} /> published</span>}
            </div>
            <a href={source.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
              {source.source_url} <ExternalLink size={13} />
            </a>
            <div className="mt-1 text-xs text-ink-400">
              snapshot {snapshot?.id?.slice(0, 8)} · fetched {snapshot?.fetched_at ? new Date(snapshot.fetched_at).toLocaleString() : '—'} · status {snapshot?.http_status ?? '—'}
            </div>
          </div>
          {/* integrity banner */}
          <div className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${gate.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {gate.ok
              ? <span className="flex items-center gap-1.5"><ShieldCheck size={15} /> Verbatim OK — {gate.checked} fields match</span>
              : <span className="flex items-center gap-1.5"><AlertTriangle size={15} /> {gate.issues.length} field(s) not in source</span>}
          </div>
        </div>
      </div>

      {(error || flash) && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${error ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>{error || flash}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEFT — raw snapshot (the source of truth to verify against) */}
        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-900">
            <FileText size={15} className="text-ink-400" /> Snapshot (verbatim source)
          </div>
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-ink-700">{markdown}</pre>
        </div>

        {/* RIGHT — editable structured fields */}
        <div className="space-y-4">
          {factType === 'essay' && (json.sections || []).map((sec, i) => (
            <div key={i} className="card p-4">
              <EditField label="Section name" value={sec.section_name} path={`sections[${i}].section_name`} failed={gate.failedPaths} onChange={(v) => setSection(i, 'section_name', v)} />
              <div className="mt-3"><EditField label="Instructions" value={sec.instructions_text} path={`sections[${i}].instructions_text`} failed={gate.failedPaths} multiline onChange={(v) => setSection(i, 'instructions_text', v)} /></div>
              <div className="mt-3"><EditField label="Conditions" value={sec.conditions} path={`sections[${i}].conditions`} failed={gate.failedPaths} onChange={(v) => setSection(i, 'conditions', v)} /></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <EditField label="Choose" value={sec.choose_count} type="number" verbatim={false} onChange={(v) => setSection(i, 'choose_count', v)} />
                <EditField label="Of" value={sec.choose_of} type="number" verbatim={false} onChange={(v) => setSection(i, 'choose_of', v)} />
                <EditField label="Char limit" value={sec.char_limit} type="number" verbatim={false} onChange={(v) => setSection(i, 'char_limit', v)} />
              </div>
              <div className="mt-4 space-y-3 border-t border-ink-100 pt-3">
                <div className="label">Prompts ({sec.prompts?.length || 0})</div>
                {(sec.prompts || []).map((p, k) => (
                  <div key={k} className="rounded-lg bg-ink-50/60 p-3">
                    <EditField label={`Prompt ${k + 1}`} value={p.prompt_text} path={`sections[${i}].prompts[${k}].prompt_text`} failed={gate.failedPaths} multiline onChange={(v) => setPrompt(i, k, 'prompt_text', v)} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <EditField label="Word limit" value={p.word_limit} type="number" verbatim={false} onChange={(v) => setPrompt(i, k, 'word_limit', v)} />
                      <EditField label="Char limit" value={p.char_limit} type="number" verbatim={false} onChange={(v) => setPrompt(i, k, 'char_limit', v)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {factType === 'deadline' && (json.rounds || []).map((r, i) => (
            <div key={i} className="card p-4">
              <EditField label="Round" value={r.label} path={`rounds[${i}].label`} failed={gate.failedPaths} onChange={(v) => setRound(i, 'label', v)} />
              <div className="mt-3"><EditField label="Deadline text (verbatim)" value={r.deadline_text} path={`rounds[${i}].deadline_text`} failed={gate.failedPaths} onChange={(v) => setRound(i, 'deadline_text', v)} /></div>
              <div className="mt-3"><EditField label="Date phrase" value={r.date_phrase} path={`rounds[${i}].date_phrase`} failed={gate.failedPaths} onChange={(v) => setRound(i, 'date_phrase', v)} /></div>
            </div>
          ))}

          {SCALAR_FACTS.has(factType) && (
            <div className="card space-y-3 p-4">
              {factType === 'sat' && (
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="SAT 25th %ile" value={json.sat_p25} type="number" verbatim={false} onChange={(v) => setTop('sat_p25', v)} />
                  <EditField label="SAT 75th %ile" value={json.sat_p75} type="number" verbatim={false} onChange={(v) => setTop('sat_p75', v)} />
                </div>
              )}
              {factType === 'test_policy' && (
                <EditField label="Policy label" value={json.policy} verbatim={false} onChange={(v) => setTop('policy', v)} />
              )}
              {factType === 'admit_rate' && (
                <EditField label="Admit rate (%)" value={json.admit_rate} type="number" verbatim={false} onChange={(v) => setTop('admit_rate', v)} />
              )}
              {factType === 'cost' && (
                <div className="grid grid-cols-3 gap-2">
                  <EditField label="Currency" value={json.currency} verbatim={false} onChange={(v) => setTop('currency', v)} />
                  <EditField label="Tuition/yr" value={json.tuition} type="number" verbatim={false} onChange={(v) => setTop('tuition', v)} />
                  <EditField label="Total/yr" value={json.total} type="number" verbatim={false} onChange={(v) => setTop('total', v)} />
                </div>
              )}
              {/* verbatim evidence — must be an exact substring (gate enforced) */}
              {factType === 'test_policy' && (
                <EditField label="Statement (verbatim)" value={json.statement} path="statement" failed={gate.failedPaths} multiline onChange={(v) => setTop('statement', v)} />
              )}
              {factType === 'scholarship' && (
                <EditField label="Aid policy (verbatim)" value={json.aid_policy} path="aid_policy" failed={gate.failedPaths} multiline onChange={(v) => setTop('aid_policy', v)} />
              )}
              {(factType === 'sat' || factType === 'admit_rate' || factType === 'cost' || factType === 'scholarship') && (
                <EditField label={factType === 'scholarship' ? 'Supporting quote (verbatim, optional)' : 'Source quote (verbatim)'} value={json.quote} path="quote" failed={gate.failedPaths} multiline onChange={(v) => setTop('quote', v)} />
              )}
              <EditField label="Cycle year" value={json.cycle_year} verbatim={false} onChange={(v) => setTop('cycle_year', v)} />
            </div>
          )}

          {/* actions */}
          <div className="card sticky bottom-4 flex flex-wrap items-center gap-2 p-3">
            <button onClick={doSave} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60">
              {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save edits
            </button>
            <button onClick={doPublish} disabled={!!busy || !gate.ok} title={gate.ok ? '' : 'Resolve verbatim issues first'} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy === 'publish' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Approve &amp; Publish
            </button>
            <button onClick={doReject} disabled={!!busy} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60">
              {busy === 'reject' ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />} Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, path, failed, multiline, verbatim = true, type = 'text' }) {
  const bad = verbatim && path && failed?.has(path)
  const cls = `w-full rounded-lg border px-2.5 ${multiline ? 'py-1.5' : 'py-1'} text-sm outline-none focus:ring-2 ${
    bad ? 'border-rose-300 bg-rose-50 focus:ring-rose-100' : 'border-ink-200 focus:ring-brand-100'
  }`
  const handle = (e) => onChange(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="label">{label}</label>
        {verbatim && (bad
          ? <span className="text-[10px] font-bold text-rose-600">✕ not in source</span>
          : value ? <span className="text-[10px] font-bold text-emerald-600">✓ verbatim</span> : null)}
      </div>
      {multiline
        ? <textarea value={value ?? ''} onChange={handle} rows={3} className={cls} />
        : <input type={type} value={value ?? ''} onChange={handle} className={cls} />}
    </div>
  )
}
