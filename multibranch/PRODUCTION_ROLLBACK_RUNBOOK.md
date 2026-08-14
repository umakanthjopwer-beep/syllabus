# Multi-Branch Rollback Runbook

Development plan only. Designed to return Khalsa to the existing single-branch application if a future cutover fails.

## Fast rollback — preferred when failure is detected after API/app cutover
If schema backfill is valid but the common app/API has a functional issue:
1. Stop new writes briefly.
2. Restore the previous known-good `syllabus-api` and supporting Edge Function versions.
3. Restore the previous app assets/loader.
4. Keep added `branch_id` columns/tables in place temporarily; the old app ignores them.
5. Verify Khalsa login, Year Plans, Weekly Status and reports.
6. Do not drop new schema during the incident window unless it itself is the cause.

This is the lowest-risk rollback because additive columns do not require destructive data reversal.

## Schema rollback — only if the schema itself must be removed
Before removing anything, verify no second branch has been activated and no new multi-branch-only records exist.
1. Export the post-cutover database and branch ownership manifest.
2. Confirm every row belongs to Khalsa Branch 1 only.
3. Restore old global uniqueness constraints only after confirming no values now collide globally.
4. Restore `app_settings.weekly_entry` from Khalsa `branch_settings`.
5. Remove composite same-branch constraints first.
6. Remove per-branch indexes/constraints.
7. Drop `branch_id` columns only after all services have been rolled back to code that does not require them.
8. Drop `branch_settings` and `branches` last.
9. Re-run the original Khalsa baseline checks.

## Storage rollback
- Historical Khalsa storage paths are not moved during the initial schema cutover, so they require no physical rollback.
- If any new branch-prefixed test files were created during cutover testing, remove only those test objects after confirming they are not referenced.
- Never bulk-delete the existing Khalsa `year-plans` bucket.

## Rollback acceptance
Rollback is complete only when:
- all Khalsa users can authenticate;
- existing Year Plans are accessible;
- Weekly Status/historical lag status is unchanged;
- report counts reconcile with the fresh pre-cutover snapshot;
- no second-branch data is exposed in the single-branch UI.
