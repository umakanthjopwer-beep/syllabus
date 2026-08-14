import {branchFromSession,authorizeRequest,serverScopedFilters,serverStampedPayload,authorizeRecord} from './server-branch-authorization.mjs';
const KH='branch-khalsa',OTHER='branch-other';
const user={id:'u1',branch_id:KH,role:'Super Admin'};
const session={id:'sess1',user_id:'u1',branch_id:KH};
const otherRecord={id:'x',branch_id:OTHER};
const ownRecord={id:'y',branch_id:KH};
let pass=0;const tests=[];function test(n,f){tests.push([n,f])}function eq(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)}function throws(f,s){let e;try{f()}catch(x){e=x}if(!e)throw new Error('Expected block');if(s&&!e.message.includes(s))throw e}
test('Session resolves own branch',()=>eq(branchFromSession(session,user),KH));
test('Session/user mismatch is blocked',()=>throws(()=>branchFromSession({...session,user_id:'u2'},user),'Session user mismatch'));
test('Tampered session branch is blocked',()=>throws(()=>branchFromSession({...session,branch_id:OTHER},user),'Session branch mismatch'));
test('Caller cannot request another branch',()=>throws(()=>authorizeRequest({session,user,requestedBranchId:OTHER}),'Cross-branch request blocked'));
test('Server injects branch into reads',()=>eq(serverScopedFilters({session,user,filters:{week:11}}),{week:11,branch_id:KH}));
test('Server rejects tampered read filter',()=>throws(()=>serverScopedFilters({session,user,filters:{branch_id:OTHER}}),'Cross-branch request blocked'));
test('Server injects branch into writes',()=>eq(serverStampedPayload({session,user,payload:{topic:'A'}}),{topic:'A',branch_id:KH}));
test('Server rejects tampered write payload',()=>throws(()=>serverStampedPayload({session,user,payload:{branch_id:OTHER,topic:'B'}}),'Cross-branch request blocked'));
test('Own record is allowed',()=>eq(authorizeRecord({session,user,record:ownRecord}).id,'y'));
test('Other branch record is blocked',()=>throws(()=>authorizeRecord({session,user,record:otherRecord}),'Cross-branch record access blocked'));
for(const [n,f] of tests){try{f();pass++;console.log('PASS',n)}catch(e){console.error('FAIL',n,e.message);process.exitCode=1}}
console.log(`RESULT ${pass}/${tests.length} server authorization checks passed`);
