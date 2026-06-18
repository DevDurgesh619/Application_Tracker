import {
  SAT_SCORE, SAT_ESTIMATED, parseDate, isApprox, isIntakeNote, verdictBucket,
} from './helpers'

/* ------------------------------------------------------------------ *
 *  buildDataset(raw)
 *  Pure function: takes the raw master data (from a source — local JSON
 *  today, Supabase later) and returns the fully-derived, aggregated
 *  dataset + accessor closures the UI consumes.
 *
 *  This is the boundary the data-layer seam protects: the SOURCE of `raw`
 *  can change (JSON -> Supabase) without touching this derivation or the UI.
 * ------------------------------------------------------------------ */

function num(v) {
  if (v === null || v === undefined || v === '' || v === '—') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/* recompute SAT gaps + status from the central SAT_SCORE so everything
 * stays in sync if the score changes (the sheet's frozen values are ignored) */
function buildSat(sat) {
  const p25 = num(sat['SAT 25th %ile'])
  const p75 = num(sat['SAT 75th %ile'])
  const yourScore = SAT_SCORE
  const gap25 = p25 != null ? yourScore - p25 : null
  const gap75 = p75 != null ? yourScore - p75 : null
  let status = null
  if (p25 != null && p75 != null) {
    status = yourScore > p75 ? '🟢 Above 75th' : yourScore >= p25 ? '🟡 In Range' : '🔴 Below 25th'
  }
  return { p25, p75, yourScore, gap25, gap75, status, estimated: SAT_ESTIMATED, note: sat.Note }
}

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
    sat: sat ? buildSat(sat) : null,
  }
}

const STOP = new Set(['university', 'of', 'the', 'all', 'campuses', 'us', 'schools', 'app', 'common', 'personal', 'statement', '–', '-', 'and', '&'])
function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[–—]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
}

export function buildDataset(raw) {
  const student = { ...raw.student, satScore: SAT_SCORE, satEstimated: SAT_ESTIMATED }

  const universities = raw.universities.map(normalize).sort((a, b) => a.num - b.num)
  const getUniversity = (id) => universities.find((u) => u.id === id)

  /* ---- essays + essay<->university mapping ---- */
  const essays = raw.essays.map((e, i) => ({
    id: `essay-${i}`,
    scope: e.University,
    scopeTier: e.Tier,
    prompt: e['Essay / Prompt'],
    wordLimit: e['Word Limit'],
    themes: e['Key Themes'],
    status: e['Draft Status'] || 'Not Started',
    notes: e['Notes & Links'],
  }))

  const essayUniIds = (essay) => {
    const scope = essay.scope || ''
    if (/common app personal statement/i.test(scope))
      return universities.filter((u) => u.appPlatform === 'Common App').map((u) => u.id)
    if (/all uc campuses/i.test(scope))
      return universities.filter((u) => u.appPlatform === 'UC Application').map((u) => u.id)
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

  const _essaysByUni = {}
  for (const e of essays) {
    for (const id of essayUniIds(e)) {
      ;(_essaysByUni[id] ||= []).push(e)
    }
  }
  const essaysForUniversity = (id) => _essaysByUni[id] || []

  /* ---- interviews ---- */
  const interviews = raw.interviews.map((iv, i) => ({
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
  const interviewsForUniversity = (id) => interviews.filter((iv) => iv.uni && iv.uni.id === id)

  /* ---- activities & honors ---- */
  const activities = raw.activities.map((a, i) => ({
    id: `act-${i}`,
    name: a['Activity / Honor Name'],
    org: a.Organisation,
    position: a['Position & Status'],
    description: a['Description (150 chars for Common App)'],
    skills: a['Skills Applied'],
    impact: a['Impact & Key Outcomes'],
  }))
  const honors = raw.honors.map((h, i) => ({
    id: `hon-${i}`,
    name: h['Honor / Award Name'],
    body: h['Awarding Body'],
    level: h['Level / Recognition'],
    description: h.Description,
    why: h['Why It Matters'],
  }))

  /* ---- verification audit ---- */
  const auditUniIds = (label) => {
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

  const audit = (raw.audit || []).map((a, i) => ({
    id: `audit-${i}`,
    num: a['#'],
    scope: a.University,
    field: a['Field checked'],
    trackerValue: a['ChatGPT / tracker value'],
    verdict: a.Verdict,
    bucket: verdictBucket(a.Verdict).key,
    verified: a['Verified correct value'],
    source: a['Official source'],
    uniIds: auditUniIds(a.University),
  }))

  const _auditByUni = {}
  for (const a of audit) for (const id of a.uniIds) (_auditByUni[id] ||= []).push(a)
  const auditForUniversity = (id) => _auditByUni[id] || []

  const bigErrors = raw.bigErrors || []
  const auditSummary = () => {
    const by = { correct: 0, warning: 0, wrong: 0, note: 0 }
    for (const a of audit) by[a.bucket]++
    return by
  }

  /* ---- calendar events (deadline + scholarship + decision) ---- */
  const deadlineEvents = () => {
    const ev = []
    for (const u of universities) {
      const parts = String(u.keyDeadline || '')
        .split(/\n|\s\|\s/)
        .map((p) => p.trim())
        .filter(Boolean)
      const seen = new Set()
      for (const p of parts) {
        if (isIntakeNote(p)) continue
        const d = parseDate(p)
        if (d && !seen.has(d.getTime())) {
          seen.add(d.getTime())
          ev.push({ uni: u, date: d, kind: 'deadline', label: p, approx: isApprox(p) })
        }
      }
      if (!parts.length || ![...seen].length) {
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

  return {
    student,
    universities,
    getUniversity,
    essays,
    essayUniIds,
    essaysForUniversity,
    interviews,
    interviewsForUniversity,
    activities,
    honors,
    audit,
    auditForUniversity,
    auditSummary,
    bigErrors,
    deadlineEvents,
  }
}
