-- ════════════════════════════════════════════════════════════════════
--  Phase 3 — §3.9 Requirements checklist (drives real completion %).
--  A per-application checklist (essays, rec letters, test sends, fee,
--  interview, …). Completion % is DERIVED from it — never stored stale.
--  Ref: FEATURES §3.9 · ARCHITECTURE §4.5.
--  RLS: owner-only via application → student.
-- ════════════════════════════════════════════════════════════════════

create table if not exists application_requirements (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  type           text not null default 'custom'
                   check (type in ('essay','recommendation','test_score','supplement','fee','interview','document','custom')),
  label          text,
  status         text not null default 'todo'
                   check (status in ('todo','in_progress','done','na')),
  due_date       date,
  notes          text,
  sort_order     int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create index if not exists ar_app_idx on application_requirements (application_id, sort_order);

alter table application_requirements enable row level security;

drop policy if exists ar_owner on application_requirements;
create policy ar_owner on application_requirements using (
  exists (select 1 from applications a join students s on s.id = a.student_id
          where a.id = application_requirements.application_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from applications a join students s on s.id = a.student_id
          where a.id = application_requirements.application_id and s.counsellor_id = auth.uid())
);
