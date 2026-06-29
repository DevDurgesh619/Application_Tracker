import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap, ArrowRight, ArrowLeft, Check, Search, Plus, Loader2, Sparkles, X,
} from 'lucide-react'
import { COUNTRY, TIERS, tier as tierStyle } from '../data/store'
import { useStudents } from './StudentsContext'
import { loadCatalog, suggestTier, createStudent, createApplications, addCustomUniversity, seedEssaysFromRequirements } from '../data/students'

const COUNTRIES = Object.keys(COUNTRY)
const TIER_KEYS = Object.keys(TIERS)
// track → label + the test it admits on
const TRACKS = [
  { key: 'undergrad', label: 'Undergraduate', test: 'SAT' },
  { key: 'law', label: 'Law (JD / LLB)', test: 'LSAT' },
  { key: 'mba', label: 'MBA', test: 'GMAT' },
]
const blankProfile = {
  full_name: '', class_of: '', intended_major: '', track: 'undergrad',
  sat_score: '', sat_estimated: false, lsat_score: '', gmat_score: '', work_experience_years: '',
  gpa: '', ib_predicted: '', budget_currency: 'USD', budget_max_per_year: '', target_countries: [],
}
const LIMITS = { class_of: [2024, 2035], sat_score: [400, 1600], gpa: [0, 4], lsat_score: [120, 180], gmat_score: [200, 805] }

export default function Onboarding({ standalone = false }) {
  const navigate = useNavigate()
  const { refresh, setCurrentStudent } = useStudents()
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState(blankProfile)
  const [catalog, setCatalog] = useState(null)
  const [picks, setPicks] = useState({}) // university_id -> { university, program_id, tier }
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [custom, setCustom] = useState(null) // {name, country, programName} or null

  useEffect(() => { loadCatalog().then(setCatalog).catch((e) => setErr(e?.message)) }, [])

  const sat = profile.sat_score ? Number(profile.sat_score) : null
  // the student's score for their chosen track — drives fit + the schools shown
  const primaryScore = profile.track === 'law' ? (profile.lsat_score ? Number(profile.lsat_score) : null)
    : profile.track === 'mba' ? (profile.gmat_score ? Number(profile.gmat_score) : null)
    : sat
  const trackMeta = TRACKS.find((t) => t.key === profile.track) || TRACKS[0]
  const setP = (k, v) => setProfile((p) => ({ ...p, [k]: v }))
  // switching track clears cross-track picks (catalog is filtered by track)
  const setTrack = (key) => { setProfile((p) => ({ ...p, track: key })); setPicks({}) }

  // step-1 range validation — block rubbish data before continuing
  function validateProfile() {
    if (!profile.full_name.trim()) return 'Full name is required.'
    for (const [field, [lo, hi]] of Object.entries(LIMITS)) {
      const raw = profile[field]
      if (raw === '' || raw == null) continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n < lo || n > hi) {
        const nice = { class_of: 'Class of', sat_score: 'SAT score', gpa: 'GPA' }[field]
        return `${nice} must be between ${lo} and ${hi}.`
      }
    }
    return null
  }
  function next() {
    if (step === 1) { const v = validateProfile(); if (v) { setErr(v); return } }
    setErr(null); setStep(step + 1)
  }
  const toggleCountry = (c) => setProfile((p) => ({ ...p, target_countries: p.target_countries.includes(c) ? p.target_countries.filter((x) => x !== c) : [...p.target_countries, c] }))

  const filtered = useMemo(() => {
    if (!catalog) return []
    const q = query.toLowerCase()
    return catalog.filter((u) =>
      (u.track || 'undergrad') === profile.track &&
      (!q || u.name.toLowerCase().includes(q) || (u.country || '').toLowerCase().includes(q)))
  }, [catalog, query, profile.track])

  function togglePick(u) {
    setPicks((prev) => {
      const next = { ...prev }
      if (next[u.id]) delete next[u.id]
      else next[u.id] = { university: u, program_id: u.programs[0]?.id || null, tier: suggestTier(primaryScore, u) }
      return next
    })
  }
  const setPick = (id, patch) => setPicks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  async function onAddCustom() {
    setBusy(true); setErr(null)
    try {
      const u = await addCustomUniversity({ ...custom, track: profile.track })
      setCatalog((c) => [...(c || []), u])
      setPicks((prev) => ({ ...prev, [u.id]: { university: u, program_id: u.programs[0]?.id || null, tier: suggestTier(primaryScore, u) } }))
      setCustom(null)
    } catch (e) { setErr(e?.message || 'Could not add') } finally { setBusy(false) }
  }

  async function finish() {
    setBusy(true); setErr(null)
    try {
      // generalized test scores keyed by test code (per track)
      const test_scores = {}
      if (sat) test_scores.SAT = sat
      if (profile.lsat_score) test_scores.LSAT = Number(profile.lsat_score)
      if (profile.gmat_score) test_scores.GMAT = Number(profile.gmat_score)
      const studentId = await createStudent({
        ...profile,
        class_of: profile.class_of ? Number(profile.class_of) : null,
        sat_score: profile.track === 'undergrad' ? sat : null,
        gpa: profile.gpa ? Number(profile.gpa) : null,
        budget_max_per_year: profile.budget_max_per_year ? Number(profile.budget_max_per_year) : null,
        test_scores,
        work_experience_months: profile.work_experience_years ? Math.round(Number(profile.work_experience_years) * 12) : null,
      })
      const list = Object.values(picks).map((p) => ({ university_id: p.university.id, program_id: p.program_id, tier: p.tier }))
      await createApplications(studentId, list)
      // seed each student's essay tracker from the verified official prompts
      await seedEssaysFromRequirements(studentId, list.map((p) => p.university_id)).catch(() => {})
      await refresh()
      setCurrentStudent(studentId)
      navigate('/')
    } catch (e) { setErr(e?.message || 'Could not create student'); setBusy(false) }
  }

  const pickList = Object.values(picks)

  return (
    <div className={standalone ? 'mx-auto max-w-3xl p-8' : ''}>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft"><GraduationCap size={24} /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Onboard a student</h1>
          <p className="text-sm text-ink-500">Step {step} of 3 — {step === 1 ? 'profile' : step === 2 ? 'choose universities' : 'review & create'}</p>
        </div>
      </div>

      <Steps step={step} />
      {err && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{err}</div>}

      {/* STEP 1 — profile */}
      {step === 1 && (
        <div className="card space-y-4 p-6">
          {/* track selector — sets which schools + profile fields apply */}
          <div>
            <span className="label">Track</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TRACKS.map((t) => (
                <button key={t.key} onClick={() => setTrack(t.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${profile.track === t.key ? 'bg-brand-600 text-white shadow-soft' : 'border border-ink-200 bg-white text-ink-500 hover:bg-ink-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Inp label="Full name *" value={profile.full_name} onChange={(v) => setP('full_name', v)} />
            <Inp label={profile.track === 'undergrad' ? 'Class of' : 'Intake / start year'} type="number" min={2024} max={2035} value={profile.class_of} onChange={(v) => setP('class_of', v)} placeholder="2027" />
            <Inp label={profile.track === 'mba' ? 'Intended focus' : profile.track === 'law' ? 'Intended focus (e.g. corporate law)' : 'Intended major'} value={profile.intended_major} onChange={(v) => setP('intended_major', v)} />

            {/* track-aware admission-test score */}
            {profile.track === 'undergrad' && (
              <div className="grid grid-cols-2 gap-2">
                <Inp label="SAT score" type="number" min={400} max={1600} value={profile.sat_score} onChange={(v) => setP('sat_score', v)} placeholder="1540" />
                <label className="flex items-end gap-1.5 pb-2 text-xs font-medium text-ink-600">
                  <input type="checkbox" checked={profile.sat_estimated} onChange={(e) => setP('sat_estimated', e.target.checked)} className="accent-brand-600" /> estimated
                </label>
              </div>
            )}
            {profile.track === 'law' && (
              <Inp label="LSAT score" type="number" min={120} max={180} value={profile.lsat_score} onChange={(v) => setP('lsat_score', v)} placeholder="170" />
            )}
            {profile.track === 'mba' && (
              <Inp label="GMAT score" type="number" min={200} max={805} value={profile.gmat_score} onChange={(v) => setP('gmat_score', v)} placeholder="730" />
            )}

            <Inp label="GPA" type="number" min={0} max={4} value={profile.gpa} onChange={(v) => setP('gpa', v)} placeholder="3.9" />
            {profile.track === 'undergrad' && (
              <Inp label="IB predicted" value={profile.ib_predicted} onChange={(v) => setP('ib_predicted', v)} placeholder="42/45" />
            )}
            {profile.track === 'mba' && (
              <Inp label="Work experience (years)" type="number" min={0} max={30} value={profile.work_experience_years} onChange={(v) => setP('work_experience_years', v)} placeholder="5" />
            )}
            <Inp label="Budget / year (USD)" type="number" value={profile.budget_max_per_year} onChange={(v) => setP('budget_max_per_year', v)} placeholder="e.g. 80000" />
            <Inp label="Currency" value={profile.budget_currency} onChange={(v) => setP('budget_currency', v)} />
          </div>
          <div>
            <span className="label">Target countries</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {COUNTRIES.map((c) => (
                <button key={c} onClick={() => toggleCountry(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${profile.target_countries.includes(c) ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-white text-ink-500 hover:bg-ink-50'}`}>
                  {COUNTRY[c].flag} {c}
                </button>
              ))}
            </div>
          </div>
          <Inp label="Profile summary" value={profile.profile_summary || ''} onChange={(v) => setP('profile_summary', v)} placeholder="e.g. Economics aspirant, strong quant" />
        </div>
      )}

      {/* STEP 2 — universities */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalog…"
                className="w-full rounded-xl border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            </div>
            <button onClick={() => setCustom({ name: '', country: '', programName: '' })} className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"><Plus size={15} /> Custom</button>
            <span className="chip bg-brand-50 text-brand-700">{pickList.length} selected</span>
          </div>

          {custom && (
            <div className="card grid gap-2 p-4 sm:grid-cols-4">
              <Inp label="University name" value={custom.name} onChange={(v) => setCustom({ ...custom, name: v })} />
              <Inp label="Country" value={custom.country} onChange={(v) => setCustom({ ...custom, country: v })} />
              <Inp label="Program (optional)" value={custom.programName} onChange={(v) => setCustom({ ...custom, programName: v })} />
              <div className="flex items-end gap-2">
                <button onClick={onAddCustom} disabled={busy || !custom.name} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
                <button onClick={() => setCustom(null)} className="rounded-lg px-2 py-2 text-ink-400 hover:bg-ink-50"><X size={16} /></button>
              </div>
            </div>
          )}

          {!catalog ? (
            <div className="grid h-40 place-items-center text-ink-400"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {filtered.map((u) => {
                const picked = !!picks[u.id]
                const sug = suggestTier(primaryScore, u)
                const t = tierStyle(sug)
                const testMed = u.admission_tests?.[u.primary_test]?.median
                const meta = profile.track === 'undergrad'
                  ? (u.admit_rate != null ? `${u.admit_rate}% admit` : `${u.programs.length} program${u.programs.length !== 1 ? 's' : ''}`)
                  : [testMed ? `${u.primary_test} ${testMed}` : null, u.admit_rate != null ? `${u.admit_rate}% admit` : null].filter(Boolean).join(' · ') || u.city
                return (
                  <button key={u.id} onClick={() => togglePick(u)}
                    className={`card flex items-center gap-3 p-3.5 text-left transition ${picked ? 'ring-2 ring-brand-400' : 'hover:shadow-soft'}`}>
                    <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${picked ? 'bg-brand-600 text-white' : 'border border-ink-200'}`}>{picked && <Check size={14} />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-ink-900">{COUNTRY[u.country]?.flag} {u.name}</div>
                      <div className="text-xs text-ink-400">{meta}</div>
                    </div>
                    <span className={`chip ${t.bg} ${t.text}`}>{sug}</span>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div className="col-span-full rounded-xl bg-ink-50 p-6 text-center text-sm text-ink-500">
                  No {trackMeta.label} schools match{query ? ' your search' : ''}. Use <strong>Custom</strong> to add one.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 3 — review */}
      {step === 3 && (
        <div className="card divide-y divide-ink-100 overflow-hidden">
          <div className="bg-ink-50/60 px-5 py-3 text-sm">
            <span className="font-bold text-ink-900">{profile.full_name || 'Unnamed'}</span>
            <span className="text-ink-500"> · {trackMeta.label}{profile.intended_major ? ` · ${profile.intended_major}` : ''}{primaryScore ? ` · ${trackMeta.test} ${primaryScore}` : ''} · {pickList.length} schools</span>
          </div>
          {pickList.map((p) => (
            <div key={p.university.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-800">{COUNTRY[p.university.country]?.flag} {p.university.name}</div>
                {p.university.programs.length > 0 && (
                  <select value={p.program_id || ''} onChange={(e) => setPick(p.university.id, { program_id: e.target.value || null })}
                    className="mt-1 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs outline-none">
                    {p.university.programs.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}{pr.college ? ` (${pr.college})` : ''}</option>)}
                  </select>
                )}
              </div>
              <select value={p.tier} onChange={(e) => setPick(p.university.id, { tier: e.target.value })}
                className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none">
                {TIER_KEYS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-5 py-2.5 text-xs text-ink-400">
            <Sparkles size={12} /> Tiers are a <strong>suggested fit</strong> (SAT band + selectivity) — editable now and anytime later.
          </div>
        </div>
      )}

      {/* nav */}
      <div className="mt-5 flex items-center justify-between">
        {standalone && step === 1 ? (
          <span />
        ) : (
          <button onClick={() => (step === 1 ? navigate(-1) : setStep(step - 1))} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-50">
            <ArrowLeft size={16} /> {step === 1 ? 'Cancel' : 'Back'}
          </button>
        )}
        {step < 3 ? (
          <button onClick={next} disabled={step === 1 && !profile.full_name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={finish} disabled={busy || !profile.full_name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />} Create student{pickList.length ? ` + ${pickList.length} apps` : ''}
          </button>
        )}
      </div>
    </div>
  )
}

function Steps({ step }) {
  const labels = ['Profile', 'Universities', 'Review']
  return (
    <div className="mb-5 flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i + 1 <= step ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400'}`}>{i + 1}</div>
          <span className={`text-xs font-semibold ${i + 1 <= step ? 'text-ink-800' : 'text-ink-400'}`}>{l}</span>
          {i < labels.length - 1 && <div className={`h-0.5 flex-1 rounded ${i + 1 < step ? 'bg-brand-400' : 'bg-ink-100'}`} />}
        </div>
      ))}
    </div>
  )
}

function Inp({ label, value, onChange, type = 'text', placeholder, min, max }) {
  return (
    <div>
      <span className="label">{label}</span>
      <input type={type} min={min} max={max} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
    </div>
  )
}
