-- ════════════════════════════════════════════════════════════════════
--  Pipeline B — Extract & stage.
--  A snapshot is segmented into a structured, VERBATIM draft that awaits
--  human review. The staging core is generic (one table, all fact types);
--  the published output (Pipeline C) is strongly typed.
--  Ref: docs/data_fetching_and_verification_plan.md §3, §4.3, §5, §9 (Phase B).
--  RLS: curator/admin only (is_curator() from 0001_init.sql).
-- ════════════════════════════════════════════════════════════════════

create table if not exists verification_drafts (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references verification_sources(id) on delete cascade,
  snapshot_id         uuid not null references fetch_snapshots(id) on delete cascade,
  fact_type           text not null,
  extracted_json      jsonb,                  -- structured, VERBATIM segments (§5)
  extraction_model    text,                   -- 'rules-v1' now; an LLM id later
  extracted_at        timestamptz not null default now(),
  status              text not null default 'draft'
                        check (status in ('draft','in_review','approved','rejected','needs_review')),
  integrity_ok        boolean,                -- did every verbatim field pass the substring gate?
  integrity_issues    jsonb,                  -- [{ path, value }] of fields that did NOT match the snapshot
  diff_from_published jsonb,                  -- populated on re-fetch when changed (Pipeline D)
  reviewer_id         uuid,
  reviewed_at         timestamptz,
  review_notes        text,
  created_by          uuid
);

create index if not exists vd_source_idx   on verification_drafts (source_id);
create index if not exists vd_snapshot_idx on verification_drafts (snapshot_id);
create index if not exists vd_queue_idx    on verification_drafts (status, fact_type);

-- One latest draft per snapshot (re-extracting a snapshot replaces its draft).
create unique index if not exists vd_one_per_snapshot on verification_drafts (snapshot_id);

-- review_queue (§3): drafts needing human attention, newest first.
-- security_invoker => the view runs as the querying user and HONORS the RLS
-- on verification_drafts / verification_sources (without it, a view runs as its
-- owner and bypasses RLS — leaking curator-only rows to anon).
create or replace view review_queue with (security_invoker = true) as
  select d.id, d.fact_type, d.status, d.integrity_ok, d.extracted_at,
         d.source_id, d.snapshot_id,
         s.university_id, s.program_id, s.source_url, s.platform
  from verification_drafts d
  join verification_sources s on s.id = d.source_id
  where d.status in ('draft','in_review','needs_review')
  order by d.extracted_at desc;

alter table verification_drafts enable row level security;

drop policy if exists vd_curator on verification_drafts;
create policy vd_curator on verification_drafts
  using (is_curator()) with check (is_curator());
