-- Objective Exam teaching-plan fields only.
-- Does not alter Year Plan or Weekly Status tables.
alter table public.objective_exam_topics
  add column if not exists is_current_topic boolean not null default false,
  add column if not exists periods_required_to_complete integer,
  add column if not exists expected_completion_date date,
  add column if not exists completed_on date;

alter table public.objective_exam_topics
  drop constraint if exists objective_exam_topics_periods_required_nonnegative;
alter table public.objective_exam_topics
  add constraint objective_exam_topics_periods_required_nonnegative
  check (periods_required_to_complete is null or periods_required_to_complete >= 0);

create unique index if not exists objective_exam_topics_one_current_per_scope
  on public.objective_exam_topics(scope_id)
  where is_current_topic = true;
