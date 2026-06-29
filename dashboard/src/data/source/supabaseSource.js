import { supabase } from '../../lib/supabaseClient'

/* ════════════════════════════════════════════════════════════════════
 *  Supabase source — the Phase 1 swap target.
 *  Queries the split schema (catalog + per-student) and RECOMPOSES it
 *  into the exact master.json shape that buildDataset() already consumes,
 *  so dataset.js and the entire UI stay unchanged.
 *  RLS ensures the logged-in counsellor only sees their own student data.
 * ════════════════════════════════════════════════════════════════════ */

export async function loadRawData(studentId) {
  // load the selected student (Phase 2 multi-student); fall back to the
  // first active student when no id is given.
  let q = supabase.from('students').select('*')
  q = studentId ? q.eq('id', studentId) : q.eq('status', 'active').order('created_at').limit(1)
  const { data: students, error: se } = await q
  if (se) throw se
  const student = students?.[0]
  if (!student) throw new Error('No student found for this account.')

  const [apps, unis, programs, essays, interviews, activities, honors, audit, meta, essayReqs, deadlines] = await Promise.all([
    supabase.from('applications').select('*').eq('student_id', student.id).order('list_rank'),
    supabase.from('universities').select('*'),
    supabase.from('programs').select('*'),
    supabase.from('essays').select('*').eq('student_id', student.id),
    supabase.from('interviews').select('*').eq('student_id', student.id),
    supabase.from('activities').select('*').eq('student_id', student.id).order('sort_order'),
    supabase.from('honors').select('*').eq('student_id', student.id).order('sort_order'),
    supabase.from('audit_checks').select('*').order('sort_order'),
    supabase.from('catalog_meta').select('*').eq('key', 'bigErrors').maybeSingle(),
    // published, human-verified catalog facts from the pipeline (Phase 3 Layer A)
    supabase.from('essay_requirements').select('*').eq('status', 'published').order('sort_order'),
    supabase.from('university_deadlines').select('*').eq('status', 'published').order('sort_order'),
  ])
  for (const r of [apps, unis, programs, essays, interviews, activities, honors, audit]) if (r.error) throw r.error

  const uniById = Object.fromEntries((unis.data || []).map((u) => [u.id, u]))
  const programById = Object.fromEntries((programs.data || []).map((p) => [p.id, p]))

  // group published pipeline facts by catalog university
  const groupBy = (rows, key) => (rows || []).reduce((m, r) => ((m[r[key]] ||= []).push(r), m), {})
  const reqsByUni = groupBy(essayReqs.data, 'university_id')
  const deadlinesByUni = groupBy(deadlines.data, 'university_id')

  // recompose each application + its catalog university into the fused record
  const universities = (apps.data || [])
    .filter((a) => !a.is_archived)
    .map((a) => {
      const u = uniById[a.university_id] || {}
      const program = a.program_id ? programById[a.program_id] || null : null
      const cost = u.cost_reference || {}
      const sat = u.sat_p25 != null || u.sat_p75 != null
        ? { 'SAT 25th %ile': u.sat_p25, 'SAT 75th %ile': u.sat_p75, Note: null }
        : null
      // Per-app value wins; otherwise fall back to the verified catalog fact
      // (Pipeline E) so a newly-onboarded student inherits real data. Program
      // scope wins over university where present (entry req / STEM).
      return {
        '#': a.list_rank,
        id: u.slug,
        appId: a.id, // applications row id — write target for edits
        catalogId: a.university_id, // catalog university uuid — key for published facts
        essayRequirements: reqsByUni[a.university_id] || [],
        verifiedDeadlines: deadlinesByUni[a.university_id] || [],
        University: u.name,
        Tier: a.tier,
        Country: u.country,
        Programme: program?.name || (u.programmes && u.programmes[0]?.name) || null,
        'Key Deadline': a.key_deadline,
        'Application Type': a.app_type,
        'Entry Requirements': a.entry_requirements ?? program?.entry_requirements ?? null,
        'Scholarship / Aid': a.scholarship,
        'Tuition/yr': a.tuition_str,
        Tests: a.tests ?? u.test_policy ?? null,
        Status: a.status,
        Priority: a.priority,
        'Aid Policy': a.aid_policy ?? u.aid_policy ?? null,
        'App Platform': a.app_platform,
        'STEM OPT': a.stem_opt ?? (program?.is_stem == null ? u.stem_notes : (program.is_stem ? 'STEM-designated' : 'Not STEM-designated')) ?? null,
        'Interview?': a.interview,
        'App Completion %': a.completion,
        'Decision Date': a.decision_date,
        'Schol. Deadline': a.scholarship_deadline,
        Notes: a.notes,
        links: u.official_links || {},
        cost,
        sat,
        admitRate: u.admit_rate ?? null,
        // multi-track (0009): track + generalized admission tests (LSAT/GMAT/…)
        track: u.track || 'undergrad',
        primaryTest: u.primary_test ?? null,
        admissionTests: u.admission_tests || null,
        fieldProvenance: u.field_provenance || {},
        program,
      }
    })

  return {
    student: {
      id: student.id,
      name: student.full_name,
      classOf: student.class_of,
      profile: student.profile_summary,
      satScore: student.sat_score,
      satEstimated: student.sat_estimated,
      // multi-track (0009): student's track + generalized scores + MBA work-ex
      track: student.track || 'undergrad',
      testScores: student.test_scores || null,
      workExperienceMonths: student.work_experience_months ?? null,
      schools: universities.length,
    },
    universities,
    essays: (essays.data || []).map((e) => ({
      University: e.scope, Tier: e.scope_tier, 'Essay / Prompt': e.prompt,
      'Word Limit': maybeNum(e.word_limit), 'Key Themes': e.themes,
      'Draft Status': e.status, 'Notes & Links': e.notes,
      // Layer B workspace fields
      dbId: e.id, workStatus: e.work_status, universityId: e.university_id,
      essayRequirementId: e.essay_requirement_id, gdocUrl: e.gdoc_url, wordLimitNum: e.word_limit_num,
    })),
    interviews: (interviews.data || []).map((iv) => ({
      University: iv.scope, Date: iv.scheduled_date, Format: iv.format,
      'Prep Status': iv.prep_status, Outcome: iv.outcome, Interviewer: iv.interviewer, Notes: iv.notes,
    })),
    activities: (activities.data || []).map((a) => ({
      'Activity / Honor Name': a.name, Organisation: a.org, 'Position & Status': a.position,
      'Description (150 chars for Common App)': a.description, 'Skills Applied': a.skills, 'Impact & Key Outcomes': a.impact,
    })),
    honors: (honors.data || []).map((h) => ({
      'Honor / Award Name': h.name, 'Awarding Body': h.body, 'Level / Recognition': h.level,
      Description: h.description, 'Why It Matters': h.why,
    })),
    audit: (audit.data || []).map((a) => ({
      '#': a.sort_order, University: a.scope_label, 'Field checked': a.field,
      'ChatGPT / tracker value': a.tracker_value, Verdict: a.verdict,
      'Verified correct value': a.verified_value, 'Official source': a.source_url,
    })),
    bigErrors: meta.data?.value || [],
  }
}

function maybeNum(v) {
  if (v == null || v === '') return v
  const num = Number(v)
  return Number.isFinite(num) && String(num) === String(v).trim() ? num : v
}
