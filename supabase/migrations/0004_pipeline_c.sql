-- ════════════════════════════════════════════════════════════════════
--  Pipeline C — Publish to the source of truth (typed catalog tables).
--  Approved drafts are written here with full provenance. The counsellor
--  app reads ONLY these published rows; drafts never reach it.
--  Ref: data_fetching_and_verification_plan.md §4.5, §11 · ARCHITECTURE §4/§4.A.
--  RLS: read = any authenticated (catalog is shared); write = curator only.
-- ════════════════════════════════════════════════════════════════════

-- one row per prompt (VERBATIM), carrying section + choose/of + verification metadata
create table if not exists essay_requirements (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid not null references universities(id) on delete cascade,
  program_id      uuid references programs(id) on delete set null,
  platform        text check (platform in ('common_app','uc','coalition','direct')),
  section         text,
  prompt_title    text,
  prompt_text     text not null,                 -- VERBATIM, never reworded
  word_limit      int,
  char_limit      int,
  choose_count    int,
  choose_of       int,
  conditions      text,
  sort_order      int,
  -- §4.A verification metadata
  cycle_year      text,
  source_url      text,
  verified_at     timestamptz,
  verified_by     uuid,
  status          text not null default 'published'
                    check (status in ('draft','published','stale','needs_review')),
  raw_snapshot_id uuid references fetch_snapshots(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists er_university_idx on essay_requirements (university_id, program_id, platform);

-- small typed table for the multi-row deadline fact
create table if not exists university_deadlines (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid not null references universities(id) on delete cascade,
  program_id      uuid references programs(id) on delete set null,
  round           text,                          -- verbatim round label
  deadline_text   text,                          -- verbatim "Round (Deadline: Nov 1)"
  date            date,                          -- parsed (nullable; year is cycle-dependent)
  kind            text not null default 'application'
                    check (kind in ('application','scholarship','decision')),
  sort_order      int,
  cycle_year      text,
  source_url      text,
  verified_at     timestamptz,
  verified_by     uuid,
  status          text not null default 'published'
                    check (status in ('draft','published','stale','needs_review')),
  raw_snapshot_id uuid references fetch_snapshots(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists ud_university_idx on university_deadlines (university_id, program_id, kind);

-- ── RLS — published catalog: read-all-authenticated, write-curator ────
alter table essay_requirements   enable row level security;
alter table university_deadlines enable row level security;

drop policy if exists er_read on essay_requirements;
drop policy if exists er_write on essay_requirements;
create policy er_read  on essay_requirements   for select using (auth.role() = 'authenticated');
create policy er_write on essay_requirements   for all using (is_curator()) with check (is_curator());

drop policy if exists ud_read on university_deadlines;
drop policy if exists ud_write on university_deadlines;
create policy ud_read  on university_deadlines  for select using (auth.role() = 'authenticated');
create policy ud_write on university_deadlines  for all using (is_curator()) with check (is_curator());
