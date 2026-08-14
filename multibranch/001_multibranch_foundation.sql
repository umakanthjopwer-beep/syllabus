-- DEVELOPMENT DRAFT ONLY. DO NOT RUN ON PRODUCTION YET.
-- Purpose: convert the single-branch syllabus tracker into a branch-isolated system.

begin;

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null unique,
  branch_name text not null,
  school_name text not null default 'Sri Chaitanya School',
  location text,
  academic_year text not null default '2026-27',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed only for development/backfill testing.
insert into branches (branch_code, branch_name, school_name, location, academic_year)
values ('KHALSA-CBSE', 'Khalsa CBSE Branch', 'Sri Chaitanya School', 'Hayathnagar', '2026-27')
on conflict (branch_code) do nothing;

-- Add branch ownership to school-data tables.
alter table app_users add column if not exists branch_id uuid references branches(id);
alter table teachers add column if not exists branch_id uuid references branches(id);
alter table sections add column if not exists branch_id uuid references branches(id);
alter table subjects add column if not exists branch_id uuid references branches(id);
alter table teaching_mappings add column if not exists branch_id uuid references branches(id);
alter table year_plans add column if not exists branch_id uuid references branches(id);
alter table year_plan_assignments add column if not exists branch_id uuid references branches(id);
alter table year_plan_subjects add column if not exists branch_id uuid references branches(id);
alter table year_plan_weeks add column if not exists branch_id uuid references branches(id);
alter table weekly_status add column if not exists branch_id uuid references branches(id);
alter table weekly_entry_requests add column if not exists branch_id uuid references branches(id);
alter table user_departments add column if not exists branch_id uuid references branches(id);
alter table user_sections add column if not exists branch_id uuid references branches(id);
alter table user_subjects add column if not exists branch_id uuid references branches(id);

-- Development backfill: attach existing rows to Khalsa.
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update app_users set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update teachers set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update sections set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update subjects set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update teaching_mappings set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update year_plans set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update year_plan_assignments set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update year_plan_subjects set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update year_plan_weeks set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update weekly_status set branch_id=(select id from khalsa) where branch_id is null;
with khalsa as (select id from branches where branch_code='KHALSA-CBSE')
update weekly_entry_requests set branch_id=(select id from khalsa) where branch_id is null;

-- Indexes needed for branch-scoped lookups.
create index if not exists idx_app_users_branch on app_users(branch_id);
create index if not exists idx_teachers_branch on teachers(branch_id);
create index if not exists idx_sections_branch on sections(branch_id);
create index if not exists idx_subjects_branch on subjects(branch_id);
create index if not exists idx_mappings_branch on teaching_mappings(branch_id);
create index if not exists idx_year_plans_branch on year_plans(branch_id);
create index if not exists idx_year_plan_weeks_branch on year_plan_weeks(branch_id, week_no);
create index if not exists idx_weekly_status_branch_week on weekly_status(branch_id, week_start, week_end);

-- Do not mark branch_id NOT NULL until development backfill validation succeeds.
-- Do not add/alter RLS in production until the custom application-session model
-- has been mapped to a verified branch authorization function.

rollback;
-- Intentionally rolls back when executed as-is. A production migration will be generated only after testing.