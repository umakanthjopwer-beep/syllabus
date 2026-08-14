import assert from 'node:assert/strict';
import {BRANCH_TABLES,backfillKhalsa,counts,validateBranchOwnership,perBranchUnique} from './migration-backfill-simulator.mjs';

let passed=0;
function check(name,fn){fn();passed++;console.log(`PASS ${passed}: ${name}`)}

const source={
  app_users:[{id:'u1',teacher_id:'t1',name:'Dean',username:'dean'}],
  app_sessions:[{id:'sess1',user_id:'u1'}],
  teachers:[{id:'t1',name:'Teacher A'}],
  sections:[{id:'s1',section:'6A',internal_batch:'C5A'}],
  subjects:[{id:'sub1',name:'Biology'}],
  teaching_mappings:[{id:'m1',section_id:'s1',subject_id:'sub1',teacher_id:'t1'}],
  user_departments:[{user_id:'u1',department:'Biology'}],
  user_sections:[{user_id:'u1',section_id:'s1'}],
  user_subjects:[{user_id:'u1',subject_id:'sub1'}],
  weekly_entry_requests:[{id:'req1',user_id:'u1',responded_by:'u1'}],
  weekly_status:[{id:'w1',section_id:'s1',subject_id:'sub1',teacher_id:'t1',year_plan_id:'p1',submitted_by:'u1',reentry_requested_by:'u1'}],
  year_plans:[{id:'p1',subject_id:'sub1',uploaded_by:'u1',storage_path:'old-khalsa-file.pdf'}],
  year_plan_assignments:[{year_plan_id:'p1',section_id:'s1'}],
  year_plan_subjects:[{year_plan_id:'p1',subject_id:'sub1'}],
  year_plan_weeks:[{id:'pw1',year_plan_id:'p1',subject_id:'sub1',week_no:1}],
  safe_yearplan_recapture_state:[{plan_id:'p1',expected_rows:44,processed_rows:0}],
  app_settings:[{key:'weekly_entry',value:{open:true},updated_by:'u1'}]
};

const before=counts(source);
const migrated=backfillKhalsa(source);
const after=counts(migrated);

for(const table of BRANCH_TABLES){
  check(`${table} row count preserved`,()=>assert.equal(after[table],before[table]));
}
check('source object was not mutated',()=>assert.equal(source.app_users[0].branch_id,undefined));
for(const table of BRANCH_TABLES){
  check(`${table} received Khalsa branch`,()=>assert.ok((migrated[table]||[]).every(r=>r.branch_id==='branch-khalsa')));
}
check('all same-branch relationships validate',()=>assert.deepEqual(validateBranchOwnership(migrated),[]));
check('weekly_entry setting copied to Khalsa branch settings',()=>assert.deepEqual(migrated.branch_settings.find(x=>x.key==='weekly_entry')?.value,{open:true}));
check('existing storage path is preserved during schema backfill',()=>assert.equal(migrated.year_plans[0].storage_path,'old-khalsa-file.pdf'));

const withSecond={...migrated,app_users:[...migrated.app_users,{id:'u2',branch_id:'branch-two',name:'Other Dean',username:'dean'}],branches:[...migrated.branches,{id:'branch-two',branch_code:'BRANCH-2'}]};
check('same username is allowed in different branches',()=>assert.deepEqual(perBranchUnique(withSecond,'app_users','username'),[]));
const badDuplicate={...withSecond,app_users:[...withSecond.app_users,{id:'u3',branch_id:'branch-two',name:'Second User',username:'DEAN'}]};
check('case-insensitive duplicate username is blocked inside same branch',()=>assert.equal(perBranchUnique(badDuplicate,'app_users','username').length,1));

const tampered=structuredClone(migrated);tampered.weekly_status[0].branch_id='branch-two';
check('tampered weekly status relation is detected',()=>assert.ok(validateBranchOwnership(tampered).some(x=>x.includes('weekly_status'))));

console.log(`TOTAL ${passed}/${passed} PASSED`);
