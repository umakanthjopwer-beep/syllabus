import {
  scopeRows, stampBranch, assertSameBranch, findScopedById,
  updateScopedById, joinScoped, validateRecordGraph
} from './branch-isolation-engine.mjs';

const KH='branch-khalsa';
const OTHER='branch-other';

const users=[
  {id:'u1',branch_id:KH,name:'Khalsa Dean'},
  {id:'u2',branch_id:OTHER,name:'Other Dean'}
];
const teachers=[
  {id:'t1',branch_id:KH,name:'Khalsa Teacher'},
  {id:'t2',branch_id:OTHER,name:'Other Teacher'}
];
const sections=[
  {id:'s1',branch_id:KH,internal_batch:'C5A'},
  {id:'s2',branch_id:OTHER,internal_batch:'C5A'}
];
const plans=[
  {id:'p1',branch_id:KH,section_id:'s1',topic:'Khalsa Topic'},
  {id:'p2',branch_id:OTHER,section_id:'s2',topic:'Other Topic'}
];
const status=[
  {id:'w1',branch_id:KH,teacher_id:'t1',section_id:'s1',current_topic:'Khalsa Current'},
  {id:'w2',branch_id:OTHER,teacher_id:'t2',section_id:'s2',current_topic:'Other Current'}
];

let passed=0;
const tests=[];
function test(name,fn){tests.push([name,fn])}
function eq(actual,expected,msg=''){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(msg||`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)}
function throws(fn,contains){let error=null;try{fn()}catch(e){error=e}if(!error)throw new Error('Expected operation to be blocked');if(contains&&!String(error.message).includes(contains))throw error}

test('Khalsa user scope excludes other branch',()=>eq(scopeRows(users,KH).map(x=>x.id),['u1']));
test('Other branch scope excludes Khalsa',()=>eq(scopeRows(users,OTHER).map(x=>x.id),['u2']));
test('Teacher scope is isolated',()=>eq(scopeRows(teachers,KH).map(x=>x.id),['t1']));
test('Section scope is isolated even when internal batch names match',()=>eq(scopeRows(sections,KH).map(x=>x.id),['s1']));
test('Year Plan scope is isolated',()=>eq(scopeRows(plans,KH).map(x=>x.id),['p1']));
test('Weekly Status scope is isolated',()=>eq(scopeRows(status,KH).map(x=>x.id),['w1']));
test('New records are stamped with active branch',()=>eq(stampBranch({id:'new'},KH).branch_id,KH));
test('Payload cannot override active branch',()=>throws(()=>stampBranch({id:'bad',branch_id:OTHER},KH),'Cross-branch write blocked'));
test('Direct cross-branch record access is blocked',()=>throws(()=>assertSameBranch(users[1],KH),'Cross-branch access blocked'));
test('Cross-branch record lookup is blocked',()=>throws(()=>findScopedById(users,'u2',KH),'Cross-branch access blocked'));
test('Cross-branch update is blocked',()=>throws(()=>updateScopedById(status,'w2',{current_topic:'Tampered'},KH),'Cross-branch access blocked'));
test('Scoped join cannot attach another branch record',()=>{
  const joined=joinScoped({leftRows:status,rightRows:teachers,leftKey:'teacher_id',rightKey:'id',branchId:KH});
  eq(joined.length,1);eq(joined[0].right.id,'t1');
});
test('Related graph must remain inside one branch',()=>eq(validateRecordGraph({record:status[0],related:[teachers[0],sections[0]],branchId:KH}),true));
test('Mixed-branch graph is blocked',()=>throws(()=>validateRecordGraph({record:status[0],related:[teachers[1]],branchId:KH}),'Cross-branch access blocked'));

for(const [name,fn] of tests){
  try{fn();passed++;console.log(`PASS ${name}`)}catch(e){console.error(`FAIL ${name}: ${e.message}`);process.exitCode=1}
}
console.log(`RESULT ${passed}/${tests.length} isolation checks passed`);
