import { supabase } from '../lib/supabaseClient'

/* ------------------------------------------------------------------ *
 *  Curator data layer (Pipeline C). Reads staging (sources/snapshots/
 *  drafts) and publishes approved drafts into the typed catalog tables.
 *  All under curator-only RLS. Ref: pipeline doc §4.5, §6, §11.
 * ------------------------------------------------------------------ */

/** Coverage board: every source + its latest snapshot + latest draft. */
export async function listSources() {
  const { data: unis } = await supabase.from('universities').select('id, name, slug')
  const uniById = Object.fromEntries((unis || []).map((u) => [u.id, u]))
  const { data: sources } = await supabase.from('verification_sources').select('*').order('created_at')
  const out = []
  for (const s of sources || []) {
    const { data: snaps } = await supabase
      .from('fetch_snapshots').select('id, fetched_at, http_status, content_hash, unchanged, error')
      .eq('source_id', s.id).order('fetched_at', { ascending: false }).limit(1)
    const { data: draft } = await supabase
      .from('verification_drafts').select('id, status, integrity_ok, extracted_at')
      .eq('source_id', s.id).order('extracted_at', { ascending: false }).limit(1).maybeSingle()
    out.push({ ...s, university: uniById[s.university_id] || null, latest: snaps?.[0] || null, draft: draft || null })
  }
  return out
}

/** Items awaiting human attention (the review_queue view). */
export async function listQueue() {
  const { data, error } = await supabase.from('review_queue').select('*')
  if (error) throw error
  const ids = [...new Set((data || []).map((r) => r.university_id).filter(Boolean))]
  const { data: unis } = ids.length ? await supabase.from('universities').select('id, name').in('id', ids) : { data: [] }
  const nameById = Object.fromEntries((unis || []).map((u) => [u.id, u.name]))
  return (data || []).map((r) => ({ ...r, university_name: nameById[r.university_id] || '—' }))
}

/** Full draft + its snapshot + source + university, for the review screen. */
export async function getDraft(id) {
  const { data: draft, error } = await supabase.from('verification_drafts').select('*').eq('id', id).single()
  if (error) throw error
  const { data: snapshot } = await supabase
    .from('fetch_snapshots').select('id, raw_markdown, fetched_at, http_status').eq('id', draft.snapshot_id).single()
  const { data: source } = await supabase.from('verification_sources').select('*').eq('id', draft.source_id).single()
  const { data: university } = source.university_id
    ? await supabase.from('universities').select('id, name, slug').eq('id', source.university_id).maybeSingle()
    : { data: null }
  return { draft, snapshot, source, university }
}

/** Persist curator edits to the draft's extracted_json + integrity result. */
export async function saveDraftJson(id, extractedJson, integrity) {
  const { error } = await supabase.from('verification_drafts').update({
    extracted_json: extractedJson,
    integrity_ok: integrity.ok,
    integrity_issues: integrity.issues.length ? integrity.issues : null,
    status: integrity.ok ? 'in_review' : 'needs_review',
  }).eq('id', id)
  if (error) throw error
}

export async function rejectDraft(id, notes) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('verification_drafts').update({
    status: 'rejected', reviewer_id: user.id, reviewed_at: new Date().toISOString(), review_notes: notes || null,
  }).eq('id', id)
  if (error) throw error
}

/**
 * Publish an approved draft to the typed catalog (§4.5). Replaces the prior
 * published rows for this scope, writes fresh rows with full provenance,
 * and marks the draft approved. Counsellor app reads only these.
 */
export async function publishDraft({ draft, source }) {
  const { data: { user } } = await supabase.auth.getUser()
  const now = new Date().toISOString()
  const ex = draft.extracted_json || {}
  const base = {
    university_id: source.university_id,
    program_id: source.program_id,
    source_url: source.source_url,
    verified_at: now,
    verified_by: user.id,
    status: 'published',
    raw_snapshot_id: draft.snapshot_id,
  }
  let published = 0

  if (draft.fact_type === 'essay') {
    let del = supabase.from('essay_requirements').delete()
      .eq('university_id', source.university_id).eq('status', 'published')
    del = source.program_id ? del.eq('program_id', source.program_id) : del.is('program_id', null)
    del = source.platform ? del.eq('platform', source.platform) : del.is('platform', null)
    await del
    const rows = []
    let order = 0
    for (const sec of ex.sections || []) {
      for (const p of sec.prompts || []) {
        rows.push({
          ...base, platform: source.platform, section: sec.section_name, prompt_title: null,
          prompt_text: p.prompt_text, word_limit: p.word_limit ?? null, char_limit: p.char_limit ?? null,
          choose_count: sec.choose_count ?? null, choose_of: sec.choose_of ?? null,
          conditions: sec.conditions ?? null, sort_order: order++, cycle_year: ex.cycle_year ?? null,
        })
      }
    }
    if (rows.length) { const { error } = await supabase.from('essay_requirements').insert(rows); if (error) throw error }
    published = rows.length
  } else if (draft.fact_type === 'deadline') {
    let del = supabase.from('university_deadlines').delete()
      .eq('university_id', source.university_id).eq('kind', 'application').eq('status', 'published')
    del = source.program_id ? del.eq('program_id', source.program_id) : del.is('program_id', null)
    await del
    const rows = (ex.rounds || []).map((r, i) => ({
      ...base, round: r.label, deadline_text: r.deadline_text, date: null,
      kind: 'application', sort_order: i, cycle_year: ex.cycle_year ?? null,
    }))
    if (rows.length) { const { error } = await supabase.from('university_deadlines').insert(rows); if (error) throw error }
    published = rows.length
  } else if (SCALAR_PUBLISH[draft.fact_type]) {
    // university-scoped scalar facts (Pipeline E) → typed columns on the
    // catalog university row + per-field provenance (keeps each fact attributable).
    const { cols, quote, provKeys } = SCALAR_PUBLISH[draft.fact_type](ex)
    const { data: uni, error: ge } = await supabase
      .from('universities').select('field_provenance, cost_reference').eq('id', source.university_id).single()
    if (ge) throw ge
    // cost: MERGE the verified figure under cost_reference.verified — never
    // clobber an existing ₹-lakh estimate (or other keys) on the shared row.
    if (draft.fact_type === 'cost') {
      cols.cost_reference = { ...(uni.cost_reference || {}), verified: { ...cols.cost_reference, source_url: source.source_url, cycle_year: ex.cycle_year ?? null } }
    }
    const provEntry = {
      source_url: source.source_url, verified_at: now, verified_by: user.id,
      snapshot_id: draft.snapshot_id, cycle_year: ex.cycle_year ?? null, quote: quote ?? null,
    }
    const field_provenance = { ...(uni.field_provenance || {}) }
    for (const k of provKeys) field_provenance[k] = provEntry
    const { error } = await supabase.from('universities').update({
      ...cols, field_provenance,
      verified_at: now, verified_by: user.id, source_cycle: ex.cycle_year ?? null,
    }).eq('id', source.university_id)
    if (error) throw error
    published = 1
  } else {
    throw new Error(`No publish target for fact_type "${draft.fact_type}" yet (Pipeline E).`)
  }

  const { error: de } = await supabase.from('verification_drafts').update({
    status: 'approved', reviewer_id: user.id, reviewed_at: now,
  }).eq('id', draft.id)
  if (de) throw de

  return { published }
}

/* Each scalar fact → which catalog columns it writes, the verbatim evidence
 * string, and which provenance keys to stamp. ex = draft.extracted_json. */
const SCALAR_PUBLISH = {
  sat: (ex) => ({
    cols: { sat_p25: ex.sat_p25 ?? null, sat_p75: ex.sat_p75 ?? null },
    quote: ex.quote, provKeys: ['sat_p25', 'sat_p75'],
  }),
  test_policy: (ex) => ({
    cols: { test_policy: ex.statement ?? ex.policy ?? null },
    quote: ex.statement, provKeys: ['test_policy'],
  }),
  admit_rate: (ex) => ({
    cols: { admit_rate: ex.admit_rate ?? null },
    quote: ex.quote, provKeys: ['admit_rate'],
  }),
  cost: (ex) => ({
    cols: { cost_reference: { currency: ex.currency ?? null, tuition: ex.tuition ?? null, total: ex.total ?? null } },
    quote: ex.quote, provKeys: ['cost_reference'],
  }),
  scholarship: (ex) => ({
    cols: { aid_policy: ex.aid_policy ?? null },
    quote: ex.aid_policy, provKeys: ['aid_policy'],
  }),
}

/* ---- Source discovery (Pipeline E): proposed urls awaiting curator confirm ---- */

/** Proposed sources (from discover-sources.mjs map) grouped for the board. */
export async function listProposedSources() {
  const { data, error } = await supabase
    .from('verification_sources').select('*').eq('discovery_status', 'proposed').order('created_at')
  if (error) throw error
  const ids = [...new Set((data || []).map((r) => r.university_id).filter(Boolean))]
  const { data: unis } = ids.length ? await supabase.from('universities').select('id, name').in('id', ids) : { data: [] }
  const nameById = Object.fromEntries((unis || []).map((u) => [u.id, u.name]))
  return (data || []).map((r) => ({ ...r, university_name: nameById[r.university_id] || '—' }))
}

/** Confirm a proposed source (optionally overriding the url) → eligible to fetch. */
export async function confirmSource(id, url) {
  const patch = { discovery_status: 'confirmed' }
  if (url) patch.source_url = url
  const { error } = await supabase.from('verification_sources').update(patch).eq('id', id)
  if (error) throw error
}

export async function rejectSource(id) {
  const { error } = await supabase.from('verification_sources').update({ discovery_status: 'rejected' }).eq('id', id)
  if (error) throw error
}
