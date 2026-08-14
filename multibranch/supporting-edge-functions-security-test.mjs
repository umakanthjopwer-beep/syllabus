import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const files={
  weekly:read('edge-weekly-entry-access-multibranch.ts'),
  weeks:read('edge-yearplan-weeks-all-multibranch.ts'),
  impersonate:read('edge-syllabus-impersonate-multibranch.ts'),
  smart:read('edge-yearplan-smart-api-multibranch.ts'),
  seed:read('edge-seed-staff-users-multibranch.ts'),
  recovery:read('edge-syllabus-recover-admin-multibranch.ts'),
  shared:read('edge-shared-branch-auth.ts')
};
let passed=0;function check(name,fn){fn();passed++;console.log(`PASS ${passed}: ${name}`)}

check('shared auth requires session branch_id',()=>assert.match(files.shared,/app_sessions[\s\S]*branch_id/));
check('shared auth matches user to session branch',()=>assert.match(files.shared,/eq\("branch_id",s\.branch_id\)/));
check('shared auth requires active branch',()=>assert.match(files.shared,/from\("branches"\)[\s\S]*eq\("active",true\)/));
check('shared ownership helper checks branch_id',()=>assert.match(files.shared,/requireOwnedId[\s\S]*eq\("branch_id",branchId\)/));

check('weekly function uses branch auth',()=>assert.match(files.weekly,/authBranch\(req\)/));
check('weekly setting uses branch_settings',()=>assert.match(files.weekly,/from\("branch_settings"\)/));
check('weekly function does not use global app_settings',()=>assert.doesNotMatch(files.weekly,/from\("app_settings"\)/));
check('weekly requests are branch scoped',()=>assert.match(files.weekly,/weekly_entry_requests[\s\S]*eq\("branch_id",branchId\)/));
check('weekly status writes stamp branch_id',()=>assert.match(files.weekly,/branch_id:branchId[\s\S]*week_no/));
check('weekly edits fetch id plus branch',()=>assert.match(files.weekly,/weekly_status[\s\S]*eq\("branch_id",branchId\)\.eq\("id",b\.id\)/));
check('weekly class and subject ownership are validated',()=>assert.match(files.weekly,/requireOwnedId\("sections"[\s\S]*requireOwnedId\("subjects"/));

check('yearplan-weeks uses branch auth',()=>assert.match(files.weeks,/authBranch\(req\)/));
check('paged Year Plan reads are branch scoped',()=>assert.match(files.weeks,/select\(select\)\.eq\("branch_id",branchId\)\.range/));
check('HOD subject lookup is branch scoped',()=>assert.match(files.weeks,/from\("subjects"\)[\s\S]*eq\("branch_id",branchId\)/));
check('teacher mapping lookup is branch scoped',()=>assert.match(files.weeks,/from\("teaching_mappings"\)[\s\S]*eq\("branch_id",branchId\)/));

check('impersonation uses branch auth',()=>assert.match(files.impersonate,/authBranch\(req\)/));
check('impersonation target is restricted to caller branch',()=>assert.match(files.impersonate,/app_users[\s\S]*eq\("branch_id",a\.branchId\)\.eq\("id",userId\)/));
check('impersonation session is stamped with branch',()=>assert.match(files.impersonate,/app_sessions[\s\S]*branch_id:a\.branchId/));

check('smart Year Plan uses branch auth',()=>assert.match(files.smart,/authBranch\(req\)/));
check('smart Year Plan validates subject ownership',()=>assert.match(files.smart,/requireOwnedIds\("subjects"/));
check('smart Year Plan validates section ownership',()=>assert.match(files.smart,/requireOwnedIds\("sections"/));
check('new Year Plan row is stamped with branch',()=>assert.match(files.smart,/year_plans[\s\S]*branch_id:branchId/));
check('new storage path is branch prefixed',()=>assert.match(files.smart,/storage_path=`\$\{branchId\}\//));
check('Year Plan links are branch stamped',()=>assert.match(files.smart,/year_plan_subjects[\s\S]*branch_id:branchId[\s\S]*year_plan_assignments[\s\S]*branch_id:branchId/));
check('Year Plan weeks are branch stamped',()=>assert.match(files.smart,/year_plan_weeks[\s\S]*branch_id:branchId/));

check('staff seeding requires branch auth',()=>assert.match(files.seed,/authBranch\(req\)/));
check('staff teacher source is branch scoped',()=>assert.match(files.seed,/from\("teachers"\)[\s\S]*eq\("branch_id",branchId\)/));
check('existing user lookup is branch scoped',()=>assert.match(files.seed,/from\("app_users"\)[\s\S]*eq\("branch_id",branchId\)\.or/));
check('new seeded user is branch stamped',()=>assert.match(files.seed,/app_users[\s\S]*insert\(\{branch_id:branchId/));
check('seeded user scopes are branch stamped',()=>assert.match(files.seed,/user_departments[\s\S]*branch_id:branchId[\s\S]*user_sections[\s\S]*branch_id:branchId[\s\S]*user_subjects[\s\S]*branch_id:branchId/));

check('recovery requires server-managed recovery key',()=>assert.match(files.recovery,/SUPER_ADMIN_RECOVERY_KEY[\s\S]*x-recovery-key/));
check('recovery requires Branch Code',()=>assert.match(files.recovery,/branch_code/));
check('recovery resolves an active branch',()=>assert.match(files.recovery,/from\("branches"\)[\s\S]*eq\("active",true\)/));
check('recovery target is branch-scoped Super Admin',()=>assert.match(files.recovery,/app_users[\s\S]*eq\("branch_id",branch\.id\)[\s\S]*eq\("role","Super Admin"\)/));
check('recovery revokes only target branch sessions',()=>assert.match(files.recovery,/app_sessions[\s\S]*eq\("branch_id",branch\.id\)\.eq\("user_id",u\.id\)/));
check('old hard-coded BOOT credential is absent',()=>assert.doesNotMatch(files.recovery,/const\s+BOOT|RjNcF0qy|xjJwjz/));

console.log(`TOTAL ${passed}/${passed} PASSED`);
