import { supabase } from '../lib/supabaseClient'

/* ------------------------------------------------------------------ *
 *  Write path — Phase 1.
 *  Updates a single application row and records each field change in
 *  change_log. Runs as the logged-in counsellor, so RLS guarantees they
 *  can only touch their own student's applications.
 * ------------------------------------------------------------------ */

/**
 * Persist field changes to an application + append an audit trail.
 *
 * @param {object}  args
 * @param {string}  args.appId    applications.id to update
 * @param {object}  args.dbPatch  column->value patch for the row
 * @param {Array<{field:string, old:*, new:*}>} args.changes  change_log entries
 */
export async function saveApplication({ appId, dbPatch, changes }) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) throw new Error('Not signed in.')

  const { error: upErr } = await supabase
    .from('applications')
    .update({ ...dbPatch, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', appId)
  if (upErr) throw upErr

  if (changes && changes.length) {
    const rows = changes.map((c) => ({
      actor_id: user.id,
      entity_type: 'application',
      entity_id: appId,
      field: c.field,
      old_value: c.old == null ? null : String(c.old),
      new_value: c.new == null ? null : String(c.new),
      action: 'update',
    }))
    const { error: clErr } = await supabase.from('change_log').insert(rows)
    if (clErr) throw clErr
  }
}

/**
 * Persist field changes to a student + append an audit trail.
 *
 * @param {object}  args
 * @param {string}  args.studentId  students.id to update
 * @param {object}  args.dbPatch    column->value patch for the row
 * @param {Array<{field:string, old:*, new:*}>} args.changes  change_log entries
 */
export async function saveStudent({ studentId, dbPatch, changes }) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) throw new Error('Not signed in.')

  const { error: upErr } = await supabase
    .from('students')
    .update({ ...dbPatch, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', studentId)
  if (upErr) throw upErr

  if (changes && changes.length) {
    const rows = changes.map((c) => ({
      actor_id: user.id,
      entity_type: 'student',
      entity_id: studentId,
      field: c.field,
      old_value: c.old == null ? null : String(c.old),
      new_value: c.new == null ? null : String(c.new),
      action: 'update',
    }))
    const { error: clErr } = await supabase.from('change_log').insert(rows)
    if (clErr) throw clErr
  }
}

/**
 * Read the audit trail for one application, newest first.
 * RLS scopes this to the current counsellor's own actions.
 */
export async function fetchChangeLog(appId, limit = 25) {
  const { data, error } = await supabase
    .from('change_log')
    .select('id, field, old_value, new_value, action, at')
    .eq('entity_type', 'application')
    .eq('entity_id', appId)
    .order('at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
