-- ════════════════════════════════════════════════════════════════════
--  Pipeline E — Roll out the remaining (university-scoped) scalar facts:
--  SAT 25/75, test policy, admit rate, cost, scholarship/aid. These publish
--  into EXISTING universities columns (sat_p25/p75, test_policy, admit_rate,
--  cost_reference, aid_policy) — no new published tables. This migration only
--  adds (1) per-FIELD provenance so each verified scalar stays attributable
--  even though they share one catalog row, and (2) discovery columns so the
--  map-assisted source discovery can stage PROPOSED urls for curator confirm
--  before any expensive scrape.
--  Ref: docs/data_fetching_and_verification_plan.md §1A, §4 (Phase E).
-- ════════════════════════════════════════════════════════════════════

-- (1) Per-field provenance — a map keyed by catalog column, e.g.
--     {"sat_p25": {source_url, verified_at, verified_by, snapshot_id, cycle_year, quote}}
-- Row-level verified_at/verified_by stays as "last publish on this row".
alter table universities add column if not exists field_provenance jsonb;
alter table programs     add column if not exists field_provenance jsonb;  -- for the program-scoped follow-up

-- (2) Source discovery — proposed URLs from firecrawl map await curator confirm.
--     Only 'confirmed' sources are fetched (fetch-source.mjs --only-confirmed).
alter table verification_sources
  add column if not exists discovery_status text not null default 'confirmed'
    check (discovery_status in ('proposed','confirmed','rejected'));
alter table verification_sources
  add column if not exists candidate_urls jsonb;   -- ranked alternates for a proposed source

create index if not exists vs_discovery_idx on verification_sources (discovery_status);
