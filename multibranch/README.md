# Multi-Branch Foundation (Development Only)

This folder is intentionally isolated from the current Khalsa production app.

## Safety rule
- Do not load these files from `app.js` on `main` until branch isolation is tested.
- Do not apply the database migration to the production Supabase project until a development database/branch is available and verified.
- Khalsa remains the existing live branch and must retain all current data and behaviour.

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

## Rollout plan
1. Add branch-aware schema in a development database only.
2. Create one seeded branch: Khalsa CBSE, Hayathnagar.
3. Backfill existing Khalsa rows with that branch id in development.
4. Update data-access functions to require branch context.
5. Add branch onboarding/import flow.
6. Test a second dummy branch with separate users, Year Plans and reports.
7. Verify no cross-branch read/write is possible.
8. Only after testing, prepare a production migration and deployment plan.

## Current status
The production app remains single-branch. This development branch begins the safe conversion without changing production.