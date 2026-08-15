# Final Read-Only Production Preflight — 15 Aug 2026

Production project: `sqgytgudepsgucpkecbl`
Development branch: `multibranch-integration`
Production writes performed: **No**
Schema migrations performed: **No**
Edge Functions deployed: **No**
Paid Supabase branch created: **No**

## Result

**Preflight completed. Production is not yet approved for multi-branch cutover.**

The live Khalsa data is structurally clean for branch backfill, but two cutover blockers must be resolved before any live migration:

1. Direct Data API security on three public tables must be hardened.
2. Four Year Plan rows have no stored source object, and one stored Lead Hindi plan is currently marked `partial`.

## Fresh production row counts

| Object | Rows |
|---|---:|
| app_sessions | 63 |
| app_settings | 1 |
| app_users | 30 |
| safe_yearplan_recapture_state | 0 |
| sections | 17 |
| subjects | 27 |
| teachers | 34 |
| teaching_mappings | 265 |
| user_departments | 46 |
| user_sections | 284 |
| user_subjects | 114 |
| weekly_entry_requests | 5 |
| weekly_status | 154 |
| year_plan_assignments | 177 |
| year_plan_subjects | 61 |
| year_plan_weeks | 4167 |
| year_plans | 52 |

## Identity / role baseline

- Super Admin: 1 enabled user
- Admin: 1 enabled user
- HOD: 9 enabled users
- Teacher: 19 enabled users
- Total app users: 30
- App sessions: 63 total; 61 active at the time of preflight; 2 expired
- Current global `weekly_entry` setting: `open = true`
- Weekly-entry requests: 5, all closed

## Branch schema state

No current production table in the audited school-data set has a `branch_id` column. Production therefore remains single-branch until the approved migration is applied.

## Duplicate and relationship checks

All checked collision/orphan counts were zero:

- case-insensitive app username duplicates
- teacher-name duplicates
- section-name duplicates
- internal-batch duplicates
- subject-name duplicates
- duplicate Weekly Status by section + subject + week
- duplicate Year Plan assignment links
- duplicate Year Plan subject links
- duplicate user department/section/subject links
- exact duplicate teaching mappings
- missing section/subject/teacher references in mappings
- missing users in user scopes and weekly-entry requests
- missing section/subject/teacher/year-plan references in Weekly Status
- missing Year Plan / section / subject references in Year Plan links and week rows
- sessions pointing to missing users

## Year Plan / storage baseline

- Year Plan rows: 52
- Enabled plans: 52
- Parsed: 51
- Partial: 1
- Rows with storage paths: 48
- Rows without storage paths: 4
- `year-plans` bucket objects: 48
- Stored bytes: 14,068,095
- All 48 database storage paths match an existing storage object.
- Missing referenced storage objects: 0
- Duplicate storage paths: 0
- Orphan objects in `year-plans`: 0
- `year-plans` bucket is private.
- `syllabus-app` bucket is public and currently contains 23 objects.

### Year Plan rows without a stored source object

1. `Hindi (TL-Bal Vatika) CBSE Classes VI to X TG Year Plans 2026 - 27.pdf`
2. `TG CBSE Classes IX Int Hindi LEAD Year Plans 2026 - 27.pdf`
3. `TG CBSE Classes VII Int Hindi LEAD Year Plans 2026 - 27.pdf`
4. `TG CBSE Classes VIII Int Hindi LEAD Year Plans 2026 - 27.pdf`

These rows retain parsed/captured database data, but their original source files are not present in the `year-plans` storage bucket. They must be restored or explicitly accepted as legacy-no-source before production cutover.

### Partial Year Plan

`TG CBSE Classes VI Int Hindi LEAD Year Plans 2026 - 27.pdf` is stored, but its current parse status is `partial` with the existing audit message that capture stops at 18 Jul 2026 and source re-capture is required.

This should be corrected before cutover so post-migration verification does not preserve a known incomplete source capture.

## Security preflight — production blocker

Supabase Security Advisor currently reports:

### RLS disabled in exposed public schema

The following tables have RLS disabled:

- `app_settings`
- `weekly_entry_requests`
- `safe_yearplan_recapture_state`

The current grants audit also shows both `anon` and `authenticated` have broad table privileges on all three tables, including SELECT/INSERT/UPDATE/DELETE and additional table privileges.

**Cutover requirement:** multi-branch production must not rely on these direct Data API grants. The production migration/cutover package must revoke direct `anon`/`authenticated` access (or implement an equivalent explicitly reviewed RLS model) and route operational changes through the authenticated branch-aware Edge Functions.

### Other Security Advisor items to review during cutover

- RLS enabled but no policies on multiple application tables. This is compatible with the current service-role/custom-session Edge Function architecture only if direct Data API access remains unavailable to clients.
- Three legacy recapture-related functions have mutable `search_path` warnings.
- `public.enforce_weekly_status_role_scope()` is a SECURITY DEFINER function currently reported executable by anon/authenticated roles. Its EXECUTE exposure must be reviewed/revoked or the function redesigned before multi-branch activation.

## Edge Function baseline

Production currently has 10 active Edge Functions:

1. `syllabus-api`
2. `syllabus-app`
3. `publish-syllabus-app`
4. `syllabus-web`
5. `yearplan-smart-api`
6. `syllabus-recover-admin`
7. `seed-staff-users`
8. `weekly-entry-access`
9. `syllabus-impersonate`
10. `yearplan-weeks-all`

All remain unchanged in production. Branch-aware/hardened replacements exist only on the integration development branch.

## Production cutover gate after this preflight

Before live migration, complete all of the following:

1. Restore/resolve the four Year Plan rows without stored source files.
2. Correct/re-capture the one partial Lead Hindi Year Plan.
3. Add the Data API security hardening to the production migration package.
4. Review/restrict the exposed SECURITY DEFINER function and mutable-search-path functions.
5. Take one final immediately-before-cutover row-count + storage manifest snapshot.
6. Verify `multibranch-integration` is still synchronized with the current production `main`.
7. Only then request explicit approval for the live Branch-1 migration.

## Conclusion

The existing Khalsa relational data passes the branch-backfill structural checks with no duplicate-key or orphan blockers. The live cutover remains **blocked** until the source-file and direct-Data-API security items above are resolved. No production data or configuration was modified by this preflight.
