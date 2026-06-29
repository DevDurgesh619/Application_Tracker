/* ════════════════════════════════════════════════════════════════════
 *  Source discovery (Pipeline E) — propose the right official URL per fact
 *  type WITHOUT spending a scrape. Uses one cheap firecrawl `map` of the
 *  university domain, ranks the returned URLs per fact type by keyword, and
 *  stages a verification_sources row with discovery_status='proposed' +
 *  candidate_urls (ranked alternates). The curator then CONFIRMS/edits the URL
 *  in the board before any expensive fetch — so a wrong URL never burns a
 *  scrape + an LLM extraction (the cost concern).
 *
 *  Usage (from dashboard/):
 *    node scripts/pipeline/discover-sources.mjs --university yale
 *    node scripts/pipeline/discover-sources.mjs --university yale --domain admissions.yale.edu
 *    node scripts/pipeline/discover-sources.mjs --all          (every university w/ a known domain)
 *    [--facts sat,test_policy,admit_rate,cost,scholarship]      (subset; default = all 5 scalars)
 * ════════════════════════════════════════════════════════════════════ */
import { loadEnv, db, map, parseArgs } from './lib.mjs'
loadEnv()

// keyword → score per fact type (matched against the lowercased URL)
const FACT_KEYWORDS = {
  sat:          ['class-profile', 'admitted-class', 'profile', 'class-of', 'incoming-class', 'sat', 'test-scores', 'middle-50'],
  test_policy:  ['test-optional', 'test-policy', 'testing', 'standardized', 'test-requirements', 'sat-act', 'first-year-applicants'],
  admit_rate:   ['facts', 'admissions-statistics', 'statistics', 'profile', 'by-the-numbers', 'quick-facts', 'about'],
  cost:         ['cost-of-attendance', 'cost', 'tuition', 'billing', 'fees', 'student-accounts', 'bursar', 'estimated-cost'],
  scholarship:  ['financial-aid', 'scholarships', 'aid', 'affordability', 'net-price', 'funding'],
}
const ALL_SCALARS = Object.keys(FACT_KEYWORDS)

const a = parseArgs()
const facts = (a.facts && a.facts !== true ? String(a.facts).split(',') : ALL_SCALARS)
  .map((f) => f.trim()).filter((f) => FACT_KEYWORDS[f])
const sb = db()

/** Pull a base domain from a university's official_links jsonb (or --domain). */
function domainFor(u) {
  if (a.domain && a.domain !== true) return String(a.domain)
  const links = u.official_links || {}
  const urls = Object.values(links).filter((v) => typeof v === 'string' && /^https?:\/\//.test(v))
  if (!urls.length) return null
  try { return new URL(urls[0]).host } catch { return null }
}

function rank(links, factType) {
  const kws = FACT_KEYWORDS[factType]
  return links
    .map((url) => {
      const u = url.toLowerCase()
      let score = 0
      for (const kw of kws) if (u.includes(kw)) score += kw.length // longer, more-specific keywords weigh more
      // mild preference for admissions/undergrad sections, penalty for noise
      if (/admiss|undergrad|apply/.test(u)) score += 2
      if (/news|blog|event|covid|archive|\.pdf$/.test(u)) score -= 3
      return { url, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.url)
}

async function discoverUniversity(u) {
  const host = domainFor(u)
  if (!host) { console.log(`• ${u.name}: no known domain (set official_links or pass --domain) — skipped`); return 0 }
  console.log(`→ ${u.name} — mapping ${host}…`)
  const r = await map(`https://${host}`)
  if (!r.ok) { console.log(`  ✗ map failed: ${r.error}`); return 0 }
  console.log(`  • ${r.links.length} urls discovered`)

  // which fact types already have a source for this university? leave those alone.
  const { data: existing } = await sb.from('verification_sources').select('fact_type').eq('university_id', u.id).is('program_id', null)
  const have = new Set((existing || []).map((x) => x.fact_type))

  let proposed = 0
  for (const fact of facts) {
    if (have.has(fact)) { console.log(`  · ${fact}: already has a source — skipped`); continue }
    const candidates = rank(r.links, fact)
    if (!candidates.length) { console.log(`  · ${fact}: no candidate url matched — skipped`); continue }
    const row = {
      university_id: u.id, program_id: null, fact_type: fact, platform: null,
      source_url: candidates[0], candidate_urls: candidates, discovery_status: 'proposed',
      fetch_frequency: 'monthly', notes: 'auto-proposed (map)',
    }
    const { error } = await sb.from('verification_sources').insert(row)
    if (error) { console.log(`  ✗ ${fact}: ${error.message}`); continue }
    console.log(`  ✓ ${fact} → ${candidates[0]}  (+${candidates.length - 1} alt)`)
    proposed++
  }
  return proposed
}

async function targets() {
  if (a.university && a.university !== true) {
    const { data } = await sb.from('universities').select('id, name, slug, official_links')
    const q = String(a.university).toLowerCase()
    const u = (data || []).find((x) => x.slug === q) || (data || []).find((x) => x.slug.includes(q) || x.name.toLowerCase().includes(q))
    if (!u) { console.error(`✗ no university matching "${a.university}"`); process.exit(1) }
    return [u]
  }
  if (a.all) {
    const { data } = await sb.from('universities').select('id, name, slug, official_links').order('name')
    return data || []
  }
  console.error('✗ provide --university <slug|name> or --all')
  process.exit(1)
}

const unis = await targets()
console.log(`Discovering sources for ${unis.length} university(ies), facts: ${facts.join(', ')}\n`)
let total = 0
for (const u of unis) total += await discoverUniversity(u)
console.log(`\nDone: ${total} source(s) proposed. Confirm them in the Curator board → Proposed sources.`)
