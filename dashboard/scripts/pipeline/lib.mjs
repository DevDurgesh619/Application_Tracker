/* ════════════════════════════════════════════════════════════════════
 *  Pipeline shared lib — env, Supabase (service role), firecrawl, hashing.
 *  Server-side only. Uses the service role (bypasses RLS) for fetch jobs.
 *  Ref: docs/data_fetching_and_verification_plan.md §4.
 * ════════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))   // dashboard/scripts/pipeline
export const REPO = resolve(__dir, '../../..')          // repo root

/** Load secrets from the repo-root .env (+ dashboard/.env.local) without overriding real env. */
export function loadEnv() {
  for (const p of [resolve(REPO, '.env'), resolve(REPO, 'dashboard/.env.local')]) {
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
      }
    } catch {}
  }
}

/** Supabase client with the service role (bypasses RLS — server-side jobs only). */
export function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Scrape a URL via the firecrawl v2 HTTP API → clean markdown (+ html).
 * Returns { ok, httpStatus, markdown, html, error, metadata }.
 * Never throws on a fetch/HTTP error — returns ok:false so the caller can
 * still record a snapshot with the error + status.
 */
export async function scrape(url, { waitFor, onlyMainContent = true } = {}) {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) throw new Error('Missing FIRECRAWL_API_KEY in .env')
  const body = { url, formats: ['markdown', 'html'], onlyMainContent }
  if (waitFor) body.waitFor = waitFor
  let res, json
  try {
    res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    json = await res.json().catch(() => null)
  } catch (e) {
    return { ok: false, httpStatus: null, markdown: null, html: null, error: e.message }
  }
  const d = json?.data || {}
  if (!res.ok || !json?.success) {
    return {
      ok: false,
      httpStatus: d.metadata?.statusCode ?? res.status,
      markdown: null, html: null,
      error: json?.error || `firecrawl HTTP ${res.status}`,
    }
  }
  return {
    ok: true,
    httpStatus: d.metadata?.statusCode ?? 200,
    markdown: d.markdown ?? null,
    html: d.html ?? null,
    error: null,
    metadata: d.metadata || null,
  }
}

/**
 * Map a site via the firecrawl v2 HTTP API → a flat list of discovered URLs.
 * Used by source discovery to propose the right page per fact type CHEAPLY,
 * before any full scrape (the cost concern: a wrong URL wastes a scrape +
 * an LLM extraction). Returns { ok, links:[url,…], error }. Never throws.
 */
export async function map(url, { search } = {}) {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) throw new Error('Missing FIRECRAWL_API_KEY in .env')
  const body = { url }
  if (search) body.search = search
  let res, json
  try {
    res = await fetch('https://api.firecrawl.dev/v2/map', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    json = await res.json().catch(() => null)
  } catch (e) {
    return { ok: false, links: [], error: e.message }
  }
  if (!res.ok || !json?.success) {
    return { ok: false, links: [], error: json?.error || `firecrawl HTTP ${res.status}` }
  }
  // v2 returns links as [{url,title,description}] or [url]; normalize to strings.
  const links = (json.links || json.data?.links || [])
    .map((l) => (typeof l === 'string' ? l : l?.url))
    .filter(Boolean)
  return { ok: true, links, error: null }
}

/**
 * Cheap change-detection hash. Normalizes ONLY whitespace (so trivial
 * formatting wiggle isn't a false diff) — the stored raw_markdown stays
 * exactly verbatim. Never lowercase/strip punctuation (that would mask
 * real content changes, and verbatim is sacred — §3).
 */
export function contentHash(markdown) {
  const norm = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return createHash('sha256').update(norm).digest('hex')
}

/** Minimal `--key value` (and `--flag`) parser. */
export function parseArgs(argv = process.argv.slice(2)) {
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2)
      const next = argv[i + 1]
      a[k] = next && !next.startsWith('--') ? argv[++i] : true
    }
  }
  return a
}

/** Days a frequency implies, for next_check_at. */
export const CADENCE_DAYS = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 }
