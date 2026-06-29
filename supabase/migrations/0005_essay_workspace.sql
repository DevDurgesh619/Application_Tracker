-- ════════════════════════════════════════════════════════════════════
--  Phase 3 — Layer B: Essay workspace (§3.6 / ARCHITECTURE §4.6).
--  Turns the flat essay tracker into a real drafting workspace:
--  versioned drafts, counsellor comments, a Draft→Final-locked workflow,
--  and a link to the verified Layer-A requirement (for live count vs limit).
--  RLS: owner-only via the parent student (mirrors essays_owner).
-- ════════════════════════════════════════════════════════════════════

-- ── extend the existing per-student essays row into the workspace entity ──
alter table essays add column if not exists university_id        uuid references universities(id) on delete set null;
alter table essays add column if not exists essay_requirement_id uuid references essay_requirements(id) on delete set null;
alter table essays add column if not exists gdoc_url             text;
alter table essays add column if not exists current_version_id   uuid;   -- → essay_versions.id (loose ref; avoids circular FK)
alter table essays add column if not exists word_limit_num       int;    -- numeric limit for the live counter (legacy word_limit is free-text)
alter table essays add column if not exists work_status          text not null default 'draft'
  check (work_status in ('draft','submitted_for_review','reviewed','revised','final_locked'));

-- ── immutable version snapshots ──────────────────────────────────────
create table if not exists essay_versions (
  id          uuid primary key default gen_random_uuid(),
  essay_id    uuid not null references essays(id) on delete cascade,
  version_no  int not null,
  content     text,
  word_count  int,
  char_count  int,
  source      text not null default 'paste' check (source in ('paste','upload','gdoc_snapshot')),
  file_path   text,                         -- Supabase Storage key (upload — a later addition)
  is_locked   boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists ev_essay_idx on essay_versions (essay_id, version_no desc);

-- ── counsellor / student comments (optionally per version) ───────────
create table if not exists essay_comments (
  id          uuid primary key default gen_random_uuid(),
  essay_id    uuid not null references essays(id) on delete cascade,
  version_id  uuid references essay_versions(id) on delete set null,
  author_id   uuid,
  body        text not null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists ec_essay_idx on essay_comments (essay_id, created_at);

-- ── RLS — owner-only via parent student ──────────────────────────────
alter table essay_versions enable row level security;
alter table essay_comments enable row level security;

drop policy if exists ev_owner on essay_versions;
create policy ev_owner on essay_versions using (
  exists (select 1 from essays e join students s on s.id = e.student_id
          where e.id = essay_versions.essay_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from essays e join students s on s.id = e.student_id
          where e.id = essay_versions.essay_id and s.counsellor_id = auth.uid())
);

drop policy if exists ec_owner on essay_comments;
create policy ec_owner on essay_comments using (
  exists (select 1 from essays e join students s on s.id = e.student_id
          where e.id = essay_comments.essay_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from essays e join students s on s.id = e.student_id
          where e.id = essay_comments.essay_id and s.counsellor_id = auth.uid())
);
