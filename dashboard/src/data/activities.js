import { supabase } from '../lib/supabaseClient'

/* ------------------------------------------------------------------ *
 *  Activities & Honors editor (Phase 3 §3.7). Editable, with Common
 *  App "final cut" + rank ordering. Owner-scoped via RLS.
 * ------------------------------------------------------------------ */

export const ACTIVITY_LIMIT = 10
export const HONOR_LIMIT = 5
export const DESC_LIMIT = 150 // Common App activity description

const orderRows = (rows) =>
  (rows || []).slice().sort((a, b) => {
    if (a.in_final_list !== b.in_final_list) return a.in_final_list ? -1 : 1
    return (a.rank_order ?? 1e9) - (b.rank_order ?? 1e9) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })

export async function listActivities(studentId) {
  const { data, error } = await supabase.from('activities').select('*').eq('student_id', studentId)
  if (error) throw error
  return orderRows(data)
}
export async function listHonors(studentId) {
  const { data, error } = await supabase.from('honors').select('*').eq('student_id', studentId)
  if (error) throw error
  return orderRows(data)
}

export async function createActivity(studentId) {
  const { data, error } = await supabase.from('activities').insert({ student_id: studentId, name: 'New activity' }).select().single()
  if (error) throw error
  return data
}
export async function createHonor(studentId) {
  const { data, error } = await supabase.from('honors').insert({ student_id: studentId, name: 'New honor' }).select().single()
  if (error) throw error
  return data
}

export async function updateActivity(id, patch) {
  const { error } = await supabase.from('activities').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function updateHonor(id, patch) {
  const { error } = await supabase.from('honors').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteActivity(id) {
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) throw error
}
export async function deleteHonor(id) {
  const { error } = await supabase.from('honors').delete().eq('id', id)
  if (error) throw error
}

/** Toggle an item into / out of the Common App final cut. */
export async function setFinalCut(table, id, on, currentFinalCount) {
  const patch = on ? { in_final_list: true, rank_order: currentFinalCount } : { in_final_list: false, rank_order: null }
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) throw error
}

/** Persist a new rank order for the final-cut list (array of ids in order). */
export async function reorder(table, orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from(table).update({ rank_order: i }).eq('id', orderedIds[i])
    if (error) throw error
  }
}
