-- ════════════════════════════════════════════════════════════════════
--  Pipeline A — Fetch & snapshot (the verification engine's foundation)
--  Fact-type-agnostic. DoD: given a URL + fact_type, store an immutable
--  raw snapshot with a content hash + http status.
--  Ref: docs/data_fetching_and_verification_plan.md §3, §9 (Phase A).
--  RLS: curator/admin only (is_curator() defined in 0001_init.sql).
-- ════════════════════════════════════════════════════════════════════

-- Registry of official pages we watch — per (university/program × fact_type × URL).
create table if not exists verification_sources (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid references universities(id) on delete cascade,
  program_id      uuid references programs(id) on delete set null,  -- set => program-scoped
  fact_type       text not null check (fact_type in
                    ('essay','deadline','entry_req','stem','test_policy','sat','cost','scholarship','admit_rate')),
  platform        text check (platform in ('common_app','uc','coalition','direct')),  -- mainly for essays
  source_url      text not null,
  is_active       boolean not null default true,
  fetch_frequency text not null default 'monthly'
                    check (fetch_frequency in ('weekly','biweekly','monthly','quarterly')),
  last_checked_at timestamptz,
  next_check_at   timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid
);

-- Dedupe a logical source even with nullable program_id / platform (NULLs are
-- distinct in a plain UNIQUE, so coalesce them to sentinels).
create unique index if not exists vs_dedupe_idx on verification_sources (
  coalesce(university_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(program_id,    '00000000-0000-0000-0000-000000000000'::uuid),
  fact_type,
  source_url,
  coalesce(platform, '')
);
create index if not exists vs_due_idx on verification_sources (is_active, next_check_at);
create index if not exists vs_university_idx on verification_sources (university_id);

-- Immutable raw captures — the evidence trail (never overwritten).
create table if not exists fetch_snapshots (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references verification_sources(id) on delete cascade,
  fetched_at    timestamptz not null default now(),
  fetch_tool    text not null default 'firecrawl',
  raw_markdown  text,
  raw_html      text,
  http_status   int,
  content_hash  text,                          -- sha256 of normalized markdown (cheap change detection)
  unchanged     boolean not null default false, -- true when hash matched the source's prior snapshot
  error         text,
  created_by    uuid
);

create index if not exists fs_source_idx on fetch_snapshots (source_id, fetched_at desc);
create index if not exists fs_hash_idx   on fetch_snapshots (source_id, content_hash);

-- ── RLS — pipeline tables are curator/admin only ──────────────────────
alter table verification_sources enable row level security;
alter table fetch_snapshots      enable row level security;

drop policy if exists vs_curator on verification_sources;
create policy vs_curator on verification_sources
  using (is_curator()) with check (is_curator());

drop policy if exists fs_curator on fetch_snapshots;
create policy fs_curator on fetch_snapshots
  using (is_curator()) with check (is_curator());
