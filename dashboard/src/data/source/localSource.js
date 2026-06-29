import master from '../master.json'

/* ------------------------------------------------------------------ *
 *  THE SEAM (swap point).
 *  Today: returns the bundled master.json.
 *  Phase 1: replace the body of loadRawData() with a Supabase query
 *  that returns the same shape — nothing else in the app changes.
 * ------------------------------------------------------------------ */

export async function loadRawData(_studentId) {
  // bundled JSON is single-student; the id is accepted for API parity (ignored)
  return Promise.resolve(master)
}
