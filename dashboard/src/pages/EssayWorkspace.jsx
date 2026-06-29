import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Save, Lock, Unlock, MessageSquare, Clock, CheckCircle2,
  ExternalLink, BadgeCheck, AlertTriangle, Loader2, Send, FileText, RotateCcw,
} from 'lucide-react'
import {
  getEssayWorkspace, saveVersion, setWorkStatus, setGdocUrl, addComment, resolveComment,
  lockVersion, wordCount, charCount, effectiveLimits, WORK_STATUSES, WORK_LABEL,
} from '../data/essays'

export default function EssayWorkspace() {
  const { id } = useParams()
  const [ws, setWs] = useState(null)
  const [draft, setDraft] = useState('')
  const [gdoc, setGdoc] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)

  async function load(initEditor = false) {
    const w = await getEssayWorkspace(id)
    setWs(w)
    if (initEditor) { setDraft(w.versions[0]?.content || ''); setGdoc(w.essay.gdoc_url || '') }
    return w
  }
  useEffect(() => { load(true).catch((e) => setErr(e?.message || 'Failed to load')) }, [id])

  if (err) return <div className="card p-8 text-center text-rose-600">{err}</div>
  if (!ws) return <div className="grid h-64 place-items-center text-ink-400"><Loader2 className="animate-spin" /></div>

  const { essay, versions, comments, requirement } = ws
  const locked = essay.work_status === 'final_locked'
  const limits = effectiveLimits(essay, requirement)
  const wc = wordCount(draft)
  const cc = charCount(draft)
  const overWord = limits.word && wc > limits.word
  const overChar = limits.char && cc > limits.char
  const latest = versions[0]
  const dirty = (latest?.content || '') !== draft

  const run = async (key, fn, msg) => {
    setBusy(key); setErr(null); setFlash(null)
    try { await fn(); await load(); if (msg) setFlash(msg) }
    catch (e) { setErr(e?.message || 'Action failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="animate-fadeUp">
      <Link to="/essays" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft size={16} /> Essay Tracker
      </Link>

      {/* header */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="chip bg-ink-100 text-ink-600">{essay.scope}</span>
              {requirement && <span className="chip bg-emerald-50 text-emerald-700"><BadgeCheck size={12} /> linked to verified requirement</span>}
            </div>
            <h1 className="text-xl font-bold text-ink-900">{essay.prompt || 'Untitled essay'}</h1>
            {essay.themes && <p className="mt-1 text-sm text-ink-500">{essay.themes}</p>}
          </div>
          <div className="text-right">
            <label className="label mb-1 block">Workflow status</label>
            <select
              value={essay.work_status}
              onChange={(e) => run('status', () => setWorkStatus(id, e.target.value))}
              disabled={busy === 'status'}
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {WORK_STATUSES.map((s) => <option key={s} value={s}>{WORK_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {(err || flash) && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${err ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>{err || flash}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* EDITOR */}
        <div className="space-y-4 lg:col-span-2">
          {locked && (
            <div className="flex items-center gap-2 rounded-xl bg-ink-100 px-4 py-2.5 text-sm font-medium text-ink-600">
              <Lock size={15} /> This essay is <strong>final-locked</strong> and read-only. Change the status to edit again.
            </div>
          )}
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-ink-900"><FileText size={15} className="text-ink-400" /> Draft</div>
              {/* live count vs official limit */}
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className={overWord ? 'text-rose-600' : 'text-ink-500'}>
                  {wc}{limits.word ? ` / ${limits.word}` : ''} words
                </span>
                {limits.char && <span className={overChar ? 'text-rose-600' : 'text-ink-500'}>{cc} / {limits.char} chars</span>}
                {limits.fromRequirement && <span className="chip bg-emerald-50 text-emerald-700"><BadgeCheck size={11} /> verified limit</span>}
                {(overWord || overChar) && <span className="chip bg-rose-50 text-rose-700"><AlertTriangle size={11} /> over limit</span>}
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={locked}
              rows={16}
              placeholder="Paste or write the draft here…"
              className={`w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-relaxed outline-none focus:ring-2 ${
                overWord || overChar ? 'border-rose-300 focus:ring-rose-100' : 'border-ink-200 focus:ring-brand-100'
              } ${locked ? 'bg-ink-50 text-ink-500' : 'bg-white'}`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => run('save', () => saveVersion(id, draft), 'Version saved.')}
                disabled={!!busy || locked || !dirty}
                title={dirty ? '' : 'No changes since the last version'}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save version{latest ? ` (v${latest.version_no + 1})` : ' (v1)'}
              </button>
              {dirty && latest && (
                <button onClick={() => setDraft(latest.content || '')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-50">
                  <RotateCcw size={14} /> Revert to v{latest.version_no}
                </button>
              )}
            </div>
          </div>

          {/* GDoc link */}
          <div className="card p-4">
            <label className="label mb-1 block">Google Doc link (optional)</label>
            <div className="flex gap-2">
              <input value={gdoc} onChange={(e) => setGdoc(e.target.value)} placeholder="https://docs.google.com/…"
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              <button onClick={() => run('gdoc', () => setGdocUrl(id, gdoc), 'Link saved.')} disabled={busy === 'gdoc'}
                className="shrink-0 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-60">Save</button>
              {essay.gdoc_url && <a href={essay.gdoc_url} target="_blank" rel="noreferrer" className="grid shrink-0 place-items-center rounded-xl border border-ink-200 px-3 text-brand-600 hover:bg-brand-50"><ExternalLink size={15} /></a>}
            </div>
            <p className="mt-2 text-xs text-ink-400">File upload (.docx/.pdf) arrives with Storage — paste + Google Doc cover drafting for now.</p>
          </div>
        </div>

        {/* SIDEBAR: versions + comments */}
        <div className="space-y-4">
          {/* requirement limit hint */}
          {requirement && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-800">
              <div className="flex items-center gap-1.5 font-bold"><BadgeCheck size={13} /> Official limit</div>
              <div className="mt-1">{requirement.word_limit ? `${requirement.word_limit} words` : ''}{requirement.char_limit ? `${requirement.char_limit} characters` : ''} — verified verbatim.</div>
            </div>
          )}

          {/* version timeline */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-900"><Clock size={15} className="text-ink-400" /> Version history</div>
            {versions.length === 0 ? (
              <div className="p-4 text-center text-sm text-ink-400">No versions yet. Save your first draft.</div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {versions.map((v) => (
                  <li key={v.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                        v{v.version_no}
                        {v.is_locked && <Lock size={12} className="text-ink-400" />}
                        <span className="text-xs font-normal text-ink-400">{v.word_count} words · {new Date(v.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setDraft(v.content || ''); setFlash(`Loaded v${v.version_no} into the editor.`) }} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Load</button>
                        <button onClick={() => run('lock', () => lockVersion(v.id, !v.is_locked))} className="rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-50">
                          {v.is_locked ? <Unlock size={13} /> : <Lock size={13} />}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* comments */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-900"><MessageSquare size={15} className="text-ink-400" /> Comments</div>
            <ul className="divide-y divide-ink-100">
              {comments.length === 0 && <li className="p-4 text-center text-sm text-ink-400">No comments yet.</li>}
              {comments.map((c) => (
                <li key={c.id} className={`px-4 py-3 ${c.resolved ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-ink-700">{c.body}</p>
                    <button onClick={() => run('resolve', () => resolveComment(c.id, !c.resolved))} title={c.resolved ? 'Reopen' : 'Resolve'} className="shrink-0 text-ink-300 hover:text-emerald-600">
                      <CheckCircle2 size={15} className={c.resolved ? 'text-emerald-500' : ''} />
                    </button>
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-400">{new Date(c.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 border-t border-ink-100 p-3">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…"
                onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) run('comment', () => addComment(id, comment.trim()).then(() => setComment(''))) }}
                className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              <button onClick={() => comment.trim() && run('comment', () => addComment(id, comment.trim()).then(() => setComment('')))} disabled={busy === 'comment' || !comment.trim()}
                className="shrink-0 rounded-lg bg-brand-600 px-3 text-white hover:bg-brand-700 disabled:opacity-50"><Send size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
