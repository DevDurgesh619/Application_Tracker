import { useEffect, useState } from 'react'
import {
  Award, Trophy, Briefcase, Target, Plus, Trash2, Star, ChevronUp, ChevronDown,
  Loader2, AlertTriangle, Pencil, Check, Clock,
} from 'lucide-react'
import { useData } from '../data/DataContext'
import { PageHeader } from '../components/ui'
import {
  listActivities, listHonors, createActivity, createHonor, updateActivity, updateHonor,
  deleteActivity, deleteHonor, setFinalCut, reorder, ACTIVITY_LIMIT, HONOR_LIMIT, DESC_LIMIT,
} from '../data/activities'

const BTN_ADD = 'inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60'

export default function Activities() {
  const { student } = useData()
  const studentId = student.id
  const [acts, setActs] = useState(null)
  const [hons, setHons] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editA, setEditA] = useState(() => new Set()) // activity ids currently in edit mode
  const [editH, setEditH] = useState(() => new Set())

  async function reload() {
    const [a, h] = await Promise.all([listActivities(studentId), listHonors(studentId)])
    setActs(a); setHons(h)
  }
  useEffect(() => { if (studentId) reload().catch((e) => setErr(e?.message)) }, [studentId])

  const toggleEdit = (setEdit, id) => setEdit((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  // create a fresh row and open it directly in edit mode
  async function addRow(create, setEdit) {
    setBusy(true); setErr(null)
    try { const row = await create(studentId); await reload(); setEdit((s) => new Set(s).add(row.id)) }
    catch (e) { setErr(e?.message || 'Could not add') } finally { setBusy(false) }
  }

  const run = async (fn) => { setBusy(true); setErr(null); try { await fn(); await reload() } catch (e) { setErr(e?.message || 'Action failed') } finally { setBusy(false) } }

  // local edit (controlled) — persists on blur
  const patchLocal = (setList, id, field, value) => setList((p) => p.map((x) => (x.id === id ? { ...x, [field]: value } : x)))
  const persist = (update, list, id, field) => () => { const row = list.find((x) => x.id === id); update(id, { [field]: row[field] }).catch((e) => setErr(e?.message)) }

  async function move(table, list, id, dir) {
    const fin = list.filter((x) => x.in_final_list)
    const i = fin.findIndex((x) => x.id === id)
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= fin.length) return
    const ids = fin.map((x) => x.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await run(() => reorder(table, ids))
  }

  if (err && !acts) return <div className="card p-8 text-center text-rose-600">{err}</div>
  if (!acts || !hons) return <div className="grid h-64 place-items-center text-ink-400"><Loader2 className="animate-spin" /></div>

  const finalActs = acts.filter((a) => a.in_final_list)
  const finalHons = hons.filter((h) => h.in_final_list)

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Activities & Honors" subtitle="Editable · Common App allows 10 activities (150-char) + 5 honors. Pick the final cut and rank by importance." />

      {/* Common App limit counters */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <LimitCard icon={Briefcase} label="Activities in final cut" count={finalActs.length} limit={ACTIVITY_LIMIT} />
        <LimitCard icon={Award} label="Honors in final cut" count={finalHons.length} limit={HONOR_LIMIT} />
      </div>

      {err && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{err}</div>}

      {/* ── ACTIVITIES ── */}
      <SectionHead icon={Briefcase} title="Activities" right={
        <button onClick={() => addRow(createActivity, setEditA)} disabled={busy} className={BTN_ADD}><Plus size={15} /> Add activity</button>
      } />

      {finalActs.length > 0 && (
        <FinalCutPanel
          title="Final cut — Common App order"
          items={finalActs}
          limit={ACTIVITY_LIMIT}
          onUp={(id) => move('activities', acts, id, 'up')}
          onDown={(id) => move('activities', acts, id, 'down')}
          onRemove={(id) => run(() => setFinalCut('activities', id, false))}
          render={(a) => <span className="font-semibold text-ink-800">{a.name}</span>}
        />
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {acts.map((a) => {
          const editing = editA.has(a.id)
          return (
            <div key={a.id} className={`card p-4 ${a.in_final_list ? 'ring-1 ring-brand-200' : ''}`}>
              <div className="mb-1 flex items-start justify-between gap-2">
                {editing ? (
                  <input value={a.name ?? ''} onChange={(e) => patchLocal(setActs, a.id, 'name', e.target.value)} onBlur={persist(updateActivity, acts, a.id, 'name')}
                    className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm font-bold text-ink-900 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100" />
                ) : (
                  <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink-900">{a.name || <span className="text-ink-400">Untitled activity</span>}</h3>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <FinalCutToggle on={a.in_final_list} onClick={() => run(() => setFinalCut('activities', a.id, !a.in_final_list, finalActs.length))} />
                  <EditToggle editing={editing} onClick={() => toggleEdit(setEditA, a.id)} />
                </div>
              </div>

              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Organisation" value={a.org} onChange={(v) => patchLocal(setActs, a.id, 'org', v)} onBlur={persist(updateActivity, acts, a.id, 'org')} />
                    <Field label="Position / role" value={a.position} onChange={(v) => patchLocal(setActs, a.id, 'position', v)} onBlur={persist(updateActivity, acts, a.id, 'position')} />
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="label">Description</span>
                      <span className={`text-[10px] font-bold ${(a.description?.length || 0) > DESC_LIMIT ? 'text-rose-600' : 'text-ink-400'}`}>{a.description?.length || 0} / {DESC_LIMIT}</span>
                    </div>
                    <textarea value={a.description ?? ''} rows={2} onChange={(e) => patchLocal(setActs, a.id, 'description', e.target.value)} onBlur={persist(updateActivity, acts, a.id, 'description')}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 ${(a.description?.length || 0) > DESC_LIMIT ? 'border-rose-300 focus:ring-rose-100' : 'border-ink-200 focus:ring-brand-100'}`} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 items-end gap-2">
                    <NumField label="Hrs/week" value={a.hours_per_week} onChange={(v) => patchLocal(setActs, a.id, 'hours_per_week', v)} onBlur={persist(updateActivity, acts, a.id, 'hours_per_week')} />
                    <NumField label="Weeks/yr" value={a.weeks_per_year} onChange={(v) => patchLocal(setActs, a.id, 'weeks_per_year', v)} onBlur={persist(updateActivity, acts, a.id, 'weeks_per_year')} />
                    <label className="flex items-center gap-1.5 pb-1 text-xs font-medium text-ink-600">
                      <input type="checkbox" checked={!!a.continue_in_college} onChange={(e) => run(() => updateActivity(a.id, { continue_in_college: e.target.checked }))} className="accent-brand-600" />
                      In college
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2.5">
                    <button onClick={() => { if (confirm('Delete this activity?')) run(() => deleteActivity(a.id)) }} className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600"><Trash2 size={13} /> Delete</button>
                    <button onClick={() => toggleEdit(setEditA, a.id)} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"><Check size={13} /> Done</button>
                  </div>
                </>
              ) : (
                <ActivityView a={a} />
              )}
            </div>
          )
        })}
        {acts.length === 0 && <Empty>No activities yet. Add the first.</Empty>}
      </div>

      {/* ── HONORS ── */}
      <SectionHead icon={Trophy} title="Honors & Awards" right={
        <button onClick={() => addRow(createHonor, setEditH)} disabled={busy} className={BTN_ADD}><Plus size={15} /> Add honor</button>
      } />

      {finalHons.length > 0 && (
        <FinalCutPanel
          title="Final cut — top honors"
          items={finalHons}
          limit={HONOR_LIMIT}
          onUp={(id) => move('honors', hons, id, 'up')}
          onDown={(id) => move('honors', hons, id, 'down')}
          onRemove={(id) => run(() => setFinalCut('honors', id, false))}
          render={(h) => <span className="font-semibold text-ink-800">{h.name}</span>}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {hons.map((h) => {
          const editing = editH.has(h.id)
          return (
            <div key={h.id} className={`card p-4 ${h.in_final_list ? 'ring-1 ring-amber-200' : ''}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Award size={18} /></div>
                <div className="flex shrink-0 items-center gap-1">
                  <FinalCutToggle on={h.in_final_list} amber onClick={() => run(() => setFinalCut('honors', h.id, !h.in_final_list, finalHons.length))} />
                  <EditToggle editing={editing} amber onClick={() => toggleEdit(setEditH, h.id)} />
                </div>
              </div>

              {editing ? (
                <>
                  <input value={h.name ?? ''} onChange={(e) => patchLocal(setHons, h.id, 'name', e.target.value)} onBlur={persist(updateHonor, hons, h.id, 'name')}
                    className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm font-bold text-ink-900 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
                  <div className="mt-2 space-y-2">
                    <Field label="Awarding body" value={h.body} onChange={(v) => patchLocal(setHons, h.id, 'body', v)} onBlur={persist(updateHonor, hons, h.id, 'body')} />
                    <Field label="Level" value={h.level} onChange={(v) => patchLocal(setHons, h.id, 'level', v)} onBlur={persist(updateHonor, hons, h.id, 'level')} />
                    <div>
                      <span className="label">Why it matters</span>
                      <textarea value={h.why ?? ''} rows={2} onChange={(e) => patchLocal(setHons, h.id, 'why', e.target.value)} onBlur={persist(updateHonor, hons, h.id, 'why')}
                        className="mt-1 w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-100" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2.5">
                    <button onClick={() => { if (confirm('Delete this honor?')) run(() => deleteHonor(h.id)) }} className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600"><Trash2 size={13} /> Delete</button>
                    <button onClick={() => toggleEdit(setEditH, h.id)} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"><Check size={13} /> Done</button>
                  </div>
                </>
              ) : (
                <HonorView h={h} />
              )}
            </div>
          )
        })}
        {hons.length === 0 && <Empty>No honors yet. Add the first.</Empty>}
      </div>
    </div>
  )
}

/* ---- read-only views (default) ---- */
function ActivityView({ a }) {
  const sub = [a.org, a.position].filter(Boolean).join(' · ')
  const stats = []
  if (a.hours_per_week != null) stats.push(`${a.hours_per_week} hrs/wk`)
  if (a.weeks_per_year != null) stats.push(`${a.weeks_per_year} wks/yr`)
  if (a.continue_in_college) stats.push('continuing in college')
  return (
    <div>
      {sub && <div className="text-xs font-medium text-ink-500">{sub}</div>}
      {a.description
        ? <p className="mt-2 text-sm leading-relaxed text-ink-600">{a.description}</p>
        : <p className="mt-2 text-sm italic text-ink-300">No description yet — click the pencil to add one.</p>}
      {stats.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-400">
          <Clock size={11} /> {stats.join(' · ')}
        </div>
      )}
    </div>
  )
}

function HonorView({ h }) {
  return (
    <div>
      <h3 className="font-bold leading-snug text-ink-900">{h.name || <span className="text-ink-400">Untitled honor</span>}</h3>
      {h.body && <div className="mt-0.5 text-xs font-medium text-ink-500">{h.body}</div>}
      {h.level && <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">{h.level}</span>}
      {h.why
        ? <p className="mt-2 text-xs leading-relaxed text-ink-500">{h.why}</p>
        : <p className="mt-2 text-xs italic text-ink-300">No detail yet — click the pencil to add.</p>}
    </div>
  )
}

function EditToggle({ editing, amber, onClick }) {
  return (
    <button
      onClick={onClick}
      title={editing ? 'Done editing' : 'Edit'}
      className={`rounded-md p-1.5 transition ${
        editing
          ? (amber ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700')
          : 'text-ink-300 hover:bg-ink-100 hover:text-ink-600'
      }`}
    >
      {editing ? <Check size={14} /> : <Pencil size={14} />}
    </button>
  )
}

/* ---- small building blocks ---- */
function LimitCard({ icon: Icon, label, count, limit }) {
  const over = count > limit
  return (
    <div className={`card flex items-center gap-3 p-4 ${over ? 'ring-1 ring-rose-200' : ''}`}>
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${over ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600'}`}><Icon size={18} /></div>
      <div>
        <div className="label">{label}</div>
        <div className={`text-xl font-bold ${over ? 'text-rose-600' : 'text-ink-900'}`}>{count}<span className="text-sm text-ink-400">/{limit}</span></div>
      </div>
      {over && <span className="ml-auto chip bg-rose-50 text-rose-700"><AlertTriangle size={12} /> over limit</span>}
    </div>
  )
}

function SectionHead({ icon: Icon, title, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink-700"><Icon size={16} /> {title}</h2>
      {right}
    </div>
  )
}

function FinalCutPanel({ title, items, limit, onUp, onDown, onRemove, render }) {
  return (
    <div className="card mb-4 overflow-hidden border-l-4 border-l-brand-400">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-brand-50/40 px-4 py-2.5 text-xs font-bold text-brand-700">
        <Target size={14} /> {title} ({items.length}/{limit})
      </div>
      <ol className="divide-y divide-ink-100">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold ${i < limit ? 'bg-brand-100 text-brand-700' : 'bg-rose-100 text-rose-700'}`}>{i + 1}</span>
            <div className="min-w-0 flex-1 truncate text-sm">{render(it)}</div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button onClick={() => onUp(it.id)} disabled={i === 0} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"><ChevronUp size={15} /></button>
              <button onClick={() => onDown(it.id)} disabled={i === items.length - 1} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"><ChevronDown size={15} /></button>
              <button onClick={() => onRemove(it.id)} title="Remove from final cut" className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"><Star size={14} className="fill-current" /></button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function FinalCutToggle({ on, amber, onClick }) {
  return (
    <button onClick={onClick} title={on ? 'In final cut — click to remove' : 'Add to Common App final cut'}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
        on ? (amber ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700') : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
      }`}>
      <Star size={12} className={on ? 'fill-current' : ''} /> {on ? 'In cut' : 'Final cut'}
    </button>
  )
}

function Field({ label, value, onChange, onBlur }) {
  return (
    <div>
      <span className="label">{label}</span>
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        className="mt-0.5 w-full rounded-lg border border-ink-200 px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-100" />
    </div>
  )
}
function NumField({ label, value, onChange, onBlur }) {
  return (
    <div>
      <span className="label">{label}</span>
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} onBlur={onBlur}
        className="mt-0.5 w-full rounded-lg border border-ink-200 px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-100" />
    </div>
  )
}
function Empty({ children }) {
  return <div className="col-span-full py-8 text-center text-sm text-ink-400">{children}</div>
}
