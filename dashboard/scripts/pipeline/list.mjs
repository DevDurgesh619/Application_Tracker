/* ════════════════════════════════════════════════════════════════════
 *  Coverage view (Pipeline A) — registered sources + latest snapshot.
 *  A CLI stand-in for the curator coverage board (Pipeline C builds the UI).
 *  Usage:  node scripts/pipeline/list.mjs  [--fact essay] [--university yale]
 * ════════════════════════════════════════════════════════════════════ */
import { loadEnv, db, parseArgs } from './lib.mjs'
loadEnv()

const a = parseArgs()
const sb = db()

const { data: unis } = await sb.from('universities').select('id, name, slug')
const uniById = Object.fromEntries((unis || []).map((u) => [u.id, u]))

let q = sb.from('verification_sources').select('*').order('created_at')
if (a.fact && a.fact !== true) q = q.eq('fact_type', a.fact)
const { data: sources, error } = await q
if (error) { console.error('✗', error.message); process.exit(1) }

let rows = sources || []
if (a.university && a.university !== true) {
  const needle = String(a.university).toLowerCase()
  rows = rows.filter((s) => {
    const u = uniById[s.university_id]
    return u && (u.slug.includes(needle) || u.name.toLowerCase().includes(needle))
  })
}

if (!rows.length) { console.log('No sources registered yet. Use register-source.mjs.'); process.exit(0) }

const ago = (iso) => {
  if (!iso) return 'never'
  const h = (Date.now() - new Date(iso).getTime()) / 3.6e6
  if (h < 1) return `${Math.round(h * 60)}m ago`
  if (h < 48) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

console.log(`\n${rows.length} source(s):\n`)
for (const s of rows) {
  const u = uniById[s.university_id]
  const { data: snaps } = await sb
    .from('fetch_snapshots')
    .select('fetched_at, http_status, content_hash, unchanged, error')
    .eq('source_id', s.id)
    .order('fetched_at', { ascending: false })
    .limit(1)
  const last = snaps?.[0]
  let state
  if (!last) state = '○ not-fetched'
  else if (last.error) state = `✗ error (${last.http_status ?? '—'})`
  else if (last.content_hash) state = last.unchanged ? '✓ current (no change)' : '● captured'
  else state = '? unknown'

  const scope = u ? u.name : 'university-agnostic'
  console.log(`  ${state.padEnd(24)} ${s.fact_type.padEnd(12)} ${scope}`)
  console.log(`  ${''.padEnd(24)} ${s.source_url}`)
  console.log(`  ${''.padEnd(24)} checked ${ago(s.last_checked_at)} · freq ${s.fetch_frequency} · id ${s.id.slice(0, 8)}\n`)
}
