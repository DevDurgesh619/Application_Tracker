import { supabase } from '../lib/supabaseClient'

/* ------------------------------------------------------------------ *
 *  Students + onboarding (Phase 2). Multi-student under one counsellor,
 *  catalog-driven application creation, and a transparent tier fit-score.
 * ------------------------------------------------------------------ */

function bandFromAdmit(admitPct) {
  if (admitPct == null) return 'Target'
  return admitPct < 15 ? 'Reach' : admitPct < 35 ? 'Realistic Reach' : admitPct < 60 ? 'Target' : 'Safety'
}

/** Transparent "suggested fit" — track-aware. undergrad bands on SAT vs sat_p25/75;
 *  law/mba band on the student's LSAT/GMAT vs the school's admission_tests range
 *  (median fallback), then admit-rate (a PERCENT, e.g. 4.2) refines. `score` is the
 *  student's score for THIS uni's track. Framed as a suggestion, never a chance. */
export function suggestTier(score, uni) {
  const track = uni?.track || 'undergrad'
  const admit = uni?.admit_rate // percent (e.g. 8.05)
  let base
  if (track === 'undergrad') {
    const p25 = uni?.sat_p25, p75 = uni?.sat_p75
    if (score && p25 && p75) base = score < p25 ? 'Reach' : score <= p75 ? 'Realistic Reach' : 'Target'
    else base = bandFromAdmit(admit)
  } else {
    const r = uni?.admission_tests?.[uni?.primary_test || (track === 'law' ? 'LSAT' : 'GMAT')]
    const p25 = r?.p25, p75 = r?.p75, med = r?.median
    if (score && p25 && p75) base = score < p25 ? 'Reach' : score <= p75 ? 'Realistic Reach' : 'Target'
    else if (score && med) base = score >= med ? 'Realistic Reach' : 'Reach'
    else base = bandFromAdmit(admit)
  }
  // ultra-selective (<8% admit) is a reach regardless of scores
  if (admit != null && admit < 8 && base !== 'Reach') base = base === 'Target' ? 'Realistic Reach' : 'Reach'
  // very generous admit + strong score → safety
  if (admit != null && admit > 50 && base === 'Target') base = 'Safety'
  return base
}

/** All students for the logged-in counsellor, with application counts. */
export async function listStudents() {
  const { data: students, error } = await supabase.from('students').select('*').order('created_at')
  if (error) throw error
  const { data: apps } = await supabase.from('applications').select('student_id, is_archived')
  const counts = {}
  for (const a of apps || []) if (!a.is_archived) counts[a.student_id] = (counts[a.student_id] || 0) + 1
  return (students || []).map((s) => ({ ...s, appCount: counts[s.id] || 0 }))
}

/** Catalog universities + their programs, for the onboarding picker. */
export async function loadCatalog() {
  const [{ data: unis }, { data: programs }] = await Promise.all([
    supabase.from('universities').select('*').order('name'),
    supabase.from('programs').select('id, university_id, name, degree, college, is_stem, track'),
  ])
  const progByUni = {}
  for (const p of programs || []) (progByUni[p.university_id] ||= []).push(p)
  return (unis || []).map((u) => ({ ...u, programs: progByUni[u.id] || [] }))
}

/** Create a student from the onboarding profile. Returns the new student id. */
export async function createStudent(profile) {
  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    counsellor_id: user.id,
    full_name: profile.full_name,
    class_of: profile.class_of || null,
    profile_summary: profile.profile_summary || null,
    sat_score: profile.sat_score ?? null,
    sat_estimated: !!profile.sat_estimated,
    ib_predicted: profile.ib_predicted || null,
    gpa: profile.gpa ?? null,
    intended_major: profile.intended_major || null,
    budget_currency: profile.budget_currency || null,
    budget_max_per_year: profile.budget_max_per_year ?? null,
    target_countries: profile.target_countries?.length ? profile.target_countries : null,
    // multi-track (0009): track, generalized test scores, MBA work experience
    track: profile.track || 'undergrad',
    test_scores: profile.test_scores && Object.keys(profile.test_scores).length ? profile.test_scores : null,
    work_experience_months: profile.work_experience_months ?? null,
    status: 'active',
  }
  const { data, error } = await supabase.from('students').insert(row).select('id').single()
  if (error) throw error
  return data.id
}

/**
 * Seed a student's essay tracker from the verified published essay_requirements
 * for the universities they're applying to (Phase 1.3). One workspace-linked row
 * per official prompt; identical prompts across schools (e.g. the shared UC PIQs)
 * are deduped so they're tracked once. Returns the number of essay rows created.
 */
export async function seedEssaysFromRequirements(studentId, universityIds) {
  if (!universityIds?.length) return 0
  const [{ data: unis }, { data: reqs }] = await Promise.all([
    supabase.from('universities').select('id, name').in('id', universityIds),
    supabase.from('essay_requirements').select('*').eq('status', 'published').in('university_id', universityIds).order('sort_order'),
  ])
  if (!reqs?.length) return 0
  const nameById = Object.fromEntries((unis || []).map((u) => [u.id, u.name]))
  const seen = new Set()
  const rows = []
  for (const r of reqs) {
    const key = String(r.prompt_text || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue // dedupe identical prompts (shared UC PIQs etc.)
    seen.add(key)
    rows.push({
      student_id: studentId, scope: nameById[r.university_id] || null, scope_tier: null,
      prompt: r.prompt_text, word_limit: r.word_limit ? `${r.word_limit} words` : 'Open',
      word_limit_num: r.word_limit ?? null, themes: null, status: 'draft', work_status: 'draft',
      university_id: r.university_id, essay_requirement_id: r.id, gdoc_url: null,
    })
  }
  if (!rows.length) return 0
  const { error } = await supabase.from('essays').insert(rows)
  if (error) throw error
  return rows.length
}

/**
 * Create applications for a student from chosen (university, program, tier) picks.
 * tier_source = 'suggested' (counsellor can override later → 'overridden').
 */
export async function createApplications(studentId, picks) {
  if (!picks.length) return 0
  const rows = picks.map((p, i) => ({
    student_id: studentId,
    university_id: p.university_id,
    program_id: p.program_id || null,
    tier: p.tier || null,
    tier_source: 'suggested',
    list_rank: i + 1,
    status: 'Not Started',
  }))
  const { error } = await supabase.from('applications').insert(rows)
  if (error) throw error
  return rows.length
}

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Counsellor-led "add a university not in the catalog" path (onboarding §3.1). */
export async function addCustomUniversity({ name, country, programName, track = 'undergrad' }) {
  const { data: { user } } = await supabase.auth.getUser()
  const slug = `${slugify(name)}-${Math.abs(hashStr(name + country)) % 9000 + 1000}`
  const { data: uni, error } = await supabase
    .from('universities')
    .insert({ slug, name, country: country || null, track, verified_at: null, verified_by: user.id })
    .select('*').single()
  if (error) throw error
  let program = null
  if (programName) {
    const { data: p } = await supabase.from('programs').insert({ university_id: uni.id, name: programName, track }).select('*').single()
    program = p
  }
  return { ...uni, programs: program ? [program] : [] }
}

export async function archiveStudent(id) {
  const { error } = await supabase.from('students').update({ status: 'archived' }).eq('id', id)
  if (error) throw error
}
export async function restoreStudent(id) {
  const { error } = await supabase.from('students').update({ status: 'active' }).eq('id', id)
  if (error) throw error
}

function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0; return h }
