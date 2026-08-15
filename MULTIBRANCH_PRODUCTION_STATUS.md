# Multi-Branch Production Status — 15 Aug 2026

## Current state

The production Supabase database has been migrated from the former single-branch schema to a branch-owned schema.

Current real branch:
- Branch Code: `KHALSA-CBSE`
- Branch Name: `Khalsa CBSE Branch`
- School: `Sri Chaitanya School`
- Location: `Hayathnagar`
- Academic Year: `2026-27`

No real second branch has been onboarded yet. The central Platform Admin onboarding workflow is now prepared for the next real branch.

## Final verified Khalsa counts

- App users: 30
- Teachers: 34
- Sections: 17
- Subjects: 27
- Teaching mappings: 265
- Weekly Status records: 154
- Year Plans: 52
- Year Plan dated rows: 4,209
- App sessions: 63
- Branch weekly-entry setting: open = true

Verification after migration:
- Null `branch_id` rows across branch-owned tables: 0
- Checked cross-branch relationship mismatches: 0
- Production branch rows: exactly 1 (`KHALSA-CBSE`)

## Database isolation now enforced

Branch ownership is stored on users, sessions, teachers, sections, subjects, teaching mappings, user scopes, weekly-entry requests, Weekly Status, Year Plans, Year Plan links/weeks and safe recapture state.

Database-level same-branch composite foreign keys reject cross-branch relationships. Per-branch uniqueness allows normal labels such as teacher names, usernames, section names, internal batch codes and subject names to be reused by different branches without sharing their records.

A deliberate dummy Branch 2 attack rehearsal was run inside a database transaction and rolled back. It verified:
- same normal labels can exist in two branches;
- a session cannot claim a different branch from its user;
- a teaching mapping cannot combine records from two branches;
- Weekly Status cannot be submitted across branches.

The dummy branch/data did not persist because the test ended in `ROLLBACK`.

## Data API security hardening

The former direct Data API exposure was closed for:
- `app_settings`
- `weekly_entry_requests`
- `safe_yearplan_recapture_state`

Direct `anon` / `authenticated` privileges were revoked and RLS enabled. The externally executable SECURITY DEFINER trigger RPC was also closed, and the flagged recapture trigger functions now use a pinned search path.

The post-cutover Supabase Security Advisor has no ERROR/WARN findings from the previously identified blockers. Remaining notices are informational `RLS enabled no policy` items, intentional for tables accessed by server-side custom-session Edge Functions rather than direct browser policies.

## Production Edge Functions

The original 10 production functions use the prepared branch-aware/hardened path:
- `syllabus-api` v3
- `syllabus-app` v3
- `publish-syllabus-app` v7
- `syllabus-web` v2
- `yearplan-smart-api` v4
- `syllabus-recover-admin` v2
- `seed-staff-users` v3
- `weekly-entry-access` v4
- `syllabus-impersonate` v2
- `yearplan-weeks-all` v3

A new platform-only function is also ACTIVE:
- `branch-onboarding` v1

The reviewed multi-branch functions are pinned to immutable source commits. Post-deployment logs recorded successful HTTP 200 production requests on the branch-aware `syllabus-api`, `weekly-entry-access`, `yearplan-weeks-all`, and `yearplan-smart-api` versions.

## Platform Admin / branch onboarding

`platform_admins` is now a server-only control table with RLS enabled and no direct `anon` / `authenticated` table access. The current Khalsa Super Admin is registered as the active Platform Admin.

The Platform Admin branch onboarding flow supports:
1. Downloading a standard Excel template.
2. Uploading a completed workbook containing Branch, Classes_Sections, Teachers, Subjects, Teaching_Mappings and HODs sheets.
3. Server-side validation of branch code, duplicate labels/logins, class/batch references, subjects, departments, teachers and mapping periods.
4. Creating a new branch initially as `active = false`.
5. Creating only that branch's sections, subjects, teachers, mappings and user scopes.
6. Automatically creating Dean/Super Admin, HOD and active Teacher logins with temporary passwords.
7. Activating the branch only after the full onboarding succeeds.
8. Starting the new branch's weekly-entry control as CLOSED.

If onboarding fails, the branch is not activated; cleanup is attempted immediately. Khalsa records are never copied into the new branch.

## Year Plan source status

All 52 Year Plans now have `parse_status = parsed`; partial plans: 0.

The Class VI Lead Hindi plan was repaired from the exact original Library source:
- 42 missing dated rows added;
- final dated rows: 49;
- coverage: 11 Jun 2026 through 24 Mar 2027.

Weekly Status remained at 154 during this repair; no Weekly Status history was overwritten.

48 Year Plans have central Supabase Storage objects. Four legacy plans still have `storage_path = null`, but their exact original files were verified in the user's ChatGPT Library and their captured database rows were checked. They are retained as legacy Library-backed sources; they have not been falsely marked as uploaded to Supabase Storage.

## Frontend source

GitHub `main` now contains:
- `app-multibranch-ui.js` — optional Branch Code login, authenticated branch identity and branch-aware PDF/Excel report identity;
- `app-branch-onboarding.js` — Platform Admin template/download/validate/activate/credentials workflow;
- `app.js` loader v58;
- service worker cache `khalsa-syllabus-v29`;
- branch-neutral PWA manifest (`Syllabus Tracker`).

Existing Khalsa usernames remain backward compatible: Branch Code can be left blank while the username is unique. If the same username later exists in multiple branches, the server requires Branch Code to disambiguate the login.

The source changes are committed to `main`. Cloudflare Pages deployment of the public `pages.dev` frontend is not independently verified by the available connectors, so this document does not claim a specific frontend deployment timestamp.

## Isolation rule

A branch user can only access that branch's users, teachers, sections, subjects, mappings, Year Plans, Weekly Status, reports, entry controls and impersonation targets. Browser-supplied branch identifiers are not authoritative; the server derives branch ownership from the authenticated application session.

The Platform Admin onboarding service can create branch-owned data but does not merge or copy one branch's academic data into another branch.

## Next real-branch action

The technical multi-branch foundation and onboarding workflow are ready. The only item that cannot be completed without external branch-specific information is creation of a real second branch: its completed onboarding workbook/data must exist first. No dummy or invented real branch data is kept in production.
