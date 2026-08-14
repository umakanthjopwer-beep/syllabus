# Edge Function Branch-Cutover Matrix

Development audit only. Based on the current production Edge Function inventory. No live function was changed.

| Function | Current multi-branch risk | Required before second branch | Cutover action |
|---|---|---|---|
| `syllabus-api` | Global table reads/writes; current hard-coded bootstrap path has no branch ownership | Full server-derived `branch_id` on login/session/bootstrap/users/weekly/year plans | Replace with reviewed branch-aware implementation |
| `yearplan-weeks-all` | Pages all Year Plan data globally before role filtering | Authenticate session+branch, page only `.eq(branch_id, session.branch_id)`, scope links/subjects/mappings by same branch | Replace before Branch 2 activation |
| `weekly-entry-access` | Uses global `app_settings.weekly_entry`; requests/status lookups are global | Use `branch_settings`, branch-owned sessions/requests/weekly records and branch-scoped controller queue | Replace before Branch 2 activation |
| `syllabus-impersonate` | Super Admin can target a user globally by ID; impersonated session has no branch ownership | Caller and target must have same branch unless a future Platform Admin explicitly has cross-branch permission; stamp session branch | Replace before Branch 2 activation |
| `yearplan-smart-api` | Save/catalog operate globally; storage path is not branch-prefixed | Branch-scope subject/section/plan/link/week rows; prefix new files with branch ID | Replace or retire in favour of common branch-aware Year Plan API |
| `seed-staff-users` | Enumerates all teachers and creates users/scopes globally | Run only inside caller branch, or retire after onboarding workflow is enabled | Prefer retire/disable after branch onboarding is ready |
| `syllabus-recover-admin` | Hard-coded account recovery selects username globally and is unauthenticated except legacy secret/password | Must not remain as a global multi-branch recovery path | Disable before Branch 2; replace with controlled branch recovery/admin process |
| `syllabus-app` | Application-serving helper; risk depends on whether it embeds branch-specific assumptions | Confirm it serves common assets only and does not expose branch data | Audit before cutover |
| `syllabus-web` | Web-serving helper; risk depends on embedded branch identity/data | Confirm common assets only; no school-data authority | Audit before cutover |
| `publish-syllabus-app` | Publishing utility is separate from data isolation; current callable surface should be restricted | Protect publishing authorization; ensure only reviewed common app assets can be published | Security hardening before final rollout |

## Activation gate
A second branch must not be activated while any data-bearing function above can query or mutate school data without a server-derived branch filter.
