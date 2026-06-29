-- ════════════════════════════════════════════════════════════════════
--  0009_tracks.sql — Multi-track support (undergrad / law / mba)
--  The catalog + student model were undergrad/SAT-centric. Law uses LSAT
--  (+ UK LNAT/UCAS), MBA uses GMAT/GRE + work experience and applies in
--  rounds. This migration generalizes facts so the same dashboard serves
--  all three tracks. Deadlines already support multiple rounds
--  (university_deadlines.round), so no change is needed there.
--  DDL — run in the Supabase SQL editor (service role can't run DDL).
-- ════════════════════════════════════════════════════════════════════

-- ── catalog: tag each university with its track + generalize tests ──────
alter table universities
  add column if not exists track text not null default 'undergrad'
    check (track in ('undergrad','law','mba'));

-- Primary admission test for this school's track:
--   undergrad → SAT/ACT (or none), law → LSAT (US) / LNAT (UK), mba → GMAT/GRE
alter table universities
  add column if not exists primary_test text;          -- 'SAT' | 'LSAT' | 'GMAT' | 'GRE' | 'LNAT' | 'none'

-- Per-school admitted-class test medians, keyed by test code. Generalizes
-- the SAT-only sat_p25/sat_p75 columns (which stay for undergrad back-compat):
--   {"LSAT": {"p25":170,"median":172,"p75":174},
--    "GMAT": {"median":730,"p25":700,"p75":760}}
alter table universities
  add column if not exists admission_tests jsonb;

-- ── programs: track lives here too (forward-compat for multi-program unis) ─
alter table programs
  add column if not exists track text not null default 'undergrad'
    check (track in ('undergrad','law','mba'));

-- ── students: generalized scores + MBA work experience ──────────────────
-- Flexible per-student test scores keyed by test code (keeps sat_score for
-- back-compat / the existing SAT-gap logic): {"SAT":1540,"LSAT":172,"GMAT":730}
alter table students
  add column if not exists test_scores jsonb;

-- MBA applicants are evaluated on professional experience:
alter table students
  add column if not exists work_experience_months int;

-- The student's primary track (drives which schools + profile fields show):
alter table students
  add column if not exists track text not null default 'undergrad'
    check (track in ('undergrad','law','mba'));

-- Helpful indexes for track-filtered catalog/roster queries
create index if not exists idx_universities_track on universities(track);
create index if not exists idx_students_track on students(track);
