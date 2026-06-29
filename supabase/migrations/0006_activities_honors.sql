-- ════════════════════════════════════════════════════════════════════
--  Phase 3 — §3.7 Activities & Honors editor.
--  Adds Common App "final cut" + rank ordering, plus the activity
--  quantifier fields. RLS already covers both tables (owner via student).
-- ════════════════════════════════════════════════════════════════════

alter table activities add column if not exists in_final_list       boolean not null default false;
alter table activities add column if not exists rank_order          int;
alter table activities add column if not exists hours_per_week      int;
alter table activities add column if not exists weeks_per_year      int;
alter table activities add column if not exists continue_in_college boolean not null default false;

alter table honors add column if not exists in_final_list boolean not null default false;
alter table honors add column if not exists rank_order    int;
