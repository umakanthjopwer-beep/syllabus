# Common App / Publishing Audit — Multi-Branch Development

Development only. No live Edge Function was changed.

## `syllabus-app`
Current production behavior is a public asset proxy to GitHub `main`. It does not query school-data tables, so it is not a tenant-data authority. However, the current naming/User-Agent and the HTML it serves are tied to the existing Khalsa app.

Prepared replacement: `edge-syllabus-app-common.ts`.
- Serves common top-level application assets only.
- Does not accept or process `branch_id`.
- Does not query Supabase school data.
- Adds no-store and basic browser hardening headers.
- Branch identity remains a post-login application concern derived from authenticated branch context.

## `syllabus-web`
Current production launcher hard-codes `Khalsa CBSE` in the document title and loading/error text.

Prepared replacement: `edge-syllabus-web-common.ts`.
- Uses generic `Sri Chaitanya School | Syllabus Tracker` identity before login.
- Loads the same common app for all branches.
- Contains no branch data and no branch authorization logic.
- Authenticated branch identity is rendered later by the branch-aware app/session layer.

## `publish-syllabus-app`
Current production publisher is the highest-risk item in this group:
- runs with the Supabase service-role key;
- has `verify_jwt:false`;
- has no request authentication in its body;
- overwrites public app-bucket files from GitHub `main`.

Prepared replacement: `edge-publish-syllabus-app-secure.ts`.
- POST only.
- Requires a server-managed `SYLLABUS_PUBLISH_SECRET` supplied in `x-publish-key`.
- The secret is compared by SHA-256 digest rather than direct string equality.
- Requires an exact 40-character reviewed Git commit SHA.
- Publishes only a fixed allowlist of application files from that exact commit.
- Writes `publication.json` containing the deployed commit SHA and timestamp.
- Branch Super Admin, Principal, Admin, HOD and Teacher sessions are deliberately not accepted as global publishing authority.

## Security boundary
Branch users administer school data only inside their authenticated branch. Publishing common application code is platform/deployment administration and is intentionally outside all branch roles.

## Activation gate
Before multi-branch production rollout:
1. Replace or disable the unauthenticated production publisher.
2. Use the generic launcher/common asset server or equivalent static hosting.
3. Verify the published asset commit exactly matches the reviewed application commit.
4. Confirm branch-specific names/data are not embedded in common pre-login assets except temporary compatibility text that is replaced before rollout.
5. Run role-by-role Khalsa smoke tests before Branch 2 is activated.
