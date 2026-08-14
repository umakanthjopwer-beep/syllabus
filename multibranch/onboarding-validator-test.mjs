import {validateOnboarding} from './onboarding-validator.mjs';
const good={
Branch:[{'Branch Code':'TEST-01','Branch Name':'Test Branch','School Name':'Sri Chaitanya School','Location':'Hyderabad','Academic Year':'2026-27','Dean / Branch Super Admin Name':'Dean A','Dean Mobile Number / Login Username':'9000000001'}],
Classes_Sections:[{'Class Display Name':'6A','Internal Batch Code':'C5A','Grade':'6','Orientation / Programme':'C Batch','Active':'Yes'}],
Teachers:[{'Teacher Full Name':'Teacher A','Designation':'Teacher','Department':'Biology','Primary Subject':'Biology','Mobile Number / Login Username':'9000000002','Active':'Yes'}],
Teaching_Mappings:[{'Class Display Name':'6A','Internal Batch Code':'C5A','Subject':'Biology','Department':'Biology','Teacher Full Name':'Teacher A','Periods Per Week':'5','Week Pattern':'Every Week','Class Teacher':'No','Co-Class Teacher':'No','Active for Syllabus Tracking':'Yes'}],
HODs:[{'HOD Name':'HOD A','Department':'Biology','Mobile Number / Login Username':'9000000003'}],
Subjects:[{'Subject Name':'Biology','Department':'Biology','Active for Syllabus Tracking':'Yes'}]
};
let p=0;function check(name,fn){try{fn();p++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e.message);process.exitCode=1}}function truth(v,m){if(!v)throw new Error(m||'expected true')}function has(arr,s){truth(arr.some(x=>x.includes(s)),`missing '${s}'`)}
check('Valid workbook passes',()=>truth(validateOnboarding(good,{branchId:'b2'}).ok));
check('Every normalized section is stamped with branch',()=>truth(validateOnboarding(good,{branchId:'b2'}).normalized.sections.every(x=>x.branch_id==='b2')));
check('Duplicate batch is rejected',()=>{const x=structuredClone(good);x.Classes_Sections.push({...x.Classes_Sections[0],'Class Display Name':'6B'});has(validateOnboarding(x).errors,'Duplicate Internal Batch Code')});
check('Unknown mapping section is rejected',()=>{const x=structuredClone(good);x.Teaching_Mappings[0]['Internal Batch Code']='X1';has(validateOnboarding(x).errors,'does not exist in Classes_Sections')});
check('Unknown subject is rejected',()=>{const x=structuredClone(good);x.Teaching_Mappings[0]['Subject']='Physics';has(validateOnboarding(x).errors,'is not defined under department')});
check('Unknown teacher is rejected',()=>{const x=structuredClone(good);x.Teaching_Mappings[0]['Teacher Full Name']='Nobody';has(validateOnboarding(x).errors,"does not exist in Teachers")});
check('Duplicate login is rejected',()=>{const x=structuredClone(good);x.Teachers.push({...x.Teachers[0],'Teacher Full Name':'Teacher B'});has(validateOnboarding(x).errors,'Duplicate teacher login username')});
check('Second branch can reuse C5A safely because validation is per workbook/branch',()=>truth(validateOnboarding(structuredClone(good),{branchId:'branch-other'}).ok));
console.log(`RESULT ${p}/8 onboarding checks passed`);
