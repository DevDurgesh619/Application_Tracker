/* ════════════════════════════════════════════════════════════════════
 *  Register an official page in verification_sources (Pipeline A).
 *  One row per (university/program × fact_type × URL [× platform]).
 *
 *  Usage (from dashboard/):
 *    node scripts/pipeline/register-source.mjs \
 *      --university yale --fact essay --platform common_app \
 *      --url "https://admissions.yale.edu/essay-topics" [--frequency monthly] \
 *      [--program "Dyson"] [--notes "supplement"]
 *
 *  --fact ∈ essay|deadline|entry_req|stem|test_policy|sat|cost|scholarship|admit_rate
 *  --university matches a catalog slug or name (substring ok). Omit for a
 *  university-agnostic source (rare).
 * ════════════════════════════════════════════════════════════════════ */
import { loadEnv, db, parseArgs } from './lib.mjs'
loadEnv()

const FACT_TYPES = ['essay', 'deadline', 'entry_req', 'stem', 'test_policy', 'sat', 'cost', 'scholarship', 'admit_rate']
const a = parseArgs()

for (const req of ['fact', 'url']) {
  if (!a[req] || a[req] === true) { console.error(`✗ missing --${req}`); process.exit(1) }
}
if (!FACT_TYPES.includes(a.fact)) {
  console.error(`✗ --fact must be one of: ${FACT_TYPES.join(', ')}`); process.exit(1)
}

const sb = db()

// resolve university by slug or name (substring)
let universityId = null
if (a.university && a.university !== true) {
  const { data, error } = await sb.from('universities').select('id, slug, name')
  if (error) { console.error('✗', error.message); process.exit(1) }
  const q = String(a.university).toLowerCase()
  const u = data.find((x) => x.slug === q) ||
            data.find((x) => x.name.toLowerCase() === q) ||
            data.find((x) => x.slug.includes(q) || x.name.toLowerCase().includes(q))
  if (!u) { console.error(`✗ no university matching "${a.university}"`); process.exit(1) }
  universityId = u.id
  console.log('•', 'university:', u.name, `(${u.slug})`)
}

// resolve program (optional, within the university)
let programId = null
if (a.program && a.program !== true && universityId) {
  const { data } = await sb.from('programs').select('id, name').eq('university_id', universityId)
  const p = (data || []).find((x) => x.name.toLowerCase().includes(String(a.program).toLowerCase()))
  if (p) { programId = p.id; console.log('•', 'program:', p.name) }
  else console.warn('  (no program matched "%s" — registering at university scope)', a.program)
}

const row = {
  university_id: universityId,
  program_id: programId,
  fact_type: a.fact,
  platform: a.platform && a.platform !== true ? a.platform : null,
  source_url: a.url,
  fetch_frequency: a.frequency && a.frequency !== true ? a.frequency : 'monthly',
  notes: a.notes && a.notes !== true ? a.notes : null,
}

let { data, error } = await sb.from('verification_sources').insert(row).select().single()
if (error && error.code === '23505') {
  const { data: ex } = await sb
    .from('verification_sources')
    .select('*')
    .eq('fact_type', row.fact_type)
    .eq('source_url', row.source_url)
  data = ex?.[0]
  console.log('•', 'already registered — reusing existing source')
} else if (error) {
  console.error('✗ insert failed:', error.message); process.exit(1)
}

console.log(`✓ source ${data.id}`)
console.log(`  ${row.fact_type}${row.platform ? ` [${row.platform}]` : ''} · ${row.source_url}`)
console.log(`  next: node scripts/pipeline/fetch-source.mjs --source ${data.id}`)
