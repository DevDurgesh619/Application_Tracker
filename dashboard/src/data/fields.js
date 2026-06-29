/* ------------------------------------------------------------------ *
 *  Editable application fields — single source of truth shared by the
 *  write path (DataContext.editApplication → applications column) and
 *  the UI / change-history labels.
 *
 *  key  : logical field id used in edits({ key: value }) and change_log.field
 *  db   : applications column to write
 *  raw  : key on the fused (recomposed) record in raw.universities
 *  label: human label for the change-history panel
 * ------------------------------------------------------------------ */
export const EDITABLE_FIELDS = {
  status: { db: 'status', raw: 'Status', label: 'Status' },
  tier: { db: 'tier', raw: 'Tier', label: 'Tier' },
  priority: { db: 'priority', raw: 'Priority', label: 'Priority' },
  keyDeadline: { db: 'key_deadline', raw: 'Key Deadline', label: 'Key Deadline' },
  decisionDate: { db: 'decision_date', raw: 'Decision Date', label: 'Decision Date' },
  scholDeadline: { db: 'scholarship_deadline', raw: 'Schol. Deadline', label: 'Scholarship Deadline' },
  notes: { db: 'notes', raw: 'Notes', label: 'Counsellor Notes' },
}
