# Edge Function Branch-Cutover Matrix

Development audit only. Based on the current production Edge Function inventory. No live function was changed.

| Function | Current production risk | Required before second branch | Development status |
|---|---|---|---|
| `syllabus-api` | Global table reads/writes; hard-coded bootstrap path has no branch ownership | Server-derived `branch_id` on login/session/bootstrap/users/weekly/year plans | Branch-aware replacement draft prepared; not deployed |
| `yearplan-weeks-all` | Pages Year Plan data globally before role filtering | Session+branch auth; page/query only owned branch | Branch-aware replacement prepared; not deployed |
| `weekly-entry-access` | Uses global `app_settings.weekly_entry`; requests/status are global | `branch_settings` plus branch-owned requests/status/controller queue | Branch-aware replacement prepared; not deployed |
| `syllabus-impersonate` | Super Admin can target a user globally; impersonated session has no branch | Caller/target same branch; stamp session branch | Branch-aware replacement prepared; not deployed |
| `yearplan-smart-api` | Save/catalog global; storage path not branch-prefixed | Branch-scope plans/subjects/sections/links/weeks; branch-prefixed uploads | Branch-aware replacement prepared; not deployed |
| `seed-staff-users` | Enumerates teachers and creates users/scopes globally | Caller-branch-only seeding or retirement | Branch-aware replacement prepared; retirement preferred after onboarding |
| `syllabus-recover-admin` | Legacy hard-coded/global recovery path | Controlled branch recovery only | Branch-aware controlled recovery prepared; not deployed |
| `syllabus-app` | Public asset proxy currently tied to Khalsa-era common app | Serve common assets only; no tenant authority | Generic common asset server prepared; not deployed |
| `syllabus-web` | Hard-coded Khalsa title/loading identity | Generic pre-login launcher; branch identity after authenticated login | Generic multi-branch launcher prepared; not deployed |
| `publish-syllabus-app` | Service-role publisher is callable without request authentication and overwrites public assets from moving `main` | Server-only publishing secret + exact reviewed Git commit + fixed file allowlist | Locked commit-pinned publisher prepared; not deployed |

## Prepared replacements
- `syllabus-api-multibranch-draft.ts`
- `edge-weekly-entry-access-multibranch.ts`
- `edge-yearplan-weeks-all-multibranch.ts`
- `edge-syllabus-impersonate-multibranch.ts`
- `edge-yearplan-smart-api-multibranch.ts`
- `edge-seed-staff-users-multibranch.ts`
- `edge-syllabus-recover-admin-multibranch.ts`
- `edge-syllabus-app-common.ts`
- `edge-syllabus-web-common.ts`
- `edge-publish-syllabus-app-secure.ts`
- shared branch auth helper: `edge-shared-branch-auth.ts`

## Security verification
- Core multi-branch tests previously executed: 145/145 passed.
- Common app / publisher static security checks: 15/15 passed.
- Supporting Edge Function review suite is present and remains a deployment-gate suite.

## Activation gate
All 10 current production Edge Functions now have a replacement/hardening path prepared in development. This does **not** mean production is multi-branch yet. Branch 2 remains blocked until the production schema migration, function deployment, common-app conversion, Khalsa role-by-role smoke tests, and deliberate cross-branch attack tests are explicitly approved and completed.
