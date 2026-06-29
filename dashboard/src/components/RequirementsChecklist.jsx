import { useEffect, useState } from 'react'
import {
  ListChecks, Circle, CircleDot, CheckCircle2, Plus, Trash2, Loader2, Sparkles, MinusCircle, Pencil, Check,
} from 'lucide-react'
import { SectionCard, Bar } from './ui'
import {
  listRequirements, seedStandard, createRequirement, updateRequirement, deleteRequirement,
  completion, STATUS_CYCLE, TYPE_LABEL,
} from '../data/requirements'

const STATUS_ICON = {
  todo: { Icon: Circle, cls: 'text-ink-300' },
  in_progress: { Icon: CircleDot, cls: 'text-amber-500' },
  done: { Icon: CheckCircle2, cls: 'text-emerald-500' },
  na: { Icon: MinusCircle, cls: 'text-ink-300' },
}

export default function RequirementsChecklist({ appId }) {
  const [items, setItems] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState(false)

  async function reload() {
    try { setItems(await listRequirements(appId)) } catch (e) { setErr(e?.message || 'Failed to load') }
  }
  useEffect(() => { if (appId) reload() }, [appId])

  if (!appId) return null

  const run = async (fn) => { setBusy(true); setErr(null); try { await fn(); await reload() } catch (e) { setErr(e?.message || 'Action failed') } finally { setBusy(false) } }

  // optimistic status change (snappy), reverts on error
  function cycleStatus(it) {
    const next = it.status === 'na' ? 'todo' : STATUS_CYCLE[it.status]
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: next } : x)))
    updateRequirement(it.id, { status: next }).catch((e) => { setErr(e?.message); reload() })
  }
  function toggleNa(it) {
    const next = it.status === 'na' ? 'todo' : 'na'
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: next } : x)))
    updateRequirement(it.id, { status: next }).catch((e) => { setErr(e?.message); reload() })
  }
  async function addItem() {
    const label = adding.trim()
    if (!label) return
    setAdding('')
    await run(() => createRequirement(appId, label, 'custom', (items?.length || 0)))
  }

  const c = items ? completion(items) : { pct: 0, done: 0, applicable: 0, total: 0 }
  const pctTone = c.pct >= 100 ? 'text-emerald-600' : c.pct >= 50 ? 'text-brand-600' : 'text-ink-600'

  return (
    <SectionCard
      icon={ListChecks}
      title="Requirements Checklist"
      accent="brand"
      action={
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${pctTone}`}>{c.pct}%</span>
          {items && items.length > 0 && (
            <button
              onClick={() => setEditing((e) => !e)}
              title={editing ? 'Done editing' : 'Edit checklist'}
              className={`rounded-md p-1.5 transition ${editing ? 'bg-brand-100 text-brand-700' : 'text-ink-300 hover:bg-ink-100 hover:text-ink-600'}`}
            >
              {editing ? <Check size={14} /> : <Pencil size={14} />}
            </button>
          )}
        </div>
      }
    >
      {items === null ? (
        <div className="flex items-center gap-2 py-3 text-sm text-ink-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <>
          {/* derived completion */}
          <div className="mb-3">
            <Bar value={c.pct} className={c.pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'} />
            <div className="mt-1.5 text-xs text-ink-400">{c.done} of {c.applicable} done{c.total > c.applicable ? ` · ${c.total - c.applicable} N/A` : ''} — completion is derived from this list</div>
          </div>

          {err && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{err}</div>}

          {items.length === 0 ? (
            <div className="rounded-xl bg-ink-50 p-4 text-center">
              <p className="text-sm text-ink-500">No checklist yet.</p>
              <button onClick={() => run(() => seedStandard(appId))} disabled={busy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                <Sparkles size={14} /> Generate standard checklist
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((it) => {
                const s = STATUS_ICON[it.status]
                return (
                  <li key={it.id} className="group flex items-center gap-3 py-2.5">
                    {editing ? (
                      <button onClick={() => cycleStatus(it)} title="Cycle status" className={`shrink-0 ${s.cls} transition hover:scale-110`}>
                        <s.Icon size={18} />
                      </button>
                    ) : (
                      <span className={`shrink-0 ${s.cls}`} title={it.status}><s.Icon size={18} /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${it.status === 'done' ? 'text-ink-400 line-through' : it.status === 'na' ? 'text-ink-300' : 'text-ink-700'}`}>{it.label}</div>
                      <div className="text-[11px] text-ink-400">{TYPE_LABEL[it.type]}</div>
                    </div>
                    {editing && (
                      <>
                        <button onClick={() => toggleNa(it)} title="Toggle N/A" className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${it.status === 'na' ? 'bg-ink-200 text-ink-600' : 'text-ink-300 hover:bg-ink-100 hover:text-ink-500'}`}>N/A</button>
                        <button onClick={() => run(() => deleteRequirement(it.id))} className="shrink-0 rounded p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/* add custom item — only while editing */}
          {editing && items.length > 0 && (
            <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
              <input
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
                placeholder="Add a requirement…"
                className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button onClick={addItem} disabled={busy || !adding.trim()} className="shrink-0 rounded-lg bg-brand-600 px-3 text-white hover:bg-brand-700 disabled:opacity-50"><Plus size={15} /></button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}
