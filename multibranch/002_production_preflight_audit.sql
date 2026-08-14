-- READ-ONLY PRE-FLIGHT AUDIT. SAFE TO RUN AGAINST PRODUCTION.
-- No INSERT / UPDATE / DELETE / ALTER statements are present in this file.
-- Purpose: prove the current single-branch Khalsa data is internally consistent
-- before any future multi-branch migration is approved.

-- 1) Current row counts. Save this result before cutover and compare after backfill.
select 'app_users' table_name,count(*)::bigint rows from app_users union all
select 'app_sessions',count(*) from app_sessions union all
select 'teachers',count(*) from teachers union all
select 'sections',count(*) from sections union all
select 'subjects',count(*) from subjects union all
select 'teaching_mappings',count(*) from teaching_mappings union all
select 'user_departments',count(*) from user_departments union all
select 'user_sections',count(*) from user_sections union all
select 'user_subjects',count(*) from user_subjects union all
select 'weekly_entry_requests',count(*) from weekly_entry_requests union all
select 'weekly_status',count(*) from weekly_status union all
select 'year_plans',count(*) from year_plans union all
select 'year_plan_assignments',count(*) from year_plan_assignments union all
select 'year_plan_subjects',count(*) from year_plan_subjects union all
select 'year_plan_weeks',count(*) from year_plan_weeks union all
select 'safe_yearplan_recapture_state',count(*) from safe_yearplan_recapture_state union all
select 'app_settings',count(*) from app_settings
order by table_name;

-- 2) Case-insensitive collisions that would block per-branch uniqueness conversion.
select 'app_users.username' source,lower(username) normalized,count(*) duplicates
from app_users group by lower(username) having count(*)>1
union all
select 'teachers.name',lower(name),count(*) from teachers group by lower(name) having count(*)>1
union all
select 'sections.section',lower(section),count(*) from sections group by lower(section) having count(*)>1
union all
select 'sections.internal_batch',lower(internal_batch),count(*) from sections group by lower(internal_batch) having count(*)>1
union all
select 'subjects.name',lower(name),count(*) from subjects group by lower(name) having count(*)>1;

-- 3) Orphan checks. Every count must be zero.
select 'app_sessions.user_id' relation,count(*)::bigint orphan_rows
from app_sessions x left join app_users p on p.id=x.user_id where p.id is null
union all
select 'app_users.teacher_id',count(*) from app_users x left join teachers p on p.id=x.teacher_id where x.teacher_id is not null and p.id is null
union all
select 'teaching_mappings.section_id',count(*) from teaching_mappings x left join sections p on p.id=x.section_id where p.id is null
union all
select 'teaching_mappings.subject_id',count(*) from teaching_mappings x left join subjects p on p.id=x.subject_id where p.id is null
union all
select 'teaching_mappings.teacher_id',count(*) from teaching_mappings x left join teachers p on p.id=x.teacher_id where x.teacher_id is not null and p.id is null
union all
select 'user_departments.user_id',count(*) from user_departments x left join app_users p on p.id=x.user_id where p.id is null
union all
select 'user_sections.user_id',count(*) from user_sections x left join app_users p on p.id=x.user_id where p.id is null
union all
select 'user_sections.section_id',count(*) from user_sections x left join sections p on p.id=x.section_id where p.id is null
union all
select 'user_subjects.user_id',count(*) from user_subjects x left join app_users p on p.id=x.user_id where p.id is null
union all
select 'user_subjects.subject_id',count(*) from user_subjects x left join subjects p on p.id=x.subject_id where p.id is null
union all
select 'year_plans.subject_id',count(*) from year_plans x left join subjects p on p.id=x.subject_id where p.id is null
union all
select 'year_plans.uploaded_by',count(*) from year_plans x left join app_users p on p.id=x.uploaded_by where x.uploaded_by is not null and p.id is null
union all
select 'year_plan_assignments.year_plan_id',count(*) from year_plan_assignments x left join year_plans p on p.id=x.year_plan_id where p.id is null
union all
select 'year_plan_assignments.section_id',count(*) from year_plan_assignments x left join sections p on p.id=x.section_id where p.id is null
union all
select 'year_plan_subjects.year_plan_id',count(*) from year_plan_subjects x left join year_plans p on p.id=x.year_plan_id where p.id is null
union all
select 'year_plan_subjects.subject_id',count(*) from year_plan_subjects x left join subjects p on p.id=x.subject_id where p.id is null
union all
select 'year_plan_weeks.year_plan_id',count(*) from year_plan_weeks x left join year_plans p on p.id=x.year_plan_id where p.id is null
union all
select 'year_plan_weeks.subject_id',count(*) from year_plan_weeks x left join subjects p on p.id=x.subject_id where x.subject_id is not null and p.id is null
union all
select 'weekly_status.section_id',count(*) from weekly_status x left join sections p on p.id=x.section_id where p.id is null
union all
select 'weekly_status.subject_id',count(*) from weekly_status x left join subjects p on p.id=x.subject_id where p.id is null
union all
select 'weekly_status.teacher_id',count(*) from weekly_status x left join teachers p on p.id=x.teacher_id where x.teacher_id is not null and p.id is null
union all
select 'weekly_status.year_plan_id',count(*) from weekly_status x left join year_plans p on p.id=x.year_plan_id where x.year_plan_id is not null and p.id is null
union all
select 'weekly_status.submitted_by',count(*) from weekly_status x left join app_users p on p.id=x.submitted_by where x.submitted_by is not null and p.id is null
union all
select 'weekly_status.reentry_requested_by',count(*) from weekly_status x left join app_users p on p.id=x.reentry_requested_by where x.reentry_requested_by is not null and p.id is null
union all
select 'weekly_entry_requests.user_id',count(*) from weekly_entry_requests x left join app_users p on p.id=x.user_id where p.id is null
union all
select 'weekly_entry_requests.responded_by',count(*) from weekly_entry_requests x left join app_users p on p.id=x.responded_by where x.responded_by is not null and p.id is null
union all
select 'safe_yearplan_recapture_state.plan_id',count(*) from safe_yearplan_recapture_state x left join year_plans p on p.id=x.plan_id where p.id is null;

-- 4) Storage inventory only. No object is moved by the schema migration.
select count(*) filter (where storage_path is null) plans_without_storage_path,
       count(*) filter (where storage_path is not null) plans_with_storage_path,
       count(*) total_plans
from year_plans;

-- 5) Current branch-level setting candidates.
select key from app_settings order by key;

-- PASS CONDITION:
-- * row-count snapshot is saved;
-- * collision query returns no rows;
-- * every orphan_rows value is 0;
-- * storage inventory is understood;
-- * only intended branch-level settings are migrated to branch_settings later.
