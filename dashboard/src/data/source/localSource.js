import master from '../master.json'

/* ------------------------------------------------------------------ *
 *  THE SEAM (swap point).
 *  Today: returns the bundled master.json.
 *  Phase 1: replace the body of loadRawData() with a Supabase query
 *  that returns the same shape — nothing else in the app changes.
 * ------------------------------------------------------------------ */

export async function loadRawData() {
  // simulate async so the whole app is already wired for a real backend
  return Promise.resolve(master)
}
