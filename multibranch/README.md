# Multi-Branch Foundation (Development Only)

This folder is intentionally isolated from the current Khalsa production app.

## Safety rule
- Do not load these files from `app.js` on `main` until branch isolation is tested.
- Do not apply the database migration to the production Supabase project until separately approved and verified.
- Khalsa remains the existing live branch and must retain all current data and behaviour.
- No paid Supabase development branch is being used; testing is zero-cost and mock/local/read-only where possible.
- No multi-branch Edge Function draft in this folder is deployed to production.

## Target architecture
One common Syllabus Tracker application serves multiple school branches. Every school-data query is scoped by `branch_id` derived from the authenticated server session, never trusted from the browser.

Each branch owns its own users, Dean/Super Admin, HODs, teachers, sections/internal batches, subjects/mappings, Year Plans/weeks, Weekly Status, weekly-entry requests/settings, reports and audits.

## Roles
- Platform Admin: optional future cross-branch role.
- Branch Super Admin: Dean of that branch only.
- Principal/Admin: branch-level administration.
- HOD: department scope inside one branch.
- Teacher: own mappings inside one branch.

## Implemented in this development branch
- Branch-aware schema/backfill/rollback design.
- Browser branch-context helper plus server-side branch authorization.
- Branch-aware login/session/data gateway and common-app branch identity.
- Branch Onboarding screen, Excel adapter, validation/staging workflow and full dummy Branch 2 simulation.
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
- TypeScript parse check for the core API draft: passed.
- **Total executed checks: 196/196 passed.**

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
8. Run deliberate cross-branch attack tests with a dummy/new Branch 2.
9. Activate branch onboarding only after all isolation tests pass.
10. Enable additional branches only after explicit approval.

## Current status
Production remains single-branch. The multi-branch architecture, onboarding, branch-wise login/data access, all 10 Edge Function replacement/hardening paths, migration/cutover/rollback package, and two-branch isolation simulation exist only on `multibranch-foundation`.
