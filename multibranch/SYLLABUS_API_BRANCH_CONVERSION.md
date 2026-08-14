# Syllabus API Multi-Branch Conversion Checklist

Development only. Do not deploy this design to the live Khalsa API until the production migration is separately approved and backed up.

## Non-negotiable security rule
The browser is never the authority for `branch_id`.

The authenticated server session resolves the logged-in `app_users.branch_id`, verifies it against the session branch, and every query/write is scoped with that server-derived branch id. Any browser-supplied `branch_id` is rejected or ignored.

## Login
- `app_users` receives `branch_id`.
- `app_sessions` receives `branch_id`.
- Login resolves a user by username and, when needed, `branch_code`.
- If the same username exists in more than one branch and no branch code was supplied, login returns a clear branch-code-required error.
- The successful login response includes the public branch identity, but authorization continues to use the server-side session/user branch.
- A branch must be active before its users can log in.

## Existing hard-coded bootstrap admin
The current Khalsa bootstrap path must not be reused in the common multi-branch API because it searches teachers globally and creates a user without branch ownership.

Before multi-branch cutover:
1. Ensure Khalsa Super Admin already exists with the Khalsa `branch_id`.
2. Remove/disable the hard-coded bootstrap bypass from the multi-branch API.
3. New branch Super Admin accounts are created only through the controlled branch onboarding/activation process.

## Auth / session restore
- Look up session by token hash and expiry.
- Load the user by `session.user_id`.
- Require `session.branch_id === user.branch_id`.
- Require the matching branch to be active.
- The returned authorization context is `{ user, branch, branchId }`.

## Bootstrap
Every base table query must include the authenticated branch:
- `sections.branch_id`
- `subjects.branch_id`
- `teachers.branch_id`
- `teaching_mappings.branch_id`
- `year_plans.branch_id`
- `year_plan_assignments.branch_id`
- `year_plan_subjects.branch_id`
- `year_plan_weeks.branch_id`
- `weekly_status.branch_id`
- `app_users.branch_id` for Admin user lists
- `user_departments.branch_id`
- `user_sections.branch_id`
- `user_subjects.branch_id`

Role filtering (Admin/HOD/Teacher) is applied only after branch filtering.

## Weekly Status
### Save
- Ignore/reject browser `branch_id`.
- Verify `section_id`, `subject_id`, `teacher_id` and optional `year_plan_id` all belong to the authenticated branch.
- Stamp the saved row with the authenticated branch id.
- Teacher/HOD scope checks remain in addition to branch ownership.

### Delete / re-entry
- Fetch the target row with `id + authenticated branch_id`.
- If no owned record is found, return not found/blocked.
- Never delete/update by `id` alone.

## Users & access
### Create user
- Branch Admin can create users only inside their own branch.
- The server stamps `app_users.branch_id` from the authenticated Admin.
- Any linked `teacher_id`, section ids and subject ids must be validated as owned by the same branch.
- Username uniqueness is enforced per branch, not by trusting the client.

### Update / reset password
- Target user must be in the Admin's branch.
- Scope rows are deleted/inserted using `user_id + branch_id`.
- Password reset invalidates that user's sessions in the same branch.

### Change own password
- Uses the authenticated user id and branch; no target branch is accepted from the browser.

## Year Plans
### Save/upload
- Verify subject and every assigned section belong to the authenticated branch.
- Stamp `year_plans`, assignments, subject links and week rows with the authenticated branch id.
- Store files under a branch-prefixed path such as `<branch-id>/<generated-file-name>` so storage objects are separated as well as database rows.

### View/download original
- Fetch the Year Plan using `id + authenticated branch_id`.
- Teacher/HOD scope checks are applied after ownership validation.
- A signed URL is never issued for a plan from another branch.

### Delete
- Fetch/delete only an owned plan (`id + branch_id`).
- Remove only the owned branch-prefixed storage object.

## Reports / audit / dashboard
These features consume already branch-scoped bootstrap/status data. Server-side report endpoints, if added later, must also require the authenticated branch before role/department filters.

## Onboarding activation
A staged branch package is activated only after validation passes.
The activation transaction creates/stamps:
- branch
- branch Super Admin
- HOD/Teacher users
- teachers
- sections
- subjects
- teaching mappings
- user scopes

No Weekly Status is imported during onboarding. Year Plans are uploaded afterwards under that branch.

## Cutover safety
Production conversion is not complete until all of these are proven:
1. Existing Khalsa rows are backfilled to the Khalsa branch.
2. No null `branch_id` remains on branch-owned data.
3. All API actions are branch-scoped server-side.
4. Cross-branch read/write tests pass.
5. Storage Year Plan paths are branch separated.
6. A second branch can reuse internal codes such as `C5A` without collision.
7. Khalsa user experience and historical data remain unchanged after migration.
8. A rollback/backup path is documented before deployment.
