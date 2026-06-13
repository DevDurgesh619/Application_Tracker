import master from './master.json'

/* ------------------------------------------------------------------ *
 *  Master data store + aggregation helpers.
 *  Every university is a master record; helpers below join the
 *  per-sheet data (cost / SAT / essays / interviews / links) onto it.
 * ------------------------------------------------------------------ */

export const student = master.student

/* ---- tier config ---- */
export const TIERS = {
  Reach: { label: 'Reach', order: 1, text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', solid: 'bg-rose-500', hex: '#f43f5e' },
  'Realistic Reach': { label: 'Realistic Reach', order: 2, text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', solid: 'bg-amber-500', hex: '#f59e0b' },
  Target: { label: 'Target', order: 3, text: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', dot: 'bg-brand-500', solid: 'bg-brand-500', hex: '#3563f0' },
  Safety: { label: 'Safety', order: 4, text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', solid: 'bg-emerald-500', hex: '#10b981' },
}
export const tier = (t) => TIERS[t] || { label: t, order: 9, text: 'text-ink-600', bg: 'bg-ink-100', border: 'border-ink-200', dot: 'bg-ink-400', solid: 'bg-ink-400', hex: '#637088' }

/* ---- country config ---- */
export const COUNTRY = {
  USA: { flag: '🇺🇸', label: 'United States' },
  Singapore: { flag: '🇸🇬', label: 'Singapore' },
  Australia: { flag: '🇦🇺', label: 'Australia' },
  India: { flag: '🇮🇳', label: 'India' },
}
export const country = (c) => COUNTRY[c] || { flag: '🏳️', label: c }

/* ---- normalise a raw university record into a clean shape ---- */
function normalize(u) {
  const cost = u.cost || {}
  const sat = u.sat || null
  return {
    id: u.id,
    num: u['#'],
    name: u.University,
    tier: u.Tier,
    country: u.Country,
    programme: u.Programme,
    keyDeadline: u['Key Deadline'],
    applicationType: u['Application Type'],
    entryRequirements: u['Entry Requirements'],
    scholarship: u['Scholarship / Aid'],
    tuitionStr: u['Tuition/yr'],
    tests: u.Tests,
    status: u.Status || 'Not Started',
    priority: u.Priority,
    aidPolicy: u['Aid Policy'],
    appPlatform: u['App Platform'],
    stemOpt: u['STEM OPT'],
    interview: u['Interview?'],
    completion: u['App Completion %'],
    decisionDate: u['Decision Date'],
    scholDeadline: u['Schol. Deadline'],
    notes: u.Notes,
    links: u.links || {},
    cost: {
      currency: cost.Currency,
      tuition: num(cost['Tuition/yr (₹L)']),
      living: num(cost['Living Costs/yr (₹L)']),
      other: num(cost['Other Fees/yr (₹L)']),
      total: num(cost['TOTAL Annual Cost (₹L)']),
      fourYear: num(cost['4-Year Total (₹L)']),
      appFee: cost['Application Fee (₹)'],
      bestCase: num(cost['Best-Case Annual Cost (₹L)']),
      fourYearBest: num(cost['4-Year Best-Case (₹L)']),
    },
    sat: sat
      ? {
          p25: num(sat['SAT 25th %ile']),
          p75: num(sat['SAT 75th %ile']),
          yourScore: num(sat['Your Score']),
          gap25: num(sat['Gap (25th)']),
          gap75: num(sat['Gap (75th)']),
          status: sat.Status,
          note: sat.Note,
        }
      : null,
  }
}

function num(v) {
  if (v === null || v === undefined || v === '' || v === '—') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export const universities = master.universities
  .map(normalize)
  .sort((a, b) => a.num - b.num)

export const getUniversity = (id) => universities.find((u) => u.id === id)

/* ------------------------------------------------------------------ *
 *  Essay <-> university mapping (essays live in a shared sheet)
 * ------------------------------------------------------------------ */
export const essays = master.essays.map((e, i) => ({
  id: `essay-${i}`,
  scope: e.University,
  scopeTier: e.Tier,
  prompt: e['Essay / Prompt'],
  wordLimit: e['Word Limit'],
  themes: e['Key Themes'],
  status: e['Draft Status'] || 'Not Started',
  notes: e['Notes & Links'],
}))

const STOP = new Set(['university', 'of', 'the', 'all', 'campuses', 'us', 'schools', 'app', 'common', 'personal', 'statement', '–', '-', 'and', '&'])
function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[–—]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
}

/** which university ids does an essay apply to */
export function essayUniIds(essay) {
  const scope = essay.scope || ''
  if (/common app personal statement/i.test(scope))
    return universities.filter((u) => u.appPlatform === 'Common App').map((u) => u.id)
  if (/all uc campuses/i.test(scope))
    return universities.filter((u) => u.appPlatform === 'UC Application').map((u) => u.id)
  // direct: best token-overlap match
  const et = tokens(scope)
  let best = null
  let bestScore = 0
  for (const u of universities) {
    const ut = tokens(u.name)
    const score = et.filter((t) => ut.includes(t)).length
    if (score > bestScore) {
      bestScore = score
      best = u
    }
  }
  return bestScore > 0 ? [best.id] : []
}

// precompute reverse index uniId -> essays
const _essaysByUni = {}
for (const e of essays) {
  for (const id of essayUniIds(e)) {
    ;(_essaysByUni[id] ||= []).push(e)
  }
}
export const essaysForUniversity = (id) => _essaysByUni[id] || []

/* ------------------------------------------------------------------ *
 *  Interviews
 * ------------------------------------------------------------------ */
export const interviews = master.interviews.map((iv, i) => ({
  id: `iv-${i}`,
  scope: iv.University,
  date: iv.Date,
  format: iv.Format,
  prep: iv['Prep Status'],
  outcome: iv.Outcome,
  interviewer: iv.Interviewer,
  notes: iv.Notes,
  uni: universities.find((u) => tokens(u.name).some((t) => tokens(iv.University).includes(t))),
}))
export const interviewsForUniversity = (id) =>
  interviews.filter((iv) => iv.uni && iv.uni.id === id)

/* ------------------------------------------------------------------ *
 *  Activities & honors (student-level)
 * ------------------------------------------------------------------ */
export const activities = master.activities.map((a, i) => ({
  id: `act-${i}`,
  name: a['Activity / Honor Name'],
  org: a.Organisation,
  position: a['Position & Status'],
  description: a['Description (150 chars for Common App)'],
  skills: a['Skills Applied'],
  impact: a['Impact & Key Outcomes'],
}))
export const honors = master.honors.map((h, i) => ({
  id: `hon-${i}`,
  name: h['Honor / Award Name'],
  body: h['Awarding Body'],
  level: h['Level / Recognition'],
  description: h.Description,
  why: h['Why It Matters'],
}))

/* ------------------------------------------------------------------ *
 *  Verification Audit (field-by-field check vs official sources)
 * ------------------------------------------------------------------ */
export const VERDICTS = {
  correct: { key: 'correct', label: 'Verified Correct', emoji: '✅', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', hex: '#10b981' },
  warning: { key: 'warning', label: 'Needs Care', emoji: '⚠️', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', hex: '#f59e0b' },
  wrong: { key: 'wrong', label: 'Wrong — Corrected', emoji: '❌', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', hex: '#f43f5e' },
  note: { key: 'note', label: 'Note', emoji: 'ℹ️', text: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', dot: 'bg-brand-500', hex: '#3563f0' },
}
export function verdictBucket(verdict) {
  const v = String(verdict || '')
  if (v.includes('❌')) return VERDICTS.wrong
  if (v.includes('⚠️') || /unverified|confirm|verify|fix|approx(?!.*correct)/i.test(v)) return VERDICTS.warning
  if (v.includes('ℹ️')) return VERDICTS.note
  if (v.includes('✅')) return VERDICTS.correct
  return VERDICTS.note
}

// map an audit row's free-text university label -> array of uni ids (handles groups)
function auditUniIds(label) {
  const l = String(label || '').toLowerCase()
  if (/uc system|all 6/.test(l)) return universities.filter((u) => u.appPlatform === 'UC Application').map((u) => u.id)
  if (/singapore|all 3/.test(l)) return universities.filter((u) => u.country === 'Singapore').map((u) => u.id)
  const lt = tokens(label)
  let best = null
  let score = 0
  for (const u of universities) {
    const ut = tokens(u.name)
    const s = lt.filter((t) => ut.includes(t)).length
    if (s > score) {
      score = s
      best = u
    }
  }
  return best && score > 0 ? [best.id] : []
}

export const audit = (master.audit || []).map((a, i) => {
  const bucket = verdictBucket(a.Verdict)
  return {
    id: `audit-${i}`,
    num: a['#'],
    scope: a.University,
    field: a['Field checked'],
    trackerValue: a['ChatGPT / tracker value'],
    verdict: a.Verdict,
    bucket: bucket.key,
    verified: a['Verified correct value'],
    source: a['Official source'],
    uniIds: auditUniIds(a.University),
  }
})

const _auditByUni = {}
for (const a of audit) for (const id of a.uniIds) (_auditByUni[id] ||= []).push(a)
export const auditForUniversity = (id) => _auditByUni[id] || []

export const bigErrors = master.bigErrors || []

export function auditSummary() {
  const by = { correct: 0, warning: 0, wrong: 0, note: 0 }
  for (const a of audit) by[a.bucket]++
  return by
}

/* ------------------------------------------------------------------ *
 *  Deadline parsing  ->  real dates for the calendar / countdowns
 * ------------------------------------------------------------------ */
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** parse the first concrete date out of a free-text deadline string */
export function parseDate(text) {
  if (!text) return null
  const s = String(text)
  // "Mon D, YYYY"  e.g. Nov 1, 2026
  let m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2])
  }
  // "D Mon YYYY"  e.g. 31 May 2027 / 23 Feb 2027
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1])
  }
  // "Month YYYY"  e.g. March 2027 -> mid month
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{4})/)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(m[2], MONTHS[m[1].slice(0, 3).toLowerCase()], 15)
  }
  return null
}

export const isApprox = (text) => /~|early|opens|rolling|confirm|tbc|tbd|apply asap|offers/i.test(String(text || ''))

/** an intake/term/semester START date — not an application deadline */
export const isIntakeNote = (text) => /intake|semester|\bsem\b|\bterm\s*\d/i.test(String(text || ''))

/** all calendar events (primary deadline + scholarship deadline + decision date) */
export function deadlineEvents() {
  const ev = []
  for (const u of universities) {
    // a key-deadline cell may contain multiple dated rounds split by newline / pipe
    const parts = String(u.keyDeadline || '')
      .split(/\n|\s\|\s/)
      .map((p) => p.trim())
      .filter(Boolean)
    const seen = new Set()
    for (const p of parts) {
      if (isIntakeNote(p)) continue // skip "Semester 2 intake" / "Term 1" start dates — not deadlines
      const d = parseDate(p)
      if (d && !seen.has(d.getTime())) {
        seen.add(d.getTime())
        ev.push({ uni: u, date: d, kind: 'deadline', label: p, approx: isApprox(p) })
      }
    }
    if (!parts.length || ![...seen].length) {
      // rolling / undated
      ev.push({ uni: u, date: null, kind: 'deadline', label: u.keyDeadline, approx: true })
    }
    const sd = parseDate(u.scholDeadline)
    if (sd && u.scholDeadline && !/same as app|n\/a|rolling/i.test(u.scholDeadline)) {
      ev.push({ uni: u, date: sd, kind: 'scholarship', label: u.scholDeadline, approx: isApprox(u.scholDeadline) })
    }
    const dd = parseDate(u.decisionDate)
    if (dd) ev.push({ uni: u, date: dd, kind: 'decision', label: u.decisionDate, approx: isApprox(u.decisionDate) })
  }
  return ev
}

/** earliest upcoming primary deadline for a university (Date | null) */
export function primaryDeadline(u) {
  const parts = String(u.keyDeadline || '').split(/\n|\s\|\s/)
  const dates = parts.filter((p) => !isIntakeNote(p)).map(parseDate).filter(Boolean).sort((a, b) => a - b)
  return dates[0] || null
}

export function daysUntil(date, from = new Date()) {
  if (!date) return null
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((b - a) / 86400000)
}

/* ------------------------------------------------------------------ *
 *  Formatting helpers
 * ------------------------------------------------------------------ */
export const fmtL = (n) => (n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}L`)
export const fmtDate = (d) =>
  d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
export const fmtDateShort = (d) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')

/* ---- status config ---- */
export const STATUS = {
  'Not Started': { text: 'text-ink-500', bg: 'bg-ink-100', dot: 'bg-ink-400' },
  'In Progress': { text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  Submitted: { text: 'text-brand-700', bg: 'bg-brand-50', dot: 'bg-brand-500' },
  Accepted: { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  Complete: { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
}
export const statusStyle = (s) => STATUS[s] || STATUS['Not Started']
