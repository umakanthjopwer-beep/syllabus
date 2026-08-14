# Multi-Branch Foundation (Development Only)

This folder is intentionally isolated from the current Khalsa production app.

## Safety rule
- Do not load these files from `app.js` on `main` until branch isolation is tested.
- Do not apply the database migration to the production Supabase project until a development database/branch is available and verified.
- Khalsa remains the existing live branch and must retain all current data and behaviour.
- No paid Supabase development branch is being used; current testing is zero-cost and mock/local only.

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
- reports and audit results

Every school-data query must be scoped by `branch_id`.

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
- Excel onboarding field contract and validation rules.
- Staged onboarding workflow: validate -> stage -> review -> later activation.
- Excel workbook adapter for the six required onboarding sheets.
- Development Branch Onboarding screen that never writes live data directly.
- Full second-branch mock simulation with separate Dean, HODs, teachers, sections, mappings, Year Plans, Weekly Status and reports.

## Zero-cost test status
- Branch isolation tests: 14/14 passed.
- Server branch authorization tests: 10/10 passed.
- Onboarding validator tests: 8/8 passed.
- Full second-branch integration simulation: 16/16 passed.
- Excel onboarding adapter tests: 3/3 passed.
- Total current checks: 51/51 passed.

## Rollout plan
1. Add branch-aware schema in a safe test environment.
2. Create one seeded branch: Khalsa CBSE, Hayathnagar.
3. Backfill existing Khalsa rows with that branch id in test mode.
4. Update all production data-access functions to require server-derived branch context.
5. Complete branch onboarding/import flow.
6. Test a second branch with separate users, Year Plans and reports.
7. Verify no cross-branch read/write is possible.
8. Prepare a production migration with rollback and backup checks.
9. Only after explicit approval, migrate production and enable the common multi-branch app.

## Current status
The production app remains single-branch and unchanged. The multi-branch foundation, onboarding flow and two-branch isolation simulation are being developed only on `multibranch-foundation`.