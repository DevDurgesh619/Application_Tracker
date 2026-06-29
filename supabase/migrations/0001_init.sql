-- ════════════════════════════════════════════════════════════════════
--  Phase 1 — core schema, RLS, auth wiring.
--  Catalog (shared) vs per-student tracking split; multi-tenant-ready
--  (every owned row carries counsellor ownership). See docs/ARCHITECTURE.md.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── identity / tenancy ──────────────────────────────────────────────
create table if not exists counsellors (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        text not null default 'counsellor' check (role in ('counsellor','curator','admin')),
  created_at  timestamptz not null default now()
);

-- auto-create a counsellor row when a new auth user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.counsellors (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── students (owned by a counsellor) ────────────────────────────────
create table if not exists students (
  id                  uuid primary key default gen_random_uuid(),
  counsellor_id       uuid not null references counsellors(id) on delete cascade,
  full_name           text not null,
  email               text,
  class_of            int,
  profile_summary     text,
  status              text not null default 'active' check (status in ('active','archived')),
  sat_score           int,
  sat_estimated       boolean not null default false,
  ib_predicted        text,
  gpa                 numeric,
  intended_major      text,
  budget_currency     text,
  budget_max_per_year numeric,
  target_countries    text[],
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  updated_by          uuid
);

-- ── university catalog (SHARED; curator-maintained) ─────────────────
create table if not exists universities (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  country       text,
  city          text,
  programmes    jsonb,
  test_policy   text,
  sat_p25       int,
  sat_p75       int,
  admit_rate    numeric,
  cost_reference jsonb,
  official_links jsonb,
  aid_policy    text,
  stem_notes    text,
  source_cycle  text,
  verified_at   timestamptz,
  verified_by   uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

-- programs under a university (forward-compat; grown on demand)
create table if not exists programs (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  name          text,
  degree        text,
  college       text,
  is_stem       boolean,
  entry_requirements text,
  cost_override jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  verified_at   timestamptz,
  verified_by   uuid
);

-- ── applications (student ↔ university; per-student tracking) ────────
create table if not exists applications (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references students(id) on delete cascade,
  university_id       uuid not null references universities(id) on delete restrict,
  program_id          uuid references programs(id) on delete set null,
  list_rank           int,
  tier                text check (tier in ('Reach','Realistic Reach','Target','Safety')),
  tier_source         text not null default 'suggested' check (tier_source in ('suggested','overridden')),
  status              text not null default 'Not Started',
  priority            text,
  app_platform        text,
  app_type            text,
  key_deadline        text,         -- free-text (verbatim from sheet for now)
  decision_date       text,
  scholarship_deadline text,
  outcome             text not null default 'pending' check (outcome in ('pending','accepted','rejected','waitlisted','deferred')),
  decision_received_date date,
  entry_requirements  text,
  scholarship         text,
  tuition_str         text,
  tests               text,
  aid_policy          text,
  stem_opt            text,
  interview           text,
  completion          text,
  notes               text,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  updated_by          uuid,
  unique (student_id, university_id)
);

-- ── supporting per-student data ─────────────────────────────────────
create table if not exists interviews (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  university_id uuid references universities(id) on delete set null,
  scope       text,
  scheduled_date text,
  format      text,
  prep_status text,
  outcome     text,
  interviewer text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table if not exists essays (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  scope       text,
  scope_tier  text,
  prompt      text,
  word_limit  text,
  themes      text,
  status      text not null default 'Not Started',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  name        text,
  org         text,
  position    text,
  description text,
  skills      text,
  impact      text,
  sort_order  int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table if not exists honors (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  name        text,
  body        text,
  level       text,
  description text,
  why         text,
  sort_order  int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

-- ── verification audit (catalog-level) ──────────────────────────────
create table if not exists audit_checks (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete cascade,
  scope_label   text,
  field         text,
  tracker_value text,
  verdict       text,
  verified_value text,
  source_url    text,
  verified_at   timestamptz,
  cycle_year    text,
  sort_order    int
);

-- ── global catalog meta (e.g. "biggest errors" reference list) ──────
create table if not exists catalog_meta (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- ── change log (audit trail of edits) ───────────────────────────────
create table if not exists change_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  entity_type text,
  entity_id   uuid,
  field       text,
  old_value   text,
  new_value   text,
  action      text,
  at          timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
--  Row-Level Security
-- ════════════════════════════════════════════════════════════════════
alter table counsellors   enable row level security;
alter table students      enable row level security;
alter table universities  enable row level security;
alter table programs      enable row level security;
alter table applications  enable row level security;
alter table interviews    enable row level security;
alter table essays        enable row level security;
alter table activities    enable row level security;
alter table honors        enable row level security;
alter table audit_checks  enable row level security;
alter table catalog_meta  enable row level security;
alter table change_log    enable row level security;

-- helper: is the current user a curator/admin?
create or replace function is_curator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from counsellors c where c.id = auth.uid() and c.role in ('curator','admin'));
$$;

-- counsellors: a user sees/edits only their own row
create policy counsellor_self on counsellors
  using (id = auth.uid()) with check (id = auth.uid());

-- students: owner-only
create policy students_owner on students
  using (counsellor_id = auth.uid()) with check (counsellor_id = auth.uid());

-- child tables: ownership via parent student
create policy app_owner on applications using (
  exists (select 1 from students s where s.id = applications.student_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from students s where s.id = applications.student_id and s.counsellor_id = auth.uid())
);
create policy iv_owner on interviews using (
  exists (select 1 from students s where s.id = interviews.student_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from students s where s.id = interviews.student_id and s.counsellor_id = auth.uid())
);
create policy essays_owner on essays using (
  exists (select 1 from students s where s.id = essays.student_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from students s where s.id = essays.student_id and s.counsellor_id = auth.uid())
);
create policy act_owner on activities using (
  exists (select 1 from students s where s.id = activities.student_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from students s where s.id = activities.student_id and s.counsellor_id = auth.uid())
);
create policy hon_owner on honors using (
  exists (select 1 from students s where s.id = honors.student_id and s.counsellor_id = auth.uid())
) with check (
  exists (select 1 from students s where s.id = honors.student_id and s.counsellor_id = auth.uid())
);

-- catalog: any authenticated user can READ; only curators/admins WRITE
create policy uni_read   on universities for select using (auth.role() = 'authenticated');
create policy uni_write  on universities for all using (is_curator()) with check (is_curator());
create policy prog_read  on programs     for select using (auth.role() = 'authenticated');
create policy prog_write on programs     for all using (is_curator()) with check (is_curator());
create policy audit_read on audit_checks for select using (auth.role() = 'authenticated');
create policy audit_write on audit_checks for all using (is_curator()) with check (is_curator());
create policy meta_read  on catalog_meta for select using (auth.role() = 'authenticated');
create policy meta_write on catalog_meta for all using (is_curator()) with check (is_curator());

-- change_log: a user sees only their own actions; inserts allowed for self
create policy cl_self on change_log
  using (actor_id = auth.uid()) with check (actor_id = auth.uid());
