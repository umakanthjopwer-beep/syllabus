# Database Same-Branch Constraint Model

Development design only. Nothing in this document has been applied to production.

## Goal
Application checks are required, but they are not enough. The database should also reject a relationship that connects rows from different branches.

## Parent identity contract
For each branch-owned parent table, retain the existing globally unique `id` primary key and add a unique pair `(id, branch_id)` so child tables can use composite foreign keys.

Parents:
- `app_users (id, branch_id)`
- `teachers (id, branch_id)`
- `sections (id, branch_id)`
- `subjects (id, branch_id)`
- `year_plans (id, branch_id)`

## Composite same-branch foreign keys
At production cutover, add these in addition to existing single-id foreign keys:

- `app_sessions (user_id, branch_id)` -> `app_users (id, branch_id)`
- `app_users (teacher_id, branch_id)` -> `teachers (id, branch_id)`
- `teaching_mappings (section_id, branch_id)` -> `sections (id, branch_id)`
- `teaching_mappings (subject_id, branch_id)` -> `subjects (id, branch_id)`
- `teaching_mappings (teacher_id, branch_id)` -> `teachers (id, branch_id)`
- `user_departments (user_id, branch_id)` -> `app_users (id, branch_id)`
- `user_sections (user_id, branch_id)` -> `app_users (id, branch_id)`
- `user_sections (section_id, branch_id)` -> `sections (id, branch_id)`
- `user_subjects (user_id, branch_id)` -> `app_users (id, branch_id)`
- `user_subjects (subject_id, branch_id)` -> `subjects (id, branch_id)`
- `weekly_entry_requests (user_id, branch_id)` -> `app_users (id, branch_id)`
- `weekly_entry_requests (responded_by, branch_id)` -> `app_users (id, branch_id)`
- `year_plans (subject_id, branch_id)` -> `subjects (id, branch_id)`
- `year_plans (uploaded_by, branch_id)` -> `app_users (id, branch_id)`
- `year_plan_assignments (year_plan_id, branch_id)` -> `year_plans (id, branch_id)`
- `year_plan_assignments (section_id, branch_id)` -> `sections (id, branch_id)`
- `year_plan_subjects (year_plan_id, branch_id)` -> `year_plans (id, branch_id)`
- `year_plan_subjects (subject_id, branch_id)` -> `subjects (id, branch_id)`
- `year_plan_weeks (year_plan_id, branch_id)` -> `year_plans (id, branch_id)`
- `year_plan_weeks (subject_id, branch_id)` -> `subjects (id, branch_id)`
- `weekly_status (section_id, branch_id)` -> `sections (id, branch_id)`
- `weekly_status (subject_id, branch_id)` -> `subjects (id, branch_id)`
- `weekly_status (teacher_id, branch_id)` -> `teachers (id, branch_id)`
- `weekly_status (year_plan_id, branch_id)` -> `year_plans (id, branch_id)`
- `weekly_status (submitted_by, branch_id)` -> `app_users (id, branch_id)`
- `weekly_status (reentry_requested_by, branch_id)` -> `app_users (id, branch_id)`
- `safe_yearplan_recapture_state (plan_id, branch_id)` -> `year_plans (id, branch_id)`
- `branch_settings (updated_by, branch_id)` -> `app_users (id, branch_id)`

Nullable foreign-key columns remain nullable; PostgreSQL composite foreign keys allow the relationship when the nullable referenced id is null.

## Per-branch uniqueness
The current production database has global uniqueness for username, teacher name, section name and subject name. That must change so two branches can safely reuse normal school labels.

Required unique indexes:
- `(branch_id, lower(username))` on `app_users`
- `(branch_id, lower(name))` on `teachers`
- `(branch_id, lower(section))` on `sections`
- `(branch_id, lower(internal_batch))` on `sections`
- `(branch_id, lower(name))` on `subjects`

The existing teaching-mapping unique key can remain because section/subject/teacher ids are globally unique UUIDs. A branch-specific relationship constraint still verifies all linked ids belong to the same branch.

## Settings isolation
`app_settings` remains reserved for platform-wide settings only.

Branch-operational settings such as `weekly_entry` move to:
`branch_settings(branch_id, key, value, updated_at, updated_by)`.

This prevents Branch A from opening or closing Weekly Status entry for Branch B.

## Data API / RLS safety
The current application uses a custom application session and an Edge Function with service-role database access. Service-role access bypasses RLS, so the decisive security control remains **server-derived branch filtering in every Edge Function query**.

For direct Supabase Data API exposure, branch-owned tables should not be generally available to browser roles. Before multi-branch production cutover:
1. Audit existing `anon` and `authenticated` grants.
2. Revoke unnecessary direct table access, or create verified RLS policies if direct access is truly required.
3. Keep branch authorization in the server API even when RLS exists; use both layers where applicable.

## Storage isolation
New Year Plan uploads use branch-prefixed paths:
`<branch-id>/<generated-file-name>`.

Existing Khalsa files do **not** need to be physically moved during the initial schema cutover. They remain protected because signed URLs are issued only after `year_plans.id + authenticated branch_id` ownership validation. A later storage-normalization job can move/copy historical objects using a manifest and checksum if desired.

## Cutover order
1. Run read-only preflight and save counts.
2. Backup/verify production database and storage manifest.
3. Add nullable branch columns.
4. Seed Khalsa Branch 1.
5. Backfill.
6. Validate zero null branch ids and zero relationship mismatches.
7. Convert global uniqueness to per-branch uniqueness.
8. Add `(id, branch_id)` unique parent keys.
9. Add composite same-branch foreign keys.
10. Set branch columns NOT NULL.
11. Deploy branch-aware API.
12. Invalidate/recreate sessions if required by the final session migration.
13. Smoke-test Khalsa before onboarding any second branch.

No production step is approved merely by the existence of this document.
