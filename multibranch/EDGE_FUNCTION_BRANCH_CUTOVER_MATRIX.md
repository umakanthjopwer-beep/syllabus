# Edge Function Branch-Cutover Matrix

Development audit only. Based on the current production Edge Function inventory. No live function was changed.

| Function | Current multi-branch risk | Required before second branch | Development status |
|---|---|---|---|
| `syllabus-api` | Global table reads/writes; current hard-coded bootstrap path has no branch ownership | Full server-derived `branch_id` on login/session/bootstrap/users/weekly/year plans | Branch-aware replacement draft prepared; not deployed |
| `yearplan-weeks-all` | Pages all Year Plan data globally before role filtering | Authenticate session+branch, page only `.eq(branch_id, session.branch_id)`, scope links/subjects/mappings by same branch | Branch-aware replacement prepared; not deployed |
| `weekly-entry-access` | Uses global `app_settings.weekly_entry`; requests/status lookups are global | Use `branch_settings`, branch-owned sessions/requests/weekly records and branch-scoped controller queue | Branch-aware replacement prepared; not deployed |
| `syllabus-impersonate` | Super Admin can target a user globally by ID; impersonated session has no branch ownership | Caller and target must have same branch unless a future Platform Admin explicitly has cross-branch permission; stamp session branch | Branch-aware replacement prepared; not deployed |
| `yearplan-smart-api` | Save/catalog operate globally; storage path is not branch-prefixed | Branch-scope subject/section/plan/link/week rows; prefix new files with branch ID | Branch-aware replacement prepared; not deployed |
| `seed-staff-users` | Enumerates all teachers and creates users/scopes globally | Run only inside caller branch, or retire after onboarding workflow is enabled | Branch-aware replacement prepared; retirement still preferred after onboarding is active |
| `syllabus-recover-admin` | Hard-coded account recovery selects username globally and is unauthenticated except legacy secret/password | Must not remain as a global multi-branch recovery path | Controlled branch recovery replacement prepared using server-managed recovery key + Branch Code; not deployed |
| `syllabus-app` | Application-serving helper; risk depends on whether it embeds branch-specific assumptions | Confirm it serves common assets only and does not expose branch data | Audit before cutover |
| `syllabus-web` | Web-serving helper; risk depends on embedded branch identity/data | Confirm common assets only; no school-data authority | Audit before cutover |
| `publish-syllabus-app` | Publishing utility is separate from data isolation; current callable surface should be restricted | Protect publishing authorization; ensure only reviewed common app assets can be published | Security hardening before final rollout |

## Prepared supporting replacements
- `edge-weekly-entry-access-multibranch.ts`
- `edge-yearplan-weeks-all-multibranch.ts`
- `edge-syllabus-impersonate-multibranch.ts`
- `edge-yearplan-smart-api-multibranch.ts`
- `edge-seed-staff-users-multibranch.ts`
- `edge-syllabus-recover-admin-multibranch.ts`
- shared authorization helper: `edge-shared-branch-auth.ts`
- static review suite: `supporting-edge-functions-security-test.mjs`

## Activation gate
A second branch must not be activated while any production data-bearing function can query or mutate school data without a server-derived branch filter. The prepared drafts above are development artifacts only; production remains blocked until schema migration, deployment, role-by-role smoke testing and cross-branch verification are explicitly approved and completed.
