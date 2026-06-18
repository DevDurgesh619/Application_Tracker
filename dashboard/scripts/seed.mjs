/* ════════════════════════════════════════════════════════════════════
 *  Phase 1 seed — decompose master.json into the Supabase schema.
 *  Run from dashboard/:  node scripts/seed.mjs
 *  Reads secrets from the repo-root .env (SUPABASE_URL, SERVICE_ROLE_KEY,
 *  optional SEED_COUNSELLOR_EMAIL / SEED_COUNSELLOR_PASSWORD).
 *  Uses the service role (bypasses RLS). Idempotent: wipes & re-seeds.
 * ════════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '../..')

// minimal .env loader (root .env)
function loadEnv(p) {
  try {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {}
}
loadEnv(resolve(root, '.env'))

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1) }

const EMAIL = process.env.SEED_COUNSELLOR_EMAIL || 'wallickglobalconsulting@gmail.com'
const PASSWORD = process.env.SEED_COUNSELLOR_PASSWORD || ('Tracker-' + Math.random().toString(36).slice(2, 10) + '!9')

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const master = JSON.parse(readFileSync(resolve(__dir, '../src/data/master.json'), 'utf8'))

const log = (...a) => console.log('•', ...a)
const die = (m, e) => { console.error('✗', m, e?.message || e || ''); process.exit(1) }

/* ---------- 1. counsellor auth user ---------- */
async function ensureCounsellor() {
  // find existing by listing (admin)
  const { data: list } = await db.auth.admin.listUsers()
  let user = list?.users?.find((u) => u.email === EMAIL)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: 'Counsellor' },
    })
    if (error) die('create auth user', error)
    user = data.user
    log('created counsellor login:', EMAIL, '/ password:', PASSWORD)
  } else {
    log('counsellor already exists:', EMAIL, '(password unchanged)')
  }
  // ensure counsellor row (trigger should have made it; upsert to be safe)
  await db.from('counsellors').upsert({ id: user.id, email: EMAIL, full_name: 'Counsellor', role: 'admin' })
  return user.id
}

/* ---------- 2. wipe previous seed (idempotent) ---------- */
async function wipe(counsellorId) {
  // student-scoped cascades; then catalog
  const { data: students } = await db.from('students').select('id').eq('counsellor_id', counsellorId)
  for (const s of students || []) await db.from('students').delete().eq('id', s.id)
  for (const t of ['audit_checks', 'programs', 'universities', 'catalog_meta']) {
    await db.from(t).delete().neq(t === 'catalog_meta' ? 'key' : 'id', t === 'catalog_meta' ? '' : '00000000-0000-0000-0000-000000000000')
  }
  log('wiped previous seed')
}

async function run() {
  const counsellorId = await ensureCounsellor()
  await wipe(counsellorId)

  /* ---------- 3. universities (catalog) + programs ---------- */
  const uniRows = master.universities.map((u) => ({
    slug: u.id,
    name: u.University,
    country: u.Country,
    programmes: u.Programme ? [{ name: u.Programme }] : null,
    test_policy: u.Tests,
    sat_p25: u.sat ? toInt(u.sat['SAT 25th %ile']) : null,
    sat_p75: u.sat ? toInt(u.sat['SAT 75th %ile']) : null,
    cost_reference: u.cost || null,
    official_links: u.links || null,
    aid_policy: u['Aid Policy'],
    source_cycle: '2026-2027',
  }))
  const { data: unis, error: ue } = await db.from('universities').insert(uniRows).select('id, slug')
  if (ue) die('insert universities', ue)
  const slugToId = Object.fromEntries(unis.map((r) => [r.slug, r.id]))
  log('inserted', unis.length, 'universities')

  const progRows = master.universities
    .filter((u) => u.Programme)
    .map((u) => ({ university_id: slugToId[u.id], name: u.Programme, is_stem: /yes|✓/i.test(u['STEM OPT'] || '') }))
  const { data: progs, error: pe } = await db.from('programs').insert(progRows).select('id, university_id')
  if (pe) die('insert programs', pe)
  const uniToProg = Object.fromEntries(progs.map((r) => [r.university_id, r.id]))
  log('inserted', progs.length, 'programs')

  /* ---------- 4. student (Mehek) ---------- */
  const s = master.student
  const { data: student, error: se } = await db.from('students').insert({
    counsellor_id: counsellorId,
    full_name: s.name,
    class_of: s.classOf,
    profile_summary: s.profile,
    sat_score: 1540,
    sat_estimated: true,
    status: 'active',
  }).select('id').single()
  if (se) die('insert student', se)
  const studentId = student.id
  log('inserted student:', s.name)

  /* ---------- 5. applications (decompose per university) ---------- */
  const appRows = master.universities.map((u, i) => ({
    student_id: studentId,
    university_id: slugToId[u.id],
    program_id: uniToProg[slugToId[u.id]] || null,
    list_rank: typeof u['#'] === 'number' ? u['#'] : i + 1,
    tier: u.Tier,
    status: u.Status || 'Not Started',
    priority: u.Priority,
    app_platform: u['App Platform'],
    app_type: u['Application Type'],
    key_deadline: u['Key Deadline'],
    decision_date: u['Decision Date'],
    scholarship_deadline: u['Schol. Deadline'],
    entry_requirements: u['Entry Requirements'],
    scholarship: u['Scholarship / Aid'],
    tuition_str: u['Tuition/yr'],
    tests: u.Tests,
    aid_policy: u['Aid Policy'],
    stem_opt: u['STEM OPT'],
    interview: u['Interview?'],
    completion: u['App Completion %'],
    notes: u.Notes,
  }))
  const { error: ae } = await db.from('applications').insert(appRows)
  if (ae) die('insert applications', ae)
  log('inserted', appRows.length, 'applications')

  /* ---------- 6. essays / interviews / activities / honors ---------- */
  await insert('essays', master.essays.map((e) => ({
    student_id: studentId, scope: e.University, scope_tier: e.Tier, prompt: e['Essay / Prompt'],
    word_limit: String(e['Word Limit'] ?? ''), themes: e['Key Themes'],
    status: e['Draft Status'] || 'Not Started', notes: e['Notes & Links'],
  })))
  await insert('interviews', master.interviews.map((iv) => ({
    student_id: studentId, scope: iv.University, scheduled_date: iv.Date, format: iv.Format,
    prep_status: iv['Prep Status'], outcome: iv.Outcome, interviewer: iv.Interviewer, notes: iv.Notes,
  })))
  await insert('activities', master.activities.map((a, i) => ({
    student_id: studentId, name: a['Activity / Honor Name'], org: a.Organisation, position: a['Position & Status'],
    description: a['Description (150 chars for Common App)'], skills: a['Skills Applied'], impact: a['Impact & Key Outcomes'], sort_order: i,
  })))
  await insert('honors', master.honors.map((h, i) => ({
    student_id: studentId, name: h['Honor / Award Name'], body: h['Awarding Body'], level: h['Level / Recognition'],
    description: h.Description, why: h['Why It Matters'], sort_order: i,
  })))

  /* ---------- 7. audit checks (catalog) ---------- */
  await insert('audit_checks', (master.audit || []).map((a, i) => ({
    university_id: matchUni(a.University, slugToId) || null,
    scope_label: a.University, field: a['Field checked'], tracker_value: a['ChatGPT / tracker value'],
    verdict: a.Verdict, verified_value: a['Verified correct value'], source_url: a['Official source'], sort_order: i,
  })))

  /* ---------- 8. meta (bigErrors) ---------- */
  await db.from('catalog_meta').upsert({ key: 'bigErrors', value: master.bigErrors || [] })
  log('inserted catalog_meta: bigErrors')

  console.log('\n✓ Seed complete.')
  console.log('  Login:', EMAIL)
  if (!process.env.SEED_COUNSELLOR_PASSWORD) console.log('  Password:', PASSWORD, '  (save this — change it after first login)')

  async function insert(table, rows) {
    if (!rows.length) return
    const { error } = await db.from(table).insert(rows)
    if (error) die('insert ' + table, error)
    log('inserted', rows.length, table)
  }
}

function toInt(v) { const x = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(x) ? x : null }
function matchUni(label, slugToId) {
  const slug = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slugToId[slug]
}

run().catch((e) => die('seed', e))
