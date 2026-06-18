import { supabase } from '../../lib/supabaseClient'

/* ════════════════════════════════════════════════════════════════════
 *  Supabase source — the Phase 1 swap target.
 *  Queries the split schema (catalog + per-student) and RECOMPOSES it
 *  into the exact master.json shape that buildDataset() already consumes,
 *  so dataset.js and the entire UI stay unchanged.
 *  RLS ensures the logged-in counsellor only sees their own student data.
 * ════════════════════════════════════════════════════════════════════ */

export async function loadRawData() {
  // single active student for the logged-in counsellor (Phase 1)
  const { data: students, error: se } = await supabase
    .from('students').select('*').eq('status', 'active').limit(1)
  if (se) throw se
  const student = students?.[0]
  if (!student) throw new Error('No student found for this account. Has the seed run?')

  const [apps, unis, essays, interviews, activities, honors, audit, meta] = await Promise.all([
    supabase.from('applications').select('*').eq('student_id', student.id).order('list_rank'),
    supabase.from('universities').select('*'),
    supabase.from('essays').select('*').eq('student_id', student.id),
    supabase.from('interviews').select('*').eq('student_id', student.id),
    supabase.from('activities').select('*').eq('student_id', student.id).order('sort_order'),
    supabase.from('honors').select('*').eq('student_id', student.id).order('sort_order'),
    supabase.from('audit_checks').select('*').order('sort_order'),
    supabase.from('catalog_meta').select('*').eq('key', 'bigErrors').maybeSingle(),
  ])
  for (const r of [apps, unis, essays, interviews, activities, honors, audit]) if (r.error) throw r.error

  const uniById = Object.fromEntries((unis.data || []).map((u) => [u.id, u]))

  // recompose each application + its catalog university into the fused record
  const universities = (apps.data || [])
    .filter((a) => !a.is_archived)
    .map((a) => {
      const u = uniById[a.university_id] || {}
      const cost = u.cost_reference || {}
      const sat = u.sat_p25 != null || u.sat_p75 != null
        ? { 'SAT 25th %ile': u.sat_p25, 'SAT 75th %ile': u.sat_p75, Note: null }
        : null
      return {
        '#': a.list_rank,
        id: u.slug,
        University: u.name,
        Tier: a.tier,
        Country: u.country,
        Programme: (u.programmes && u.programmes[0]?.name) || null,
        'Key Deadline': a.key_deadline,
        'Application Type': a.app_type,
        'Entry Requirements': a.entry_requirements,
        'Scholarship / Aid': a.scholarship,
        'Tuition/yr': a.tuition_str,
        Tests: a.tests,
        Status: a.status,
        Priority: a.priority,
        'Aid Policy': a.aid_policy,
        'App Platform': a.app_platform,
        'STEM OPT': a.stem_opt,
        'Interview?': a.interview,
        'App Completion %': a.completion,
        'Decision Date': a.decision_date,
        'Schol. Deadline': a.scholarship_deadline,
        Notes: a.notes,
        links: u.official_links || {},
        cost,
        sat,
      }
    })

  return {
    student: {
      name: student.full_name,
      classOf: student.class_of,
      profile: student.profile_summary,
      schools: universities.length,
    },
    universities,
    essays: (essays.data || []).map((e) => ({
      University: e.scope, Tier: e.scope_tier, 'Essay / Prompt': e.prompt,
      'Word Limit': maybeNum(e.word_limit), 'Key Themes': e.themes,
      'Draft Status': e.status, 'Notes & Links': e.notes,
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
