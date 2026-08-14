# Current Khalsa Production Baseline — 14 Aug 2026

Read-only snapshot collected before any multi-branch production change. No production row or schema was modified to produce this baseline.

## Table row counts
- app_sessions: 56
- app_users: 30
- sections: 17
- subjects: 27
- teachers: 34
- teaching_mappings: 265
- user_departments: 46
- user_sections: 284
- user_subjects: 114
- weekly_entry_requests: 5
- weekly_status: 12
- year_plan_assignments: 177
- year_plan_subjects: 61
- year_plan_weeks: 4162
- year_plans: 52
- safe_yearplan_recapture_state: 0
- app_settings: 1

## Preflight results
- Case-insensitive duplicate usernames: 0
- Case-insensitive duplicate teacher names: 0
- Case-insensitive duplicate section names: 0
- Case-insensitive duplicate internal batch codes: 0
- Case-insensitive duplicate subject names: 0
- Orphan relationship checks: 27 checked, all 0

## Year Plan storage inventory
- Total Year Plans: 52
- With storage_path: 48
- Without storage_path: 4

The initial multi-branch schema cutover does not physically move historical Khalsa storage objects. Ownership is enforced through the Year Plan database row plus authenticated branch validation before a signed URL is issued. New multi-branch uploads use branch-prefixed storage paths.

## Branch-level setting currently present
- weekly_entry

This setting must move to `branch_settings` for Khalsa Branch 1 so a future second branch can control its own Weekly Status entry independently.

## Future cutover pass condition
After a real migration is eventually approved, the corresponding Khalsa counts must remain equal to the saved pre-cutover counts unless an intentional application change occurs between snapshot and cutover. A fresh read-only snapshot must be taken immediately before the actual migration; this file is a development baseline, not a permanent expected-count lock.
