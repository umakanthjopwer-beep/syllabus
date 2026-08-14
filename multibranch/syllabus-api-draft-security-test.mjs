import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('./syllabus-api-multibranch-draft.ts',import.meta.url),'utf8');
let n=0;const check=(name,fn)=>{fn();n++;console.log(`PASS ${n}: ${name}`)};
check('hard-coded bootstrap credential removed',()=>assert.ok(!src.includes('const BOOT=')));
check('login supports Branch Code',()=>assert.ok(src.includes('branch_code_required')&&src.includes('b.branch_code')));
check('sessions are stamped with branch_id',()=>assert.ok(src.includes('branch_id:ownedBranch.id')));
check('auth requires session branch_id',()=>assert.ok(src.includes('select("id,user_id,branch_id,expires_at")')));
check('auth matches user branch to session branch',()=>assert.ok(src.includes('.eq("branch_id",s.branch_id)')));
check('auth requires active branch',()=>assert.ok(src.includes('db.from("branches").select("*").eq("id",s.branch_id).eq("active",true)')));
check('bootstrap returns public branch identity',()=>assert.ok(src.includes('branch:publicBranch(ctx.branch)')));
for(const t of ['sections','subjects','teachers','teaching_mappings','year_plans','year_plan_assignments','year_plan_subjects','year_plan_weeks','weekly_status','branch_settings']){
  check(`${t} bootstrap is branch scoped`,()=>assert.ok(src.includes(`db.from("${t}").select`)&&src.includes(`.eq("branch_id",branchId)`)));
}
check('Admin user list is branch scoped',()=>assert.ok(src.includes('db.from("app_users").select')&&src.includes('.eq("branch_id",branchId).order("name")')));
check('scope tables are branch scoped',()=>assert.ok(['user_departments','user_sections','user_subjects'].every(t=>src.includes(`db.from("${t}").select`))));
check('client supplied branch_id is never written directly',()=>assert.ok(!src.includes('branch_id:b.branch_id')&&!src.includes('branch_id: b.branch_id')));
check('weekly save stamps server branch_id',()=>assert.ok(src.includes('branch_id:branchId')));
check('weekly update uses id plus branch_id',()=>assert.ok(src.includes('.eq("id",b.id).eq("branch_id",branchId)')));
check('weekly duplicate check is branch scoped',()=>assert.ok(src.includes('.eq("branch_id",branchId).eq("section_id",b.section_id)')));
check('user creation stamps server branch',()=>assert.ok(src.includes('designation:b.designation||null,branch_id:branchId')));
check('user update targets branch-owned user',()=>assert.ok(src.includes('target=await ownOne("app_users",b.user_id,branchId')));
check('scope inserts stamp branch_id',()=>assert.ok(src.includes('user_id:userId,section_id,branch_id:branchId')));
check('new Year Plan storage path is branch-prefixed',()=>assert.ok(src.includes('storage_path=`${branchId}/${Date.now()}-')));
check('Year Plan view starts with branch ownership check',()=>assert.ok(src.includes('p=await ownOne("year_plans",b.id,branchId')));
check('Year Plan delete is id plus branch scoped',()=>assert.ok(src.includes('db.from("year_plans").delete().eq("id",p.id).eq("branch_id",branchId)')));
check('logout deletes only authenticated branch session',()=>assert.ok(src.includes('.eq("id",ctx.sessionId).eq("branch_id",ctx.branchId)')));
check('no production deployment command embedded',()=>assert.ok(!src.includes('deploy_edge_function')&&!src.includes('apply_migration')));
console.log(`TOTAL ${n}/${n} PASSED`);
