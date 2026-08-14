# Multi-Branch Production Cutover Runbook

**Status: development plan only. Nothing in this runbook has been executed on production.**

## Purpose
Convert the current single-branch Khalsa syllabus tracker to a common multi-branch application while preserving all existing Khalsa users, mappings, Year Plans, Weekly Status, reports, and historical files.

## Mandatory safety conditions
1. Take a fresh read-only row-count/orphan/duplicate baseline immediately before cutover.
2. Export/record a Year Plan storage manifest before any schema/API change.
3. Confirm the current Khalsa Super Admin account exists normally in `app_users`; the legacy hard-coded bootstrap/recovery path is not the migration mechanism.
4. Do not activate Branch 2 until every data-bearing Edge Function is branch-aware or disabled.
5. The browser never supplies authoritative `branch_id`; server session/user ownership is authoritative.
6. No AI process may alter Lagging Report status. Multi-branch conversion changes ownership/security only.

## Cutover order
### Phase A — maintenance window and snapshot
- Temporarily stop administrative changes/imports during cutover.
- Capture fresh counts for every branch-owned table and `app_settings`.
- Capture duplicate/orphan checks.
- Capture Year Plan IDs, file names and storage paths.
- Record active Edge Function versions/hashes.

### Phase B — schema foundation
- Create `branches` and Khalsa Branch 1.
- Add nullable `branch_id` columns to all branch-owned tables, including `app_sessions` and relationship tables.
- Create `branch_settings`.
- Backfill Khalsa ownership using existing parent relationships.
- Copy current `weekly_entry` value into Khalsa `branch_settings`.
- Validate zero null branch ownership and zero cross-branch relation mismatches.
- Replace global uniqueness with per-branch uniqueness only after the backfill validates.
- Add composite same-branch foreign-key/uniqueness constraints.
- Only then make required `branch_id` columns NOT NULL.

### Phase C — API/function cutover
- Deploy branch-aware `syllabus-api` with server-derived branch sessions.
- Replace `yearplan-weeks-all` with branch-first paging.
- Replace `weekly-entry-access` with branch settings and branch request queues.
- Replace `syllabus-impersonate` so Branch Super Admin can impersonate only users in the same branch.
- Replace/retire `yearplan-smart-api`.
- Disable/retire `seed-staff-users` once onboarding handles new branches.
- Disable the global legacy `syllabus-recover-admin` path and use a controlled branch recovery procedure.
- Audit `syllabus-app`, `syllabus-web`, and protect `publish-syllabus-app`.

### Phase D — common app cutover
- Enable branch-aware login UI.
- Existing Khalsa users may continue with their current username/password; Branch Code can be prefilled/optional while username remains unique.
- Display authenticated branch identity in header/sidebar.
- Strip all client-supplied branch authority fields before API calls.
- Do not expose a branch switcher to normal branch users.

### Phase E — Khalsa smoke tests
Run using real Khalsa accounts for each role:
- Super Admin login and logout.
- Principal/Admin login.
- HOD sees only own department inside Khalsa.
- Teacher sees only own mappings.
- Users list contains Khalsa users only.
- Year Plan upload/edit/view/download works.
- Existing Year Plan library remains visible according to role.
- Weekly Status current save/edit works.
- Historical Weekly Status values and lag status remain unchanged.
- Reports and dashboard counts match the pre-cutover data after expected filtering.
- Full Year Re-capture and original-file access remain branch-owned.
- Impersonation returns safely to Super Admin and never crosses branch.

### Phase F — isolation test before Branch 2
Create a controlled dummy/new branch only after Khalsa smoke tests pass.
- Reuse a section/batch code such as `C5A` deliberately.
- Reuse a username deliberately in the second branch.
- Verify Branch 1 cannot list/read/update/delete Branch 2 rows.
- Verify Branch 2 cannot access Branch 1 Year Plan signed URLs.
- Verify weekly-entry open/closed state differs independently by branch.
- Verify impersonation cannot cross branches.

## Go/no-go rule
If any count unexpectedly changes, any branch-owned row has null/mismatched ownership, any signed file crosses branches, or any role sees another branch, stop and execute the rollback plan before allowing normal use.
