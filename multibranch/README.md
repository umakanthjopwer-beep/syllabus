# Multi-Branch Foundation (Development Only)

This folder is intentionally isolated from the current Khalsa production app.

## Safety rule
- Do not load these files from `app.js` on `main` until branch isolation is tested.
- Do not apply the database migration to the production Supabase project until separately approved and verified.
- Khalsa remains the existing live branch and must retain all current data and behaviour.
- No paid Supabase development branch is being used; testing is zero-cost and mock/local/read-only where possible.
- No multi-branch Edge Function draft in this folder is deployed to production.

## Branch status
- `multibranch-integration` is the current development branch. It contains the latest `main` Khalsa source plus all multi-branch work.
- `multibranch-foundation` is retained unchanged as a backup development snapshot.
- `main` remains the production source and does not contain the multi-branch folder.

## Target architecture
One common Syllabus Tracker application serves multiple school branches. Every school-data query is scoped by `branch_id` derived from the authenticated server session, never trusted from the browser.

Each branch owns its own users, Dean/Super Admin, HODs, teachers, sections/internal batches, subjects/mappings, Year Plans/weeks, Weekly Status, weekly-entry requests/settings, reports and audits.

## Roles
- Platform Admin: optional future cross-branch role.
- Branch Super Admin: Dean of that branch only. Internally stored as the existing `Super Admin` role for authorization compatibility.
- Principal/Admin: branch-level administration.
- HOD: department scope inside one branch.
- Teacher: own mappings inside one branch.

## Implemented in this development branch
- Branch-aware schema/backfill/rollback design.
- Browser branch-context helper plus server-side branch authorization.
- Branch-aware login/session/data gateway and common-app branch identity.
- Branch Onboarding screen, Excel adapter, validation/staging workflow and full dummy Branch 2 simulation.
- Branch onboarding activation preserves all existing repository/application state while appending new branch-owned records.
- Branch-aware `syllabus-api` draft.
- Branch-aware replacements for `weekly-entry-access`, `yearplan-weeks-all`, `syllabus-impersonate`, `yearplan-smart-api`, `seed-staff-users`, and controlled `syllabus-recover-admin`.
- Shared Edge Function branch auth helper.
- Generic `syllabus-app` common asset server.
- Generic `syllabus-web` launcher with no Khalsa-specific pre-login identity.
- Locked `publish-syllabus-app` replacement requiring a server-managed publishing secret and exact reviewed Git commit SHA; branch users are not global publishing authorities.
- Production Edge Function cutover matrix covering all 10 active functions.
- Production cutover and rollback runbooks.
- Read-only production baseline and orphan/collision audit.
- Same-branch database relationship constraint design and branch-specific `branch_settings`.
- Zero-cost migration/backfill simulator.
- Full end-to-end zero-cost cutover rehearsal with Khalsa Branch 1 and dummy Branch 2.

## Verified zero-cost test status
- Branch isolation: 14/14 passed.
- Server branch authorization: 10/10 passed.
- Onboarding validator: 8/8 passed.
- Full second-branch integration simulation: 16/16 passed.
- Excel onboarding adapter: 3/3 passed.
- Branch login/data-access: 18/18 passed.
- Common-app branch identity: 6/6 passed.
- Migration/backfill simulator: 39/39 passed.
- Branch-aware `syllabus-api` static security checks: 31/31 passed.
- Supporting Edge Function security suite: 36/36 passed.
- Common app / publisher security checks: 15/15 passed.
- Full cutover rehearsal: 82/82 passed.
- TypeScript parse check for the core API draft: passed.
- **Total executed checks: 278/278 passed.**

## Full cutover rehearsal
The end-to-end rehearsal covered onboarding, duplicate usernames across branches, branch-code login, sessions, bootstrap, HOD/Teacher scope, Year Plans, Weekly Status, reports, impersonation, weekly-entry controls, recovery, storage separation, historical Khalsa preservation and deliberate cross-branch attack attempts.

Two issues were caught and fixed during rehearsal:
1. Dean onboarding role was normalized from `Branch Super Admin` to internal `Super Admin` so existing authorization gates work correctly.
2. Onboarding activation now preserves unrelated existing application/repository state instead of rebuilding only onboarding collections.

See `FULL_CUTOVER_REHEARSAL_RESULT.md` for the full result.

## Read-only production preflight status
- No case-insensitive collisions found for usernames, teacher names, section names, internal batch codes or subject names.
- 27 relationship/orphan checks returned zero.
- Year Plans at baseline: 52 total; 48 with storage paths; 4 without storage paths.
- `weekly_entry` must become branch-specific.
- Current production has 10 active Edge Functions. All 10 now have a replacement/hardening path prepared in development; none is deployed.

## Rollout plan
1. Keep development isolated from the live Khalsa application.
2. Take a fresh read-only baseline and backup/storage manifest immediately before any cutover.
3. Apply the approved Branch-1 schema/backfill with verification and rollback readiness.
4. Deploy all reviewed branch-aware data functions and hardened common-app functions as one controlled cutover.
5. Add database same-branch constraints and branch-specific settings.
6. Smoke-test Khalsa role by role: Super Admin, Principal/Admin, HOD and Teacher.
7. Verify historical Year Plans, Weekly Status and reports remain intact.
8. Run deliberate post-migration cross-branch attack tests with a dummy/new Branch 2.
9. Activate branch onboarding only after all isolation tests pass.
10. Enable additional branches only after explicit approval.

## Current status
Production remains single-branch and unchanged. The current multi-branch development work is on `multibranch-integration`, synchronized with the latest `main`. No multi-branch schema or Edge Function has been deployed to production.
