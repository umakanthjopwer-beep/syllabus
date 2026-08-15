import assert from 'node:assert/strict';
import { stageBranchOnboarding, reviewStagedBranch, activateStagedBranch } from './onboarding-workflow.mjs';
import { scopeRows, assertSameBranch } from './branch-isolation-engine.mjs';

const workbook={
  Branch:[{'Branch Code':'TEST-CBSE','Branch Name':'Test CBSE Branch','School Name':'Sri Chaitanya School','Location':'Hyderabad','Academic Year':'2026-27','Dean / Branch Super Admin Name':'Test Dean','Dean Mobile Number / Login Username':'9000000001'}],
  Classes_Sections:[
    {'Class Display Name':'6A','Internal Batch Code':'C5A','Grade':'6','Orientation / Programme':'C Batch','Active':'Yes'},
    {'Class Display Name':'7A','Internal Batch Code':'C4A','Grade':'7','Orientation / Programme':'C Batch','Active':'Yes'}
  ],
  Teachers:[
    {'Teacher Full Name':'Test Maths','Designation':'Teacher','Department':'Mathematics','Primary Subject':'Track A','Mobile Number / Login Username':'9000000011','Active':'Yes'},
    {'Teacher Full Name':'Test Science','Designation':'Teacher','Department':'Biology','Primary Subject':'Biology','Mobile Number / Login Username':'9000000012','Active':'Yes'}
  ],
  Teaching_Mappings:[
    {'Class Display Name':'6A','Internal Batch Code':'C5A','Subject':'Track A','Department':'Mathematics','Teacher Full Name':'Test Maths','Periods Per Week':'6','Week Pattern':'Every Week','Class Teacher':'Yes','Co-Class Teacher':'No','Active for Syllabus Tracking':'Yes'},
    {'Class Display Name':'7A','Internal Batch Code':'C4A','Subject':'Biology','Department':'Biology','Teacher Full Name':'Test Science','Periods Per Week':'5','Week Pattern':'Every Week','Class Teacher':'No','Co-Class Teacher':'No','Active for Syllabus Tracking':'Yes'}
  ],
  HODs:[
    {'HOD Name':'Test Maths HOD','Department':'Mathematics','Mobile Number / Login Username':'9000000021'},
    {'HOD Name':'Test Biology HOD','Department':'Biology','Mobile Number / Login Username':'9000000022'}
  ],
  Subjects:[
    {'Subject Name':'Track A','Department':'Mathematics','Active for Syllabus Tracking':'Yes'},
    {'Subject Name':'Biology','Department':'Biology','Active for Syllabus Tracking':'Yes'}
  ]
};

const khalsaBranchId='branch-khalsa-cbse';
let repository={
  branches:[{id:khalsaBranchId,branch_code:'KHALSA-CBSE',branch_name:'Khalsa CBSE Branch'}],
  users:[{id:'khalsa-dean',branch_id:khalsaBranchId,name:'Khalsa Dean',role:'Super Admin'}],
  teachers:[{id:'khalsa-teacher-1',branch_id:khalsaBranchId,name:'Khalsa Teacher'}],
  sections:[{id:'khalsa-c5a',branch_id:khalsaBranchId,section:'6A',internal_batch:'C5A'}],
  subjects:[{id:'khalsa-bio',branch_id:khalsaBranchId,name:'Biology',department:'Biology'}],
  mappings:[],yearPlans:[],weeklyStatus:[]
};

const staged=stageBranchOnboarding(workbook,{existingBranchCodes:repository.branches.map(x=>x.branch_code)});
assert.equal(staged.status,'ready');
assert.deepEqual(staged.summary,{users:3,teachers:2,sections:2,subjects:2,mappings:2});
assert.equal(reviewStagedBranch(staged).ok,true);
repository=activateStagedBranch(staged,repository);
const testBranchId=staged.branchId;

assert.equal(scopeRows(repository.sections,khalsaBranchId).length,1);
assert.equal(scopeRows(repository.sections,testBranchId).length,2);
assert.equal(scopeRows(repository.sections,testBranchId)[0].internal_batch,'C5A');
assert.equal(scopeRows(repository.sections,khalsaBranchId)[0].internal_batch,'C5A');
assert.equal(scopeRows(repository.users,testBranchId).filter(x=>x.role==='Super Admin').length,1);
assert.equal(scopeRows(repository.users,testBranchId).filter(x=>x.role==='HOD').length,2);
assert.equal(scopeRows(repository.teachers,testBranchId).length,2);
assert.equal(scopeRows(repository.mappings,testBranchId).length,2);

repository.yearPlans.push(
  {id:'yp-khalsa',branch_id:khalsaBranchId,subject:'Biology',week_no:11,topic:'Khalsa topic'},
  {id:'yp-test',branch_id:testBranchId,subject:'Biology',week_no:11,topic:'Test branch topic'}
);
repository.weeklyStatus.push(
  {id:'ws-khalsa',branch_id:khalsaBranchId,subject:'Biology',status:'On Track'},
  {id:'ws-test',branch_id:testBranchId,subject:'Biology',status:'Lagging'}
);
assert.equal(scopeRows(repository.yearPlans,khalsaBranchId)[0].topic,'Khalsa topic');
assert.equal(scopeRows(repository.yearPlans,testBranchId)[0].topic,'Test branch topic');
assert.equal(scopeRows(repository.weeklyStatus,khalsaBranchId)[0].status,'On Track');
assert.equal(scopeRows(repository.weeklyStatus,testBranchId)[0].status,'Lagging');
assert.throws(()=>assertSameBranch(repository.weeklyStatus.find(x=>x.id==='ws-test'),khalsaBranchId),/Cross-branch/);
assert.throws(()=>stageBranchOnboarding(workbook,{existingBranchCodes:['TEST-CBSE']}),/already exists/);

const report=(branchId)=>({
  branch_id:branchId,
  teachers:scopeRows(repository.teachers,branchId).length,
  sections:scopeRows(repository.sections,branchId).length,
  yearPlans:scopeRows(repository.yearPlans,branchId).length,
  weeklyStatus:scopeRows(repository.weeklyStatus,branchId).length
});
assert.deepEqual(report(khalsaBranchId),{branch_id:khalsaBranchId,teachers:1,sections:1,yearPlans:1,weeklyStatus:1});
assert.deepEqual(report(testBranchId),{branch_id:testBranchId,teachers:2,sections:2,yearPlans:1,weeklyStatus:1});

console.log('PASS: full second-branch onboarding and isolation simulation (16/16 checks)');
