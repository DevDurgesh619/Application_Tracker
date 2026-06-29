/* ════════════════════════════════════════════════════════════════════
 *  Fetch & snapshot a source (Pipeline A core).
 *  Given a source (URL + fact_type), firecrawl-scrape it and store an
 *  IMMUTABLE raw snapshot with content_hash + http_status.
 *
 *  Smart (§4.1): hash the new capture against the source's prior snapshot.
 *    • first fetch / changed → store full verbatim snapshot (unchanged=false)
 *    • unchanged            → store a lightweight check-row (null raw,
 *                             unchanged=true) — provenance without dup text
 *  Either way: bump last_checked_at + next_check_at (cadence). No extraction
 *  here — that's Pipeline B.
 *
 *  Usage (from dashboard/):
 *    node scripts/pipeline/fetch-source.mjs --source <uuid>
 *    node scripts/pipeline/fetch-source.mjs --url "<url>" --fact essay
 *    node scripts/pipeline/fetch-source.mjs --all-stale        (due sources)
 *    [--wait 3000]  firecrawl waitFor ms for JS-heavy pages
 * ════════════════════════════════════════════════════════════════════ */
import { loadEnv, db, scrape, contentHash, parseArgs, CADENCE_DAYS } from './lib.mjs'
loadEnv()

const a = parseArgs()
const sb = db()
const waitFor = a.wait && a.wait !== true ? Number(a.wait) : undefined

async function resolveSources() {
  if (a.source && a.source !== true) {
    const { data, error } = await sb.from('verification_sources').select('*').eq('id', a.source).single()
    if (error) { console.error('✗ source not found:', error.message); process.exit(1) }
    return [data]
  }
  if (a.url && a.url !== true) {
    let q = sb.from('verification_sources').select('*').eq('source_url', a.url)
    if (a.fact && a.fact !== true) q = q.eq('fact_type', a.fact)
    const { data, error } = await q
    if (error) { console.error('✗', error.message); process.exit(1) }
    if (!data.length) { console.error('✗ no registered source for that URL — register it first'); process.exit(1) }
    return data
  }
  if (a['all-stale']) {
    const nowIso = new Date().toISOString()
    const { data, error } = await sb
      .from('verification_sources')
      .select('*')
      .eq('is_active', true)
      .eq('discovery_status', 'confirmed') // never fetch a proposed/rejected url
      .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
    if (error) { console.error('✗', error.message); process.exit(1) }
    return data
  }
  console.error('✗ provide --source <id>, or --url <url> [--fact <type>], or --all-stale')
  process.exit(1)
}

function nextCheckIso(frequency) {
  const days = CADENCE_DAYS[frequency] ?? 30
  return new Date(Date.now() + days * 86400000).toISOString()
}

async function fetchOne(src) {
  const tag = `[${src.fact_type}] ${src.source_url}`
  // proposed/rejected urls are not yet trusted — a curator must confirm first
  // (avoids scraping a wrong auto-proposed url). --force overrides.
  if (src.discovery_status && src.discovery_status !== 'confirmed' && !a.force) {
    console.log(`  ⤬ skipping ${tag} — discovery_status "${src.discovery_status}" (confirm in the curator board, or pass --force)`)
    return { id: src.id, status: 'unconfirmed' }
  }
  console.log('→ fetching', tag)
  const r = await scrape(src.source_url, { waitFor })
  const nowIso = new Date().toISOString()

  // error path — record an error snapshot, still bump last_checked_at
  if (!r.ok || !r.markdown) {
    const { error: ie } = await sb.from('fetch_snapshots').insert({
      source_id: src.id, http_status: r.httpStatus, error: r.error || 'no markdown returned',
      content_hash: null, unchanged: false, raw_markdown: null, raw_html: null,
    })
    if (ie) console.error('  ✗ snapshot insert failed:', ie.message)
    await sb.from('verification_sources').update({ last_checked_at: nowIso, next_check_at: nextCheckIso(src.fetch_frequency) }).eq('id', src.id)
    console.log(`  ✗ fetch error (status ${r.httpStatus ?? '—'}): ${r.error}`)
    return { id: src.id, status: 'error' }
  }

  const hash = contentHash(r.markdown)

  // compare to the source's most recent snapshot that has a hash
  const { data: prior } = await sb
    .from('fetch_snapshots')
    .select('id, content_hash')
    .eq('source_id', src.id)
    .not('content_hash', 'is', null)
    .order('fetched_at', { ascending: false })
    .limit(1)
  const priorHash = prior?.[0]?.content_hash || null
  const unchanged = priorHash != null && priorHash === hash

  const snap = unchanged
    ? { source_id: src.id, http_status: r.httpStatus, content_hash: hash, unchanged: true, raw_markdown: null, raw_html: null }
    : { source_id: src.id, http_status: r.httpStatus, content_hash: hash, unchanged: false, raw_markdown: r.markdown, raw_html: r.html }

  const { data: ins, error: ie } = await sb.from('fetch_snapshots').insert(snap).select('id').single()
  if (ie) { console.error('  ✗ snapshot insert failed:', ie.message); return { id: src.id, status: 'db-error' } }

  await sb.from('verification_sources').update({
    last_checked_at: nowIso, next_check_at: nextCheckIso(src.fetch_frequency),
  }).eq('id', src.id)

  if (unchanged) {
    console.log(`  ✓ still current — no change (hash ${hash.slice(0, 12)}…). snapshot ${ins.id.slice(0, 8)}`)
    return { id: src.id, status: 'unchanged', snapshot: ins.id }
  }
  console.log(`  ✓ ${priorHash ? 'CHANGED — ' : 'first capture — '}stored ${r.markdown.length.toLocaleString()} chars`)
  console.log(`    status ${r.httpStatus} · hash ${hash.slice(0, 12)}… · snapshot ${ins.id.slice(0, 8)}${priorHash ? ' → ready for extraction (Pipeline B)' : ''}`)
  return { id: src.id, status: priorHash ? 'changed' : 'new', snapshot: ins.id }
}

const sources = await resolveSources()
console.log(`Fetching ${sources.length} source(s)…\n`)
const results = []
for (const src of sources) results.push(await fetchOne(src))

const by = results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {})
console.log('\nDone:', Object.entries(by).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing')
