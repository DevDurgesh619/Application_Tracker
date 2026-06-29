import { supabase } from '../lib/supabaseClient'

/* ------------------------------------------------------------------ *
 *  Essay workspace (Layer B, §3.6). Versioned drafts + comments +
 *  Draft→Final-locked workflow, all owner-scoped via RLS.
 * ------------------------------------------------------------------ */

export const WORK_STATUSES = ['draft', 'submitted_for_review', 'reviewed', 'revised', 'final_locked']
export const WORK_LABEL = {
  draft: 'Draft', submitted_for_review: 'Submitted for review', reviewed: 'Reviewed',
  revised: 'Revised', final_locked: 'Final — locked',
}

export const wordCount = (s) => (String(s || '').trim() ? String(s).trim().split(/\s+/).filter(Boolean).length : 0)
export const charCount = (s) => String(s || '').length
const firstInt = (s) => { const m = String(s ?? '').match(/\d+/); return m ? +m[0] : null }

/** Effective numeric limit for the live counter — prefer the verified Layer-A requirement. */
export function effectiveLimits(essay, requirement) {
  const word = requirement?.word_limit ?? essay?.word_limit_num ?? firstInt(essay?.word_limit)
  const char = requirement?.char_limit ?? null
  const fromRequirement = !!(requirement && (requirement.word_limit || requirement.char_limit))
  return { word: word ?? null, char, fromRequirement }
}

/** Essay row + its versions (newest first) + comments + linked requirement. */
export async function getEssayWorkspace(essayId) {
  const { data: essay, error } = await supabase.from('essays').select('*').eq('id', essayId).single()
  if (error) throw error
  const [{ data: versions }, { data: comments }] = await Promise.all([
    supabase.from('essay_versions').select('*').eq('essay_id', essayId).order('version_no', { ascending: false }),
    supabase.from('essay_comments').select('*').eq('essay_id', essayId).order('created_at', { ascending: true }),
  ])
  let requirement = null
  if (essay.essay_requirement_id) {
    const { data } = await supabase.from('essay_requirements').select('*').eq('id', essay.essay_requirement_id).maybeSingle()
    requirement = data
  }
  return { essay, versions: versions || [], comments: comments || [], requirement }
}

/** Snapshot the current draft as the next immutable version. */
export async function saveVersion(essayId, content, source = 'paste') {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: last } = await supabase
    .from('essay_versions').select('version_no').eq('essay_id', essayId)
    .order('version_no', { ascending: false }).limit(1).maybeSingle()
  const version_no = (last?.version_no || 0) + 1
  const { data: ins, error } = await supabase.from('essay_versions').insert({
    essay_id: essayId, version_no, content, word_count: wordCount(content), char_count: charCount(content),
    source, created_by: user.id,
  }).select().single()
  if (error) throw error
  await supabase.from('essays').update({ current_version_id: ins.id, updated_at: new Date().toISOString() }).eq('id', essayId)
  return ins
}

export async function setWorkStatus(essayId, work_status) {
  const { error } = await supabase.from('essays').update({ work_status, updated_at: new Date().toISOString() }).eq('id', essayId)
  if (error) throw error
}

export async function setGdocUrl(essayId, gdoc_url) {
  const { error } = await supabase.from('essays').update({ gdoc_url: gdoc_url || null }).eq('id', essayId)
  if (error) throw error
}

export async function addComment(essayId, body, versionId = null) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('essay_comments').insert({
    essay_id: essayId, version_id: versionId, author_id: user.id, body,
  })
  if (error) throw error
}

export async function resolveComment(id, resolved) {
  const { error } = await supabase.from('essay_comments').update({ resolved }).eq('id', id)
  if (error) throw error
}

export async function lockVersion(id, is_locked = true) {
  const { error } = await supabase.from('essay_versions').update({ is_locked }).eq('id', id)
  if (error) throw error
}
