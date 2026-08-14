import assert from 'node:assert/strict';
import {resolveLoginUser,createSessionRecord,authenticateSession,loginResponse} from './branch-auth-runtime.mjs';
import {scopedRows,scopedFind,stampForWrite,assertRelated,adminRows,bootstrapBundle} from './branch-data-gateway.mjs';
import {sanitizeLoginPayload,acceptLoginResponse,apiRequest,clearSession} from './branch-client-session.mjs';

let checks=0; const test=(name,fn)=>{fn();checks++;console.log('PASS',name)};
const branches=[{id:'b1',branch_code:'KHALSA',branch_name:'Khalsa',active:true},{id:'b2',branch_code:'BR2',branch_name:'Branch 2',active:true}];
const users=[
 {id:'u1',username:'dean',branch_id:'b1',role:'Super Admin',access_enabled:true},
 {id:'u2',username:'dean',branch_id:'b2',role:'Super Admin',access_enabled:true},
 {id:'u3',username:'teacher2',branch_id:'b2',role:'Teacher',access_enabled:true}
];
const rows=[{id:'r1',branch_id:'b1',name:'Khalsa row'},{id:'r2',branch_id:'b2',name:'Other row'}];

test('duplicate username requires branch code',()=>assert.throws(()=>resolveLoginUser({users,branches,username:'dean'}),/branch code/i));
test('branch code resolves correct user',()=>assert.equal(resolveLoginUser({users,branches,username:'dean',branchCode:'BR2'}).user.id,'u2'));
test('unknown branch code rejected',()=>assert.throws(()=>resolveLoginUser({users,branches,username:'dean',branchCode:'NOPE'}),/not found/i));
test('session records branch id',()=>assert.equal(createSessionRecord({user:users[0],tokenHash:'h',expiresAt:'2099-01-01'}).branch_id,'b1'));
test('session/user branch mismatch rejected',()=>assert.throws(()=>authenticateSession({sessions:[{user_id:'u1',branch_id:'b2',token_hash:'h',expires_at:'2099-01-01'}],users,branches,tokenHash:'h'}),/mismatch/i));
const auth=authenticateSession({sessions:[{user_id:'u1',branch_id:'b1',token_hash:'h',expires_at:'2099-01-01'}],users,branches,tokenHash:'h'});
test('valid session resolves branch',()=>assert.equal(auth.branch.id,'b1'));
test('login response contains branch',()=>assert.equal(loginResponse({token:'t',user:users[0],branch:branches[0]}).branch.code,'KHALSA'));
test('scopedRows only returns own branch',()=>assert.deepEqual(scopedRows(auth,rows).map(x=>x.id),['r1']));
test('scopedFind blocks other branch',()=>assert.throws(()=>scopedFind(auth,rows,'r2'),/blocked/i));
test('write payload is stamped server-side',()=>assert.equal(stampForWrite(auth,{name:'x'}).branch_id,'b1'));
test('tampered write branch rejected',()=>assert.throws(()=>stampForWrite(auth,{branch_id:'b2'}),/blocked/i));
test('cross-branch relationship rejected',()=>assert.throws(()=>assertRelated(auth,rows[0],rows[1]),/blocked/i));
test('admin list is still branch scoped',()=>assert.deepEqual(adminRows(auth,rows).map(x=>x.id),['r1']));
test('bootstrap bundle scopes every dataset',()=>assert.deepEqual(bootstrapBundle(auth,{sections:rows,plans:rows}).plans.map(x=>x.id),['r1']));
test('client login payload may include branch code but never branch id',()=>{const p=sanitizeLoginPayload({username:'dean',password:'x',branchCode:'BR2'});assert.equal(p.branch_code,'BR2');assert.equal('branch_id' in p,false)});
const mem=new Map();const storage={setItem:(k,v)=>mem.set(k,v),getItem:k=>mem.get(k)||null,removeItem:k=>mem.delete(k)};
test('client accepts server branch and stores context',()=>assert.equal(acceptLoginResponse(storage,{token:'tok',user:{id:'u1',role:'Super Admin',branch_id:'b1'},branch:{id:'b1',code:'KHALSA'}}).id,'b1'));
test('API request strips branch tampering fields',()=>{const r=apiRequest({action:'weekly_save',payload:{branch_id:'b2',requested_branch_id:'b2',branch:{id:'b2'},x:1},storage});assert.equal(r.body.x,1);assert.equal('branch_id' in r.body,false);assert.equal('branch' in r.body,false)});
test('logout clears token and context',()=>{clearSession(storage);assert.equal(storage.getItem('syllabus_api_token'),null);assert.equal(storage.getItem('syllabus_branch_context'),null)});
console.log(`TOTAL ${checks}/18 passed`);
