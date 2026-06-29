import {
  SAT_SCORE, SAT_ESTIMATED, parseDate, isApprox, isIntakeNote, verdictBucket, lakhToUSD, toUSD,
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

/* recompute SAT gaps + status from the student's score so everything
 * stays in sync if the score changes (the sheet's frozen values are ignored) */
function buildSat(sat, yourScore, estimated) {
  const p25 = num(sat['SAT 25th %ile'])
  const p75 = num(sat['SAT 75th %ile'])
  const gap25 = p25 != null ? yourScore - p25 : null
  const gap75 = p75 != null ? yourScore - p75 : null
  let status = null
  if (p25 != null && p75 != null) {
    status = yourScore > p75 ? '🟢 Above 75th' : yourScore >= p25 ? '🟡 In Range' : '🔴 Below 25th'
  }
  return { p25, p75, yourScore, gap25, gap75, status, estimated, note: sat.Note }
}

/* ---- normalise a raw university record into a clean shape ---- */
/* Track-aware admission-test profile (0009). undergrad → SAT (from sat_p25/75);
 * law/mba → the generalized admission_tests jsonb keyed by primary_test
 * (LSAT/GMAT/…), compared against the student's matching test_scores entry. */
function buildTestProfile(u, sat, satScore, student) {
  const track = u.track || 'undergrad'
  if (track === 'undergrad') {
    if (!sat) return null
    return { track, type: 'SAT', p25: num(sat['SAT 25th %ile']), p75: num(sat['SAT 75th %ile']),
      median: null, yourScore: satScore ?? null }
  }
  const type = u.primaryTest || (track === 'law' ? 'LSAT' : 'GMAT')
  const r = (u.admissionTests && u.admissionTests[type]) || null
  const yourScore = student?.testScores?.[type] ?? null
  if (!r && yourScore == null) return { track, type, p25: null, p75: null, median: null, yourScore: null }
  const median = r?.median ?? null
  return { track, type, p25: r?.p25 ?? null, p75: r?.p75 ?? null, median, yourScore,
    gapMedian: median != null && yourScore != null ? yourScore - median : null }
}

function normalize(u, satScore, satEstimated, student) {
  const cost = u.cost || {}
  const sat = u.sat || null
  // split verified catalog deadlines by kind so application vs scholarship
  // fall back to the right per-app field
  const vDl = u.verifiedDeadlines || []
  const vApp = vDl.filter((d) => d.kind !== 'scholarship' && d.kind !== 'decision')
  const vSchol = vDl.filter((d) => d.kind === 'scholarship')
  return {
    track: u.track || 'undergrad',
    primaryTest: u.primaryTest ?? null,
    admissionTests: u.admissionTests || null,
    test: buildTestProfile(u, sat, satScore, student),
    id: u.id,
    appId: u.appId || null, // present only via Supabase source; null = read-only record
    catalogId: u.catalogId || null,
    essayRequirements: u.essayRequirements || [], // published, verified (pipeline Layer A)
    verifiedDeadlines: u.verifiedDeadlines || [],
    num: u['#'],
    name: u.University,
    tier: u.Tier,
    country: u.Country,
    programme: u.Programme,
    // per-app value wins; else fall back to the verified catalog deadline so a
    // freshly-onboarded student immediately shows real dates (keyDeadlineRaw keeps
    // the un-fallback'd app value so deadlineEvents() doesn't double-count).
    keyDeadline: u['Key Deadline'] || vApp[0]?.deadline_text || null,
    keyDeadlineRaw: u['Key Deadline'] || null,
    applicationType: u['Application Type'] || vApp.find((d) => d.round)?.round || null,
    entryRequirements: u['Entry Requirements'],
    scholarship: u['Scholarship / Aid'],
    tuitionStr: u['Tuition/yr'],
    tests: u.Tests,
    status: u.Status || 'Not Started',
    priority: u.Priority,
    aidPolicy: u['Aid Policy'],
    appPlatform: u['App Platform'] || (u.track === 'law' ? (u.Country === 'UK' ? 'UCAS' : 'LSAC') : u.track === 'mba' ? 'School portal' : null),
    stemOpt: u['STEM OPT'],
    interview: u['Interview?'],
    completion: u['App Completion %'],
    decisionDate: u['Decision Date'],
    scholDeadline: u['Schol. Deadline'] || vSchol[0]?.deadline_text || null,
    notes: u.Notes,
    links: u.links || {},
    admitRate: u.admitRate ?? null, // verified catalog admit rate (Pipeline E)
    fieldProvenance: u.fieldProvenance || {}, // per-field verification provenance
    program: u.program || null,
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
      // verified, native-currency cost published by the pipeline (Pipeline E)
      verified: cost.verified && (cost.verified.tuition != null || cost.verified.total != null)
        ? {
            currency: cost.verified.currency || 'USD',
            tuition: num(cost.verified.tuition),
            total: num(cost.verified.total),
            sourceUrl: cost.verified.source_url || null,
            cycleYear: cost.verified.cycle_year || null,
          }
        : null,
      // USD-converted figures for the comparison pages. Headline tuition/total
      // prefer the verified official figure; the split + 4-yr/best come from the
      // ₹-lakh estimate converted at the sheet's rate (consistent breakdown).
      usd: (() => {
        const v = cost.verified
        const lt = num(cost['Tuition/yr (₹L)']); const ll = num(cost['Living Costs/yr (₹L)'])
        const lo = num(cost['Other Fees/yr (₹L)']); const ltot = num(cost['TOTAL Annual Cost (₹L)'])
        const lbest = num(cost['Best-Case Annual Cost (₹L)']); const l4 = num(cost['4-Year Total (₹L)'])
        const vt = v && v.tuition != null ? Math.round(toUSD(num(v.tuition), v.currency || 'USD')) : null
        const vtot = v && v.total != null ? Math.round(toUSD(num(v.total), v.currency || 'USD')) : null
        const tuition = vt ?? lakhToUSD(lt)
        const total = vtot ?? lakhToUSD(ltot)
        const appRaw = cost['Application Fee (₹)']
        const appNum = appRaw == null ? null : Number(String(appRaw).replace(/[^0-9.]/g, ''))
        const appFee = appRaw === 'Free' ? 'Free' : (appNum && Number.isFinite(appNum) ? Math.round(toUSD(appNum, 'INR')) : null)
        return {
          tuition, living: lakhToUSD(ll), other: lakhToUSD(lo), total,
          best: lakhToUSD(lbest), fourYear: vtot != null ? vtot * 4 : lakhToUSD(l4),
          appFee, tuitionVerified: vt != null, totalVerified: vtot != null,
          verified: vtot != null || vt != null,
        }
      })(),
    },
    sat: sat ? buildSat(sat, satScore, satEstimated) : null,
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
  // student's SAT is the source of truth; fall back to the constant only when
  // the source doesn't carry it (e.g. the bundled local JSON).
  const satScore = raw.student.satScore ?? SAT_SCORE
  const satEstimated = raw.student.satEstimated ?? SAT_ESTIMATED
  const student = { ...raw.student, satScore, satEstimated }

  const universities = raw.universities
    .map((u) => normalize(u, satScore, satEstimated, student))
    .sort((a, b) => a.num - b.num)
  const getUniversity = (id) => universities.find((u) => u.id === id)

  /* ---- essays + essay<->university mapping ---- */
  const essays = raw.essays.map((e, i) => ({
    id: e.dbId || `essay-${i}`,
    dbId: e.dbId || null, // real DB uuid → enables the Layer B workspace
    scope: e.University,
    scopeTier: e.Tier,
    prompt: e['Essay / Prompt'],
    wordLimit: e['Word Limit'],
    themes: e['Key Themes'],
    status: e['Draft Status'] || 'Not Started',
    notes: e['Notes & Links'],
    workStatus: e.workStatus || 'draft',
    universityId: e.universityId || null,
    essayRequirementId: e.essayRequirementId || null,
    gdocUrl: e.gdocUrl || null,
    wordLimitNum: e.wordLimitNum ?? null,
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
      const seen = new Set()
      // add a DATED event of a given kind, de-duped per kind+date
      const addDated = (text, label, kind) => {
        if (!text || isIntakeNote(text)) return false
        const d = parseDate(text)
        if (!d) return false
        const key = `${kind}|${d.getTime()}`
        if (seen.has(key)) return true
        seen.add(key)
        ev.push({ uni: u, date: d, kind, label: label || text, approx: isApprox(text) })
        return true
      }
      let appDated = false
      // 1) per-application key deadline (Excel; may hold several pipe/newline-separated)
      const parts = String(u.keyDeadlineRaw || '').split(/\n|\s\|\s/).map((p) => p.trim()).filter(Boolean)
      for (const p of parts) appDated = addDated(p, p, 'deadline') || appDated
      // 2) verified catalog deadlines — application + scholarship rounds (every MBA round)
      for (const vd of u.verifiedDeadlines || []) {
        const kind = vd.kind === 'scholarship' ? 'scholarship' : vd.kind === 'decision' ? 'decision' : 'deadline'
        const label = vd.round && !/^regular decision$/i.test(vd.round) && !/^scholarship$/i.test(vd.round) && !/deadline$/i.test(vd.round)
          ? `${vd.round}: ${vd.deadline_text}` : vd.deadline_text
        const ok = addDated(vd.deadline_text, label, kind)
        if (ok && kind === 'deadline') appDated = true
      }
      // 3) no dated application deadline → one undated placeholder (e.g. "opens ~autumn 2026")
      if (!appDated) {
        const txt = parts[0] || (u.verifiedDeadlines || []).find((d) => d.kind !== 'scholarship' && d.kind !== 'decision')?.deadline_text || u.keyDeadline
        if (txt) ev.push({ uni: u, date: null, kind: 'deadline', label: txt, approx: true })
      }
      // 4) legacy per-app scholarship/decision dates (Excel students)
      if (u.scholDeadline && !/same as app|n\/a|rolling|automatic|no separate|need-based/i.test(u.scholDeadline)) {
        addDated(u.scholDeadline, u.scholDeadline, 'scholarship')
      }
      addDated(u.decisionDate, u.decisionDate, 'decision')
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
