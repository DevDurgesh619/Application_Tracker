import { supabase } from '../lib/supabaseClient'

/* ------------------------------------------------------------------ *
 *  Requirements checklist (§3.9). Per-application items; completion %
 *  is DERIVED, never stored. Owner-scoped via RLS.
 * ------------------------------------------------------------------ */

export const REQ_TYPES = ['essay', 'recommendation', 'test_score', 'supplement', 'fee', 'interview', 'document', 'custom']
export const TYPE_LABEL = {
  essay: 'Essay', recommendation: 'Recommendation', test_score: 'Test score', supplement: 'Supplement',
  fee: 'Fee', interview: 'Interview', document: 'Document', custom: 'Custom',
}
export const STATUS_CYCLE = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
export const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done', na: 'N/A' }

// the standard checklist a counsellor seeds for a new application
const STANDARD = [
  { type: 'essay', label: 'Essays / supplements drafted' },
  { type: 'recommendation', label: 'Recommendation letters requested' },
  { type: 'test_score', label: 'Test scores sent' },
  { type: 'document', label: 'Transcript / school report sent' },
  { type: 'fee', label: 'Application fee paid' },
  { type: 'interview', label: 'Interview (if applicable)' },
]

/** Derived completion %: done = 1, in_progress = 0.5, todo = 0; N/A excluded. */
export function completion(items) {
  const applicable = items.filter((i) => i.status !== 'na')
  const score = applicable.reduce((s, i) => s + (i.status === 'done' ? 1 : i.status === 'in_progress' ? 0.5 : 0), 0)
  const pct = applicable.length ? Math.round((score / applicable.length) * 100) : 0
  return { pct, done: applicable.filter((i) => i.status === 'done').length, applicable: applicable.length, total: items.length }
}

export async function listRequirements(applicationId) {
  const { data, error } = await supabase
    .from('application_requirements').select('*').eq('application_id', applicationId).order('sort_order')
  if (error) throw error
  return data || []
}

export async function seedStandard(applicationId) {
  const rows = STANDARD.map((r, i) => ({ application_id: applicationId, type: r.type, label: r.label, sort_order: i }))
  const { error } = await supabase.from('application_requirements').insert(rows)
  if (error) throw error
}

export async function createRequirement(applicationId, label, type = 'custom', sortOrder = 99) {
  const { data, error } = await supabase
    .from('application_requirements').insert({ application_id: applicationId, label, type, sort_order: sortOrder }).select().single()
  if (error) throw error
  return data
}

export async function updateRequirement(id, patch) {
  const { error } = await supabase.from('application_requirements').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteRequirement(id) {
  const { error } = await supabase.from('application_requirements').delete().eq('id', id)
  if (error) throw error
}
