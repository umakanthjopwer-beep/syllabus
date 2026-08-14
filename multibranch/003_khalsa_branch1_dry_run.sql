-- DEVELOPMENT / REVIEW DRAFT ONLY.
-- This script ALWAYS ROLLS BACK. It is designed to rehearse the future production
-- migration without leaving schema or data changes behind.
-- Do not remove the final ROLLBACK until a separate production cutover is approved.

begin;

-- 1) Branch master and branch-scoped settings.
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  branch_name text not null,
  school_name text not null default 'Sri Chaitanya School',
  location text,
  academic_year text not null default '2026-27',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_branches_code_ci on branches(lower(branch_code));

insert into branches(branch_code,branch_name,school_name,location,academic_year)
values('KHALSA-CBSE','Khalsa CBSE Branch','Sri Chaitanya School','Hayathnagar','2026-27')
on conflict do nothing;

create table if not exists branch_settings (
  branch_id uuid not null references branches(id),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key(branch_id,key)
);

-- 2) Add nullable branch ownership first. No NOT NULL until validation succeeds.
alter table app_users add column if not exists branch_id uuid references branches(id);
alter table app_sessions add column if not exists branch_id uuid references branches(id);
alter table teachers add column if not exists branch_id uuid references branches(id);
alter table sections add column if not exists branch_id uuid references branches(id);
alter table subjects add column if not exists branch_id uuid references branches(id);
alter table teaching_mappings add column if not exists branch_id uuid references branches(id);
alter table user_departments add column if not exists branch_id uuid references branches(id);
alter table user_sections add column if not exists branch_id uuid references branches(id);
alter table user_subjects add column if not exists branch_id uuid references branches(id);
alter table weekly_entry_requests add column if not exists branch_id uuid references branches(id);
alter table weekly_status add column if not exists branch_id uuid references branches(id);
alter table year_plans add column if not exists branch_id uuid references branches(id);
alter table year_plan_assignments add column if not exists branch_id uuid references branches(id);
alter table year_plan_subjects add column if not exists branch_id uuid references branches(id);
alter table year_plan_weeks add column if not exists branch_id uuid references branches(id);
alter table safe_yearplan_recapture_state add column if not exists branch_id uuid references branches(id);

-- 3) Backfill all existing single-branch Khalsa data.
do $$
declare khalsa uuid;
begin
  select id into khalsa from branches where lower(branch_code)=lower('KHALSA-CBSE') limit 1;
  if khalsa is null then raise exception 'Khalsa branch seed failed'; end if;

  update teachers set branch_id=khalsa where branch_id is null;
  update sections set branch_id=khalsa where branch_id is null;
  update subjects set branch_id=khalsa where branch_id is null;
  update app_users set branch_id=khalsa where branch_id is null;
  update year_plans set branch_id=khalsa where branch_id is null;

  update app_sessions s set branch_id=u.branch_id from app_users u
   where s.user_id=u.id and s.branch_id is null;
  update teaching_mappings m set branch_id=s.branch_id from sections s
   where m.section_id=s.id and m.branch_id is null;
  update user_departments x set branch_id=u.branch_id from app_users u
   where x.user_id=u.id and x.branch_id is null;
  update user_sections x set branch_id=u.branch_id from app_users u
   where x.user_id=u.id and x.branch_id is null;
  update user_subjects x set branch_id=u.branch_id from app_users u
   where x.user_id=u.id and x.branch_id is null;
  update weekly_entry_requests x set branch_id=u.branch_id from app_users u
   where x.user_id=u.id and x.branch_id is null;
  update year_plan_assignments x set branch_id=p.branch_id from year_plans p
   where x.year_plan_id=p.id and x.branch_id is null;
  update year_plan_subjects x set branch_id=p.branch_id from year_plans p
   where x.year_plan_id=p.id and x.branch_id is null;
  update year_plan_weeks x set branch_id=p.branch_id from year_plans p
   where x.year_plan_id=p.id and x.branch_id is null;
  update weekly_status x set branch_id=s.branch_id from sections s
   where x.section_id=s.id and x.branch_id is null;
  update safe_yearplan_recapture_state x set branch_id=p.branch_id from year_plans p
   where x.plan_id=p.id and x.branch_id is null;

  insert into branch_settings(branch_id,key,value,updated_at,updated_by)
  select khalsa,key,value,updated_at,updated_by from app_settings where key='weekly_entry'
  on conflict(branch_id,key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
end $$;

-- 4) Validate that every branch-owned row was backfilled.
do $$
declare n bigint;
begin
  select sum(c) into n from (
    select count(*) c from app_users where branch_id is null union all
    select count(*) from app_sessions where branch_id is null union all
    select count(*) from teachers where branch_id is null union all
    select count(*) from sections where branch_id is null union all
    select count(*) from subjects where branch_id is null union all
    select count(*) from teaching_mappings where branch_id is null union all
    select count(*) from user_departments where branch_id is null union all
    select count(*) from user_sections where branch_id is null union all
    select count(*) from user_subjects where branch_id is null union all
    select count(*) from weekly_entry_requests where branch_id is null union all
    select count(*) from weekly_status where branch_id is null union all
    select count(*) from year_plans where branch_id is null union all
    select count(*) from year_plan_assignments where branch_id is null union all
    select count(*) from year_plan_subjects where branch_id is null union all
    select count(*) from year_plan_weeks where branch_id is null union all
    select count(*) from safe_yearplan_recapture_state where branch_id is null
  ) q;
  if n<>0 then raise exception 'Backfill failed: % rows still have null branch_id',n; end if;
end $$;

-- 5) Validate that every relationship remains inside one branch.
do $$
declare n bigint;
begin
  select sum(c) into n from (
    select count(*) c from app_sessions x join app_users u on u.id=x.user_id where x.branch_id<>u.branch_id union all
    select count(*) from app_users x join teachers t on t.id=x.teacher_id where x.teacher_id is not null and x.branch_id<>t.branch_id union all
    select count(*) from teaching_mappings x join sections s on s.id=x.section_id where x.branch_id<>s.branch_id union all
    select count(*) from teaching_mappings x join subjects s on s.id=x.subject_id where x.branch_id<>s.branch_id union all
    select count(*) from teaching_mappings x join teachers t on t.id=x.teacher_id where x.teacher_id is not null and x.branch_id<>t.branch_id union all
    select count(*) from user_sections x join app_users u on u.id=x.user_id where x.branch_id<>u.branch_id union all
    select count(*) from user_sections x join sections s on s.id=x.section_id where x.branch_id<>s.branch_id union all
    select count(*) from user_subjects x join app_users u on u.id=x.user_id where x.branch_id<>u.branch_id union all
    select count(*) from user_subjects x join subjects s on s.id=x.subject_id where x.branch_id<>s.branch_id union all
    select count(*) from year_plans x join subjects s on s.id=x.subject_id where x.branch_id<>s.branch_id union all
    select count(*) from year_plans x join app_users u on u.id=x.uploaded_by where x.uploaded_by is not null and x.branch_id<>u.branch_id union all
    select count(*) from year_plan_assignments x join year_plans p on p.id=x.year_plan_id where x.branch_id<>p.branch_id union all
    select count(*) from year_plan_assignments x join sections s on s.id=x.section_id where x.branch_id<>s.branch_id union all
    select count(*) from year_plan_subjects x join year_plans p on p.id=x.year_plan_id where x.branch_id<>p.branch_id union all
    select count(*) from year_plan_subjects x join subjects s on s.id=x.subject_id where x.branch_id<>s.branch_id union all
    select count(*) from year_plan_weeks x join year_plans p on p.id=x.year_plan_id where x.branch_id<>p.branch_id union all
    select count(*) from year_plan_weeks x join subjects s on s.id=x.subject_id where x.subject_id is not null and x.branch_id<>s.branch_id union all
    select count(*) from weekly_status x join sections s on s.id=x.section_id where x.branch_id<>s.branch_id union all
    select count(*) from weekly_status x join subjects s on s.id=x.subject_id where x.branch_id<>s.branch_id union all
    select count(*) from weekly_status x join teachers t on t.id=x.teacher_id where x.teacher_id is not null and x.branch_id<>t.branch_id union all
    select count(*) from weekly_status x join year_plans p on p.id=x.year_plan_id where x.year_plan_id is not null and x.branch_id<>p.branch_id union all
    select count(*) from weekly_entry_requests x join app_users u on u.id=x.user_id where x.branch_id<>u.branch_id union all
    select count(*) from safe_yearplan_recapture_state x join year_plans p on p.id=x.plan_id where x.branch_id<>p.branch_id
  ) q;
  if n<>0 then raise exception 'Cross-branch relationship validation failed: % mismatches',n; end if;
end $$;

-- 6) Rehearse per-branch uniqueness. These changes are rolled back below.
alter table app_users drop constraint if exists app_users_username_key;
alter table teachers drop constraint if exists teachers_name_key;
alter table sections drop constraint if exists sections_section_key;
alter table subjects drop constraint if exists subjects_name_key;
create unique index if not exists uq_app_users_branch_username_ci on app_users(branch_id,lower(username));
create unique index if not exists uq_teachers_branch_name_ci on teachers(branch_id,lower(name));
create unique index if not exists uq_sections_branch_section_ci on sections(branch_id,lower(section));
create unique index if not exists uq_sections_branch_batch_ci on sections(branch_id,lower(internal_batch));
create unique index if not exists uq_subjects_branch_name_ci on subjects(branch_id,lower(name));

-- 7) Rehearse NOT NULL only after all validations passed.
alter table app_users alter column branch_id set not null;
alter table app_sessions alter column branch_id set not null;
alter table teachers alter column branch_id set not null;
alter table sections alter column branch_id set not null;
alter table subjects alter column branch_id set not null;
alter table teaching_mappings alter column branch_id set not null;
alter table user_departments alter column branch_id set not null;
alter table user_sections alter column branch_id set not null;
alter table user_subjects alter column branch_id set not null;
alter table weekly_entry_requests alter column branch_id set not null;
alter table weekly_status alter column branch_id set not null;
alter table year_plans alter column branch_id set not null;
alter table year_plan_assignments alter column branch_id set not null;
alter table year_plan_subjects alter column branch_id set not null;
alter table year_plan_weeks alter column branch_id set not null;
alter table safe_yearplan_recapture_state alter column branch_id set not null;

-- 8) Useful branch indexes.
create index if not exists idx_sessions_branch on app_sessions(branch_id);
create index if not exists idx_users_branch on app_users(branch_id);
create index if not exists idx_teachers_branch on teachers(branch_id);
create index if not exists idx_sections_branch on sections(branch_id);
create index if not exists idx_subjects_branch on subjects(branch_id);
create index if not exists idx_mappings_branch on teaching_mappings(branch_id);
create index if not exists idx_plans_branch on year_plans(branch_id);
create index if not exists idx_plan_weeks_branch_week on year_plan_weeks(branch_id,week_no);
create index if not exists idx_weekly_branch_week on weekly_status(branch_id,week_start,week_end);

-- Review-only evidence before rollback.
select b.branch_code,
 (select count(*) from app_users x where x.branch_id=b.id) users,
 (select count(*) from teachers x where x.branch_id=b.id) teachers,
 (select count(*) from sections x where x.branch_id=b.id) sections,
 (select count(*) from year_plans x where x.branch_id=b.id) year_plans,
 (select count(*) from year_plan_weeks x where x.branch_id=b.id) year_plan_weeks,
 (select count(*) from weekly_status x where x.branch_id=b.id) weekly_status
from branches b where lower(b.branch_code)=lower('KHALSA-CBSE');

rollback;
-- INTENTIONAL. Production remains unchanged when this draft is rehearsed as written.
