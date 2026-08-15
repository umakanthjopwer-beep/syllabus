# Full Multi-Branch Cutover Rehearsal — Zero-Cost

Date: 15 Aug 2026
Branch: `multibranch-integration`
Production deployment: **No**
Production database changes: **No**
Paid Supabase development branch: **No**

## Result

**82/82 rehearsal checks passed.**

The rehearsal modeled Khalsa as Branch 1 and a completely separate dummy school as Branch 2 through the end-to-end workflow.

## Rehearsed successfully

- Branch 2 Excel-style onboarding, validation, staging, review and activation.
- Same internal batch code (for example `C5A`) safely existing in both branches.
- Duplicate branch-code prevention.
- Dean / Branch Super Admin onboarding using the existing internal `Super Admin` authorization role.
- HOD and Teacher branch-scoped identities.
- Same login username safely reused in two different branches.
- Branch Code required to disambiguate identical usernames across branches.
- Session records stamped with branch ownership.
- Expired session rejection.
- Tampered session/user branch mismatch rejection.
- Branch-scoped bootstrap bundles.
- Branch Super Admin admin-list access limited to own branch.
- Teacher blocked from admin-only data.
- Mathematics HOD limited to Mathematics mappings/subjects in own branch.
- Biology HOD limited to Biology mappings/subjects in own branch.
- Teacher limited to own teaching mappings.
- Branch-stamped Year Plan creation.
- New Year Plan storage path prefixed by branch.
- Existing Khalsa legacy Year Plan storage path preserved.
- Foreign subject/section/teacher relationships blocked.
- Branch-stamped Weekly Status creation.
- Cross-branch Weekly Status read/write blocked.
- Reports contain only branch-owned data.
- Branch Super Admin impersonation restricted to same-branch Teacher/HOD accounts.
- Cross-branch impersonation blocked.
- Weekly-entry open/close state independent per branch.
- Teacher cannot control branch weekly-entry setting.
- Branch Super Admin recovery resolves by Branch Code and affects only the selected branch account/session.
- Recovery of Branch 2 does not revoke Khalsa sessions.
- Direct cross-branch find/update blocked.
- Cross-branch relationship graph blocked.
- Branch-scoped joins cannot return another branch's records.
- Browser-supplied `requested_branch_id` is discarded.
- Inactive branch login rejected.
- Khalsa historical Year Plan and Weekly Status records remain unchanged after Branch 2 operations.

## Issues caught and fixed during rehearsal

### 1. Branch Super Admin role-name mismatch
The onboarding workflow created the Dean with role `Branch Super Admin`, while the branch-aware APIs authorize the established internal role `Super Admin`.

**Fix:** onboarding now stores the Dean as internal role `Super Admin`. The UI/product concept can still display “Branch Super Admin / Dean”, while authorization remains compatible with the existing role engine.

### 2. Onboarding activation could drop unrelated repository state
The mock activation helper rebuilt only the known onboarding collections. Future state such as sessions or branch settings could therefore be lost during the rehearsal layer.

**Fix:** activation now preserves the complete existing repository object and appends only the new branch-owned records.

## Production gate

This rehearsal does **not** authorize production cutover. Production remains single-branch until all of the following are explicitly approved and completed:

1. Fresh read-only production baseline and storage manifest.
2. Reviewed production migration/backfill for Khalsa Branch 1.
3. Branch-aware Edge Function deployment as one controlled cutover.
4. Database same-branch constraints and branch-specific settings.
5. Khalsa role-by-role smoke testing.
6. Historical Year Plan, Weekly Status and report verification.
7. Real post-migration cross-branch attack tests with dummy Branch 2 records.
8. Explicit approval before onboarding any real second branch.

## Rehearsal conclusion

The current zero-cost development architecture successfully completed the end-to-end two-branch rehearsal with **82/82 checks passing** after correcting the two issues above. No production data, production schema, or production Edge Function was changed by this rehearsal.
