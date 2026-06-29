/* ════════════════════════════════════════════════════════════════════
 *  Seed engineering/CS undergrad universities from a verified JSON file.
 *
 *  Idempotent: keyed by university `slug`. Re-running with the same slug
 *  UPDATES the university row and REPLACES its child rows (deadlines,
 *  essays, verification_sources, program) so research can be re-run safely.
 *
 *  Input JSON: an array of records — see seed-engineering.data.json.
 *  Every fact carries a `source_url`; nothing is invented. Missing data is
 *  left null (and surfaced honestly in the UI), never guessed.
 *
 *    node dashboard/scripts/seed-engineering.mjs <path-to-json> [--dry]
 * ════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs'
import { loadEnv, db } from './pipeline/lib.mjs'

loadEnv()
const s = db()

const CURATOR = 'd9606ee0-d74a-4f5a-bb67-1992053abfd0' // verified_by (Claude Code curator)
const CYCLE = '2026-2027'
const NOW = new Date().toISOString()

const file = process.argv[2]
const DRY = process.argv.includes('--dry')
if (!file) { console.error('usage: node seed-engineering.mjs <json> [--dry]'); process.exit(1) }

const records = JSON.parse(readFileSync(file, 'utf8'))
console.log(`Loaded ${records.length} university records${DRY ? ' (DRY RUN)' : ''}\n`)

/** essay_requirements.platform is a check-constrained enum: common_app | uc | coalition | direct.
 *  Map free-text application-system names (UCAS, ApplyTexas, combined strings) onto it. */
function normPlatform(p) {
  const v = String(p || '').toLowerCase()
  if (['common_app', 'uc', 'coalition', 'direct'].includes(v)) return v
  if (v.includes('common')) return 'common_app'        // "ApplyTexas / Common App", "Common App / Coalition"
  if (v.includes('coalition')) return 'coalition'
  if (v.includes('uchicago')) return 'common_app'      // UChicago supplements ride on Common App/Coalition
  if (v.includes('uc ') || v === 'uc') return 'uc'
  return 'direct'                                       // UCAS, school portals, etc.
}

/** provenance entry for a single catalog field */
const prov = (source_url, quote = null) => ({
  quote, cycle_year: CYCLE, source_url: source_url || null,
  snapshot_id: null, verified_at: NOW, verified_by: CURATOR,
})

let ok = 0, fail = 0
for (const r of records) {
  try {
    await upsert(r)
    ok++
  } catch (e) {
    fail++
    console.error(`  ✗ ${r.slug}: ${e.message}`)
  }
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`)

async function upsert(r) {
  const cost = r.cost
    ? { verified: { total: r.cost.total ?? null, tuition: r.cost.tuition ?? null, currency: r.cost.currency, cycle_year: CYCLE, source_url: r.cost.source_url || null } }
    : null

  // per-field provenance for the scalar facts we publish
  const fp = {}
  if (r.test_policy && r.sources?.test_policy) fp.test_policy = prov(r.sources.test_policy)
  if ((r.sat_p25 || r.sat_p75) && r.sources?.sat) { fp.sat_p25 = prov(r.sources.sat); fp.sat_p75 = prov(r.sources.sat) }
  if (r.admit_rate != null && r.sources?.admit_rate) fp.admit_rate = prov(r.sources.admit_rate)
  if (cost && r.cost.source_url) fp.cost_reference = prov(r.cost.source_url)
  if (r.aid_policy && r.sources?.scholarship) fp.aid_policy = prov(r.sources.scholarship)

  const uniRow = {
    slug: r.slug,
    name: r.name,
    country: r.country,
    city: r.city || null,
    programmes: r.programmes || (r.program ? [{ name: r.program.name }] : null),
    test_policy: r.test_policy || null,
    sat_p25: r.sat_p25 ?? null,
    sat_p75: r.sat_p75 ?? null,
    admit_rate: r.admit_rate ?? null,
    cost_reference: cost,
    official_links: r.official_links || null,
    aid_policy: r.aid_policy || null,
    stem_notes: r.stem_notes || null,
    source_cycle: CYCLE,
    verified_at: NOW,
    verified_by: CURATOR,
    field_provenance: Object.keys(fp).length ? fp : null,
    track: 'undergrad',
    primary_test: r.primary_test || null,
    admission_tests: r.admission_tests || null,
  }

  if (DRY) {
    const d = (r.deadlines || []).length, e = (r.essays || []).length, src = Object.keys(r.sources || {}).length
    console.log(`  • ${r.slug.padEnd(26)} ${r.country.padEnd(7)} sat=${r.sat_p25 ?? '—'}/${r.sat_p75 ?? '—'} admit=${r.admit_rate ?? '—'} cost=${r.cost?.tuition ?? '—'}${r.cost?.currency || ''} dl=${d} essays=${e} sources=${src}`)
    return
  }

  // upsert university by slug
  const { data: u, error: ue } = await s
    .from('universities')
    .upsert(uniRow, { onConflict: 'slug' })
    .select('id')
    .single()
  if (ue) throw new Error('university upsert: ' + ue.message)
  const uid = u.id

  // replace children (idempotent re-run)
  for (const t of ['university_deadlines', 'essay_requirements', 'verification_sources'])
    await s.from(t).delete().eq('university_id', uid)
  await s.from('programs').delete().eq('university_id', uid)

  // program (one representative engineering/CS program)
  if (r.program) {
    const { error } = await s.from('programs').insert({
      university_id: uid, name: r.program.name, is_stem: r.program.is_stem ?? true,
      track: 'undergrad', verified_at: NOW, verified_by: CURATOR,
      field_provenance: r.program.source_url ? { name: prov(r.program.source_url) } : null,
    })
    if (error) throw new Error('program: ' + error.message)
  }

  // deadlines
  if (r.deadlines?.length) {
    const rows = r.deadlines.map((d, i) => ({
      university_id: uid, program_id: null,
      round: d.round || null, deadline_text: d.deadline_text,
      date: d.date || null, kind: d.kind || 'application',
      sort_order: i, cycle_year: CYCLE, source_url: d.source_url || null,
      verified_at: NOW, verified_by: CURATOR, status: 'published',
    }))
    const { error } = await s.from('university_deadlines').insert(rows)
    if (error) throw new Error('deadlines: ' + error.message)
  }

  // essay requirements
  if (r.essays?.length) {
    const rows = r.essays.map((e, i) => ({
      university_id: uid, program_id: null,
      platform: e.platform ? normPlatform(e.platform) : null, section: e.section || null,
      prompt_title: e.prompt_title || null, prompt_text: e.prompt_text,
      word_limit: e.word_limit ?? null, char_limit: e.char_limit ?? null,
      choose_count: e.choose_count ?? null, choose_of: e.choose_of ?? null,
      conditions: e.conditions || null, sort_order: e.sort_order ?? i,
      cycle_year: CYCLE, source_url: e.source_url || null,
      verified_at: NOW, verified_by: CURATOR, status: 'published',
    }))
    const { error } = await s.from('essay_requirements').insert(rows)
    if (error) throw new Error('essays: ' + error.message)
  }

  // verification_sources — one per fact_type, so the firecrawl pipeline reuses them
  const FREQ = { essay: 'quarterly', deadline: 'monthly', sat: 'monthly', test_policy: 'monthly', admit_rate: 'monthly', cost: 'monthly', scholarship: 'monthly' }
  const srcRows = Object.entries(r.sources || {})
    .filter(([, url]) => url)
    .map(([fact_type, url]) => ({
      university_id: uid, program_id: null, fact_type,
      platform: fact_type === 'essay' && r.essays?.[0]?.platform ? normPlatform(r.essays[0].platform) : null,
      source_url: url, is_active: true, fetch_frequency: FREQ[fact_type] || 'monthly',
      notes: 'manually sourced (Claude Code)', discovery_status: 'confirmed',
    }))
  if (srcRows.length) {
    const { error } = await s.from('verification_sources').insert(srcRows)
    if (error) throw new Error('sources: ' + error.message)
  }

  const d = (r.deadlines || []).length, e = (r.essays || []).length
  console.log(`  ✓ ${r.slug.padEnd(26)} dl=${d} essays=${e} sources=${srcRows.length}`)
}
