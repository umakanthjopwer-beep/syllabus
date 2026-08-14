# Multi-Branch Foundation (Development Only)

This folder is intentionally isolated from the current Khalsa production app.

## Safety rule
- Do not load these files from `app.js` on `main` until branch isolation is tested.
- Do not apply the database migration to the production Supabase project until a safe zero-cost test path or separately approved migration is available and verified.
- Khalsa remains the existing live branch and must retain all current data and behaviour.
- No paid Supabase development branch is being used; current testing is zero-cost and mock/local only.
- No multi-branch Edge Function draft in this folder is deployed to production.

## Target architecture

One common Syllabus Tracker application serves multiple school branches.

Each branch owns its own:
- users / Dean-Super-Admin / HOD / Teacher accounts
- teachers
- sections and internal batch codes
- subjects and handling mappings
- Year Plans and Year Plan week rows
- Weekly Status records
- weekly-entry requests
- branch operational settings
- reports and audit results

Every school-data query must be scoped by `branch_id` derived from the authenticated server session, never trusted from the browser.

## Roles
- Platform Admin: optional central role for future cross-branch administration.
- Branch Super Admin: Dean of that branch; can manage only their branch.
- Principal/Admin: branch-level administration.
- HOD: department scope inside one branch.
- Teacher: own mappings inside one branch.

## Implemented in this development branch
- Branch-aware schema draft with Khalsa backfill plan; draft intentionally rolls back and has not been run on production.
- Browser branch-context helper.
- Pure branch-isolation engine for reads, writes, joins and record graphs.
- Server authorization contract that derives branch ownership from the authenticated user/session and rejects tampered branch requests.
- Branch-aware login/session runtime including duplicate-username handling across branches and session/user branch matching.
- Branch-scoped data gateway for bootstrap, reads, writes, admin lists and relationship validation.
- Client session adapter that strips browser-supplied `branch_id`/branch tampering fields before API calls.
- Common-app branch identity model and login UI adapter with Branch Code support and branch-specific header/sidebar identity.
- Detailed conversion checklist for the existing `syllabus-api`, including removal of the unsafe hard-coded bootstrap path before multi-branch cutover.
- Full branch-aware `syllabus-api` development draft covering login/session/bootstrap/users/Weekly Status/Year Plans/storage/logout.
- Static security tests for the API draft and TypeScript parse verification.
- Current Edge Function branch-cutover matrix covering all 10 active production functions.
- Production cutover runbook and rollback runbook.
- Excel onboarding field contract and validation rules.
- Staged onboarding workflow: validate -> stage -> review -> later activation.
- Excel workbook adapter for the six required onboarding sheets.
- Development Branch Onboarding screen that never writes live data directly.
- Full second-branch mock simulation with separate Dean, HODs, teachers, sections, mappings, Year Plans, Weekly Status and reports.
- Read-only production preflight audit SQL.
- Khalsa Branch-1 backfill dry-run SQL that always ends in `ROLLBACK`.
- Database-level same-branch composite relationship constraint design.
- Branch-specific `branch_settings` design so settings such as `weekly_entry` are not shared across branches.
- Zero-cost migration/backfill simulator and tests.
- Read-only 14 Aug 2026 production baseline for future before/after verification.

## Zero-cost test status
- Branch isolation tests: 14/14 passed.
- Server branch authorization tests: 10/10 passed.
- Onboarding validator tests: 8/8 passed.
- Full second-branch integration simulation: 16/16 passed.
- Excel onboarding adapter tests: 3/3 passed.
- Branch login/data-access tests: 18/18 passed.
- Common-app branch identity tests: 6/6 passed.
- Migration/backfill simulator tests: 39/39 passed.
- Branch-aware `syllabus-api` static security checks: 31/31 passed.
- TypeScript parse check for the API draft: passed.
- Total counted automated checks: 145/145 passed.

## Read-only production preflight status
- Current schema and row counts captured without modification.
- No case-insensitive collisions found for usernames, teacher names, section names, internal batch codes or subject names.
- 27 relationship/orphan checks all returned zero.
- Current Year Plan storage inventory: 52 total, 48 with storage paths, 4 without storage paths.
- `weekly_entry` identified as a branch-operational setting that must be isolated per branch.
- Current production Edge Function inventory contains 10 active functions; every data-bearing function must be branch-aware or disabled before Branch 2 activation.
- `weekly-entry-access`, `yearplan-weeks-all`, `syllabus-impersonate`, `yearplan-smart-api`, `seed-staff-users`, and `syllabus-recover-admin` currently contain global/single-branch assumptions and are explicitly blocked from Branch 2 rollout until converted or retired.

## Rollout plan
1. Keep all development isolated from the live Khalsa application.
2. Finalize branch-aware schema and production-safe backfill/rollback scripts.
3. Take a fresh read-only baseline and verify backup/storage manifest immediately before any real cutover.
4. Backfill existing Khalsa rows to Khalsa Branch 1 only after explicit approval.
5. Convert/deploy every production data-bearing Edge Function to server-derived branch context or disable it before Branch 2.
6. Add database same-branch constraints and branch-specific settings.
7. Enable the common branch-aware app only after Khalsa role-by-role smoke tests pass.
8. Activate the branch onboarding/import workflow.
9. Verify new storage paths are branch-separated and old Khalsa files remain securely accessible only through owned signed URLs.
10. Test a second branch with separate users, Year Plans, weekly-entry settings and reports.
11. Verify no cross-branch read/write, impersonation, recovery, seeding or signed-file access is possible.
12. Only after explicit approval, enable the common multi-branch app for additional branches.

## Current status
The production app remains single-branch and unchanged. The multi-branch foundation, onboarding flow, branch-wise login/data-access layer, branch-aware API draft, production-safe migration/cutover/rollback package and two-branch isolation simulation exist only on `multibranch-foundation`.
