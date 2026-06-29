/* ════════════════════════════════════════════════════════════════════
 *  Extract & stage a snapshot (Pipeline B core).
 *  Loads a source's latest FULL snapshot, segments it (rules-v1), runs the
 *  verbatim integrity gate, and stores a verification_drafts row.
 *  • gate passes → status 'draft' (ready for curator review, Pipeline C)
 *  • gate flags  → status 'needs_review' + integrity_issues recorded
 *  No publishing here — drafts never reach the live catalog (§4.5).
 *
 *  Usage (from dashboard/):
 *    node scripts/pipeline/extract-snapshot.mjs --source <uuid>
 *    node scripts/pipeline/extract-snapshot.mjs --snapshot <uuid>
 *    node scripts/pipeline/extract-snapshot.mjs --all      (every source, latest full snapshot)
 * ════════════════════════════════════════════════════════════════════ */
import { loadEnv, db, parseArgs } from './lib.mjs'
import { extract, verbatimCheck, extractionModelFor } from './extractors.mjs'
loadEnv()

const a = parseArgs()
const sb = db()

async function latestFullSnapshotForSource(sourceId) {
  const { data } = await sb
    .from('fetch_snapshots')
    .select('id, source_id, raw_markdown')
    .eq('source_id', sourceId)
    .not('raw_markdown', 'is', null)
    .order('fetched_at', { ascending: false })
    .limit(1)
  return data?.[0] || null
}

async function targets() {
  if (a.snapshot && a.snapshot !== true) {
    const { data, error } = await sb.from('fetch_snapshots').select('id, source_id, raw_markdown').eq('id', a.snapshot).single()
    if (error) { console.error('✗ snapshot not found:', error.message); process.exit(1) }
    return [data]
  }
  if (a.source && a.source !== true) {
    const s = await latestFullSnapshotForSource(a.source)
    if (!s) { console.error('✗ no full snapshot for that source — run fetch-source first'); process.exit(1) }
    return [s]
  }
  if (a.all) {
    const { data: srcs } = await sb.from('verification_sources').select('id').eq('is_active', true)
    const snaps = []
    for (const s of srcs || []) { const snap = await latestFullSnapshotForSource(s.id); if (snap) snaps.push(snap) }
    return snaps
  }
  console.error('✗ provide --source <id>, --snapshot <id>, or --all')
  process.exit(1)
}

async function extractOne(snap) {
  const { data: src } = await sb.from('verification_sources').select('id, fact_type, source_url').eq('id', snap.source_id).single()
  console.log(`→ [${src.fact_type}] ${src.source_url}`)
  if (!snap.raw_markdown) { console.log('  ✗ snapshot has no markdown (unchanged check-row) — skipping'); return { status: 'skipped' } }

  let extracted
  try { extracted = await extract(src.fact_type, snap.raw_markdown) }
  catch (e) { console.log('  ✗', e.message); return { status: 'no-extractor' } }

  const gate = verbatimCheck(src.fact_type, extracted, snap.raw_markdown)
  const secs = extracted.sections || []
  const count = src.fact_type === 'essay'
    ? `${secs.length} sections, ${secs.reduce((n, s) => n + (s.prompts?.length || 0), 0)} prompts`
    : src.fact_type === 'deadline'
      ? `${(extracted.rounds || []).length} rounds`
      : `1 ${src.fact_type} fact`

  const status = gate.ok ? 'draft' : 'needs_review'
  const row = {
    source_id: src.id,
    snapshot_id: snap.id,
    fact_type: src.fact_type,
    extracted_json: extracted,
    extraction_model: extractionModelFor(src.fact_type),
    status,
    integrity_ok: gate.ok,
    integrity_issues: gate.issues.length ? gate.issues : null,
  }
  // one draft per snapshot (re-extract replaces)
  const { data: existing } = await sb.from('verification_drafts').select('id').eq('snapshot_id', snap.id).maybeSingle()
  let res
  if (existing) res = await sb.from('verification_drafts').update(row).eq('id', existing.id).select('id').single()
  else res = await sb.from('verification_drafts').insert(row).select('id').single()
  if (res.error) { console.log('  ✗ draft save failed:', res.error.message); return { status: 'db-error' } }

  console.log(`  ✓ extracted ${count}`)
  if (gate.ok) console.log(`  ✓ verbatim gate PASSED (${gate.checked} text fields are exact substrings) → draft ${res.data.id.slice(0, 8)}`)
  else {
    console.log(`  ⚠ verbatim gate FLAGGED ${gate.issues.length}/${gate.checked} field(s) → needs_review:`)
    for (const it of gate.issues) console.log(`      • ${it.path}: "${it.value}"`)
  }
  return { status }
}

const snaps = await targets()
console.log(`Extracting ${snaps.length} snapshot(s)…\n`)
const results = []
for (const s of snaps) results.push(await extractOne(s))
const by = results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {})
console.log('\nDone:', Object.entries(by).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing')
