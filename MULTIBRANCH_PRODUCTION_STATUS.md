# Multi-Branch Production Status — 16 Aug 2026

## Current state

The production Supabase database uses branch-owned data isolation.

Current real branch:
- Branch Code: `KHALSA-CBSE`
- Branch Name: `Khalsa CBSE Branch`
- School: `Sri Chaitanya School`
- Location: `Hayathnagar`
- Academic Year: `2026-27`

No real second branch has been onboarded yet. Other authorized branches can now self-onboard from a secure invitation link without using the Platform Admin account.

## Verified Khalsa counts

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
- Real production branches before the first external onboarding: exactly 1 (`KHALSA-CBSE`)

## Database isolation

Branch ownership is stored on users, sessions, teachers, sections, subjects, teaching mappings, user scopes, weekly-entry requests, Weekly Status, Year Plans, Year Plan links/weeks and safe recapture state.

Database-level same-branch composite foreign keys reject cross-branch relationships. Per-branch uniqueness allows normal labels such as teacher names, usernames, section names, internal batch codes and subject names to be reused by different branches without sharing records.

A deliberate dummy Branch 2 attack rehearsal was run inside a database transaction and rolled back. It verified that cross-branch sessions, mappings and Weekly Status writes are rejected.

## Data API security

Direct browser access to sensitive operational tables is closed. RLS is enabled and the application uses branch-aware server functions with service-role access plus explicit server-derived branch filtering.

The post-cutover Supabase Security Advisor has no ERROR/WARN findings from the previously identified blockers. Remaining `RLS enabled no policy` notices are informational and intentional for tables accessed through server-side custom-session functions.

## Production Edge Functions

The original branch-aware/hardened functions remain active, including:
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

Branch onboarding functions:
- `branch-onboarding` v2 — Platform Admin plus secure invitation-token self-service validation/activation
- `branch-setup` v1 — direct web setup page endpoint

## Self-service branch onboarding

The system owner no longer needs to collect or enter another branch's data.

An authorized branch receives one secure setup invitation link. From that page the branch can:
1. Download the standard Excel onboarding template.
2. Fill its own Branch, Classes_Sections, Teachers, Subjects, Teaching_Mappings and HODs data.
3. Upload the workbook itself.
4. Run server-side validation before anything is created.
5. Activate its own branch after validation passes.
6. Receive its own Branch Code and temporary Dean/HOD/Teacher passwords.
7. Download its credentials immediately.
8. Open the normal Syllabus Tracker login with its Branch Code prefilled.
9. Upload and manage its own Year Plans after login.
10. Open/close its own Weekly Status entry as Branch Super Admin.

The invitation token is stored only as a SHA-256 hash in server-side settings. Self-registration is enabled with a maximum of 50 registered branches. Workbook row limits also protect the service from oversized registrations.

A new branch is inserted as inactive first. It becomes active only after all classes, subjects, teachers, mappings, users, scopes and branch settings are created successfully. If onboarding fails, cleanup is attempted and the branch is not activated.

Khalsa academic data is never copied into a new branch.

## Year Plan source status

All 52 existing Khalsa Year Plans have `parse_status = parsed`; partial plans: 0.

The Class VI Lead Hindi plan was repaired from the exact original Library source with 42 missing dated rows added, giving 49 dated rows through 24 Mar 2027. Weekly Status remained at 154 during that repair.

48 Year Plans have central Supabase Storage objects. Four legacy plans remain Library-backed with `storage_path = null`; their captured database rows and original Library sources were verified.

## Frontend source

GitHub `main` now contains:
- `app-multibranch-ui.js` — optional Branch Code login, authenticated branch identity, branch-aware reports, and Branch Code prefill from branch login links;
- `app-branch-onboarding.js` — Platform Admin onboarding workspace;
- `branch-setup.html` — self-service external branch setup page;
- `app.js` loader v59;
- service worker cache `khalsa-syllabus-v30`;
- branch-neutral PWA manifest (`Syllabus Tracker`).

Existing Khalsa usernames remain backward compatible: Branch Code can be left blank while the username is unique. When the same username exists in multiple branches, Branch Code is required to disambiguate login.

## Isolation rule

A normal branch user can only access that branch's users, teachers, sections, subjects, mappings, Year Plans, Weekly Status, reports, entry controls and same-branch impersonation targets. Browser-supplied branch identifiers are not authoritative; the server derives branch ownership from the authenticated application session.

Self-service onboarding can create a new branch but cannot access or copy another branch's academic records.

## Owner's ongoing role

For another trusted branch, the owner only needs to share the secure setup invitation link. The receiving branch is responsible for its own workbook, validation, activation, credentials, Year Plans, staff access and weekly tracking. The owner does not need to prepare or upload their branch data.