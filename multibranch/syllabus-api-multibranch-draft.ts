// @ts-nocheck
// DEVELOPMENT DRAFT ONLY. DO NOT DEPLOY TO PRODUCTION WITHOUT THE CUTOVER RUNBOOK.
// Multi-branch replacement design for the current syllabus-api Edge Function.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder();
const ADMIN=new Set(["Super Admin","Principal","Admin"]);
const ROLES=new Set(["Super Admin","Principal","Admin","HOD","Teacher"]);

class AppError extends Error{status:number;code:string;constructor(message:string,status=400,code="bad_request"){super(message);this.status=status;this.code=code}}
function res(v:any,status=200){return new Response(JSON.stringify(v),{status,headers:cors})}
function b64(a:Uint8Array){let s="";for(const x of a)s+=String.fromCharCode(x);return btoa(s)}
function unb64(v:string){const s=atob(v),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
async function sha(v:string){return b64(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))))}
async function pbkdf2(p:string,salt:string,it:number){const k=await crypto.subtle.importKey("raw",enc.encode(p),"PBKDF2",false,["deriveBits"]);return b64(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:it,hash:"SHA-256"},k,256)))}
async function passwordRecord(p:string){const salt=b64(crypto.getRandomValues(new Uint8Array(16))),iterations=200000;return{password_salt:salt,password_hash:await pbkdf2(p,salt,iterations),password_iterations:iterations}}
async function passwordOK(p:string,u:any){return(await pbkdf2(p,u.password_salt,u.password_iterations))===u.password_hash}
function token(){return b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}
function publicUser(u:any){return{id:u.id,teacher_id:u.teacher_id,name:u.name,username:u.username,role:u.role,primary_department:u.primary_department,access_enabled:u.access_enabled,must_change_password:u.must_change_password,employee_id:u.employee_id,employee_code:u.employee_code,designation:u.designation}}
function publicBranch(b:any){return{id:b.id,branch_code:b.branch_code,branch_name:b.branch_name,school_name:b.school_name,location:b.location,academic_year:b.academic_year,active:b.active}}
function norm(v:any){return String(v??"").trim()}
function unique(values:any[]){return [...new Set((values||[]).filter(Boolean))]}
function requireAdmin(u:any){if(!ADMIN.has(u.role))throw new AppError("Admin access required",403,"forbidden")}
function requireRole(role:string){if(!ROLES.has(role))throw new AppError("Invalid role")}

async function activeBranchByCode(branchCode:string){
  const code=norm(branchCode);if(!code)return null;
  const{data,error}=await db.from("branches").select("*").ilike("branch_code",code).eq("active",true).maybeSingle();if(error)throw error;return data||null
}

async function login(username:string,password:string,branchCode:string){
  const userName=norm(username);if(!userName||!password)return null;
  const branch=branchCode?await activeBranchByCode(branchCode):null;
  if(branchCode&&!branch)return null;
  let q=db.from("app_users").select("*").ilike("username",userName).eq("access_enabled",true);
  if(branch)q=q.eq("branch_id",branch.id);
  const{data,error}=await q.limit(3);if(error)throw error;
  const candidates=data||[];
  if(!branch&&candidates.length>1)throw new AppError("This username exists in more than one branch. Enter Branch Code.",409,"branch_code_required");
  const u=candidates[0];if(!u||!u.branch_id||!(await passwordOK(password,u)))return null;
  const ownedBranch=branch||await (async()=>{const{data:b,error:e}=await db.from("branches").select("*").eq("id",u.branch_id).eq("active",true).maybeSingle();if(e)throw e;return b})();
  if(!ownedBranch)return null;
  const raw=token(),token_hash=await sha(raw),expires_at=new Date(Date.now()+14*86400000).toISOString();
  const{error:se}=await db.from("app_sessions").insert({user_id:u.id,branch_id:ownedBranch.id,token_hash,expires_at});if(se)throw se;
  return{token:raw,user:publicUser(u),branch:publicBranch(ownedBranch)}
}

async function auth(req:Request){
  const h=req.headers.get("authorization")||"",raw=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";if(!raw)return null;
  const token_hash=await sha(raw),now=new Date().toISOString();
  const{data:s,error:se}=await db.from("app_sessions").select("id,user_id,branch_id,expires_at").eq("token_hash",token_hash).gt("expires_at",now).maybeSingle();if(se)throw se;if(!s?.branch_id)return null;
  const[{data:u,error:ue},{data:b,error:be}]=await Promise.all([
    db.from("app_users").select("*").eq("id",s.user_id).eq("branch_id",s.branch_id).eq("access_enabled",true).maybeSingle(),
    db.from("branches").select("*").eq("id",s.branch_id).eq("active",true).maybeSingle()
  ]);if(ue)throw ue;if(be)throw be;if(!u||!b)return null;
  await db.from("app_sessions").update({last_seen_at:now}).eq("id",s.id).eq("branch_id",s.branch_id);
  return{user:u,branch:b,branchId:s.branch_id,sessionId:s.id,token_hash}
}

async function scopes(ctx:any,userId?:string){
  const uid=userId||ctx.user.id,branchId=ctx.branchId;
  const[d,s,sub]=await Promise.all([
    db.from("user_departments").select("department").eq("user_id",uid).eq("branch_id",branchId),
    db.from("user_sections").select("section_id").eq("user_id",uid).eq("branch_id",branchId),
    db.from("user_subjects").select("subject_id").eq("user_id",uid).eq("branch_id",branchId)
  ]);
  return{departments:(d.data||[]).map((x:any)=>x.department),sectionIds:(s.data||[]).map((x:any)=>x.section_id),subjectIds:(sub.data||[]).map((x:any)=>x.subject_id)}
}

async function adminUserScopes(ctx:any){
  const branchId=ctx.branchId,[d,s,sub]=await Promise.all([
    db.from("user_departments").select("user_id,department").eq("branch_id",branchId),
    db.from("user_sections").select("user_id,section_id").eq("branch_id",branchId),
    db.from("user_subjects").select("user_id,subject_id").eq("branch_id",branchId)
  ]);const out:any={};
  for(const r of d.data||[])(out[r.user_id]??={departments:[],sectionIds:[],subjectIds:[]}).departments.push(r.department);
  for(const r of s.data||[])(out[r.user_id]??={departments:[],sectionIds:[],subjectIds:[]}).sectionIds.push(r.section_id);
  for(const r of sub.data||[])(out[r.user_id]??={departments:[],sectionIds:[],subjectIds:[]}).subjectIds.push(r.subject_id);
  return out
}

async function ownOne(table:string,id:string,branchId:string,columns="*"){
  if(!id)throw new AppError(`${table} id is required`);
  const{data,error}=await db.from(table).select(columns).eq("id",id).eq("branch_id",branchId).maybeSingle();if(error)throw error;if(!data)throw new AppError("Record is outside this branch or does not exist",403,"cross_branch_blocked");return data
}
async function ownMany(table:string,ids:string[],branchId:string){
  const list=unique(ids);if(!list.length)return[];
  const{data,error}=await db.from(table).select("id").eq("branch_id",branchId).in("id",list);if(error)throw error;if((data||[]).length!==list.length)throw new AppError(`One or more ${table} records are outside this branch`,403,"cross_branch_blocked");return data||[]
}

async function bootstrap(ctx:any){
  const u=ctx.user,branchId=ctx.branchId,sc=await scopes(ctx);
  const[sr,subr,tr,mr,pr,ar,lr,wr,wsr,bs]=await Promise.all([
    db.from("sections").select("*").eq("branch_id",branchId).eq("active",true).order("grade").order("section"),
    db.from("subjects").select("*").eq("branch_id",branchId).order("department").order("name"),
    db.from("teachers").select("*").eq("branch_id",branchId).eq("active",true).order("name"),
    db.from("teaching_mappings").select("*").eq("branch_id",branchId).order("created_at"),
    db.from("year_plans").select("*").eq("branch_id",branchId).order("uploaded_at",{ascending:false}),
    db.from("year_plan_assignments").select("*").eq("branch_id",branchId),
    db.from("year_plan_subjects").select("*").eq("branch_id",branchId),
    db.from("year_plan_weeks").select("*").eq("branch_id",branchId).order("week_no"),
    db.from("weekly_status").select("*").eq("branch_id",branchId).order("submitted_at",{ascending:false}),
    db.from("branch_settings").select("key,value,updated_at").eq("branch_id",branchId)
  ]);
  let sections=sr.data||[],subjects=subr.data||[],teachers=tr.data||[],mappings=mr.data||[],plans=pr.data||[],assignments=ar.data||[],planSubjects=lr.data||[],weeks=wr.data||[],weekly=wsr.data||[];
  if(!ADMIN.has(u.role)){
    if(u.role==="HOD"){
      subjects=subjects.filter((x:any)=>sc.departments.includes(x.department));const subjectIds=new Set(subjects.map((x:any)=>x.id));
      mappings=mappings.filter((x:any)=>subjectIds.has(x.subject_id)&&x.active_for_syllabus);const sectionIds=new Set(mappings.map((x:any)=>x.section_id));
      sections=sections.filter((x:any)=>sectionIds.has(x.id));teachers=teachers.filter((t:any)=>mappings.some((m:any)=>m.teacher_id===t.id));
      const linkPlanIds=new Set(planSubjects.filter((x:any)=>subjectIds.has(x.subject_id)).map((x:any)=>x.year_plan_id));plans=plans.filter((p:any)=>subjectIds.has(p.subject_id)||linkPlanIds.has(p.id));
      const planIds=new Set(plans.map((p:any)=>p.id));assignments=assignments.filter((a:any)=>planIds.has(a.year_plan_id));planSubjects=planSubjects.filter((a:any)=>planIds.has(a.year_plan_id));weeks=weeks.filter((w:any)=>planIds.has(w.year_plan_id));weekly=weekly.filter((w:any)=>subjectIds.has(w.subject_id));
    }else{
      mappings=mappings.filter((m:any)=>m.teacher_id===u.teacher_id&&m.active_for_syllabus);const sectionIds=new Set(mappings.map((m:any)=>m.section_id)),subjectIds=new Set(mappings.map((m:any)=>m.subject_id));
      sections=sections.filter((x:any)=>sectionIds.has(x.id));subjects=subjects.filter((x:any)=>subjectIds.has(x.id));teachers=teachers.filter((x:any)=>x.id===u.teacher_id);
      assignments=assignments.filter((a:any)=>sectionIds.has(a.section_id));const assignedPlanIds=new Set(assignments.map((a:any)=>a.year_plan_id));const subjectPlanIds=new Set(planSubjects.filter((l:any)=>subjectIds.has(l.subject_id)).map((l:any)=>l.year_plan_id));
      plans=plans.filter((p:any)=>assignedPlanIds.has(p.id)&&(subjectIds.has(p.subject_id)||subjectPlanIds.has(p.id)));const planIds=new Set(plans.map((p:any)=>p.id));
      assignments=assignments.filter((a:any)=>planIds.has(a.year_plan_id));planSubjects=planSubjects.filter((a:any)=>planIds.has(a.year_plan_id));weeks=weeks.filter((w:any)=>planIds.has(w.year_plan_id));weekly=weekly.filter((w:any)=>w.teacher_id===u.teacher_id||(sectionIds.has(w.section_id)&&subjectIds.has(w.subject_id)));
    }
  }
  let users:any[]=[],userScopes:any={};if(ADMIN.has(u.role)){const{data,error}=await db.from("app_users").select("id,teacher_id,name,username,role,primary_department,access_enabled,must_change_password,created_at,employee_id,employee_code,designation").eq("branch_id",branchId).order("name");if(error)throw error;users=data||[];userScopes=await adminUserScopes(ctx)}
  return{user:publicUser(u),branch:publicBranch(ctx.branch),scopes:sc,sections,subjects,teachers,mappings,plans,assignments,planSubjects,weeks,weekly,users,userScopes,branchSettings:bs.data||[]}
}

async function canHandle(ctx:any,sectionId:string,subjectId:string){
  const u=ctx.user,branchId=ctx.branchId;if(ADMIN.has(u.role))return true;
  if(u.role==="HOD"){const sc=await scopes(ctx);const sub=await ownOne("subjects",subjectId,branchId,"id,department");return sc.departments.includes(sub.department)}
  if(!u.teacher_id)return false;
  const{data,error}=await db.from("teaching_mappings").select("id").eq("branch_id",branchId).eq("teacher_id",u.teacher_id).eq("section_id",sectionId).eq("subject_id",subjectId).eq("active_for_syllabus",true).maybeSingle();if(error)throw error;return!!data
}

async function saveWeekly(ctx:any,b:any){
  const branchId=ctx.branchId,u=ctx.user;if(!b.section_id||!b.subject_id)throw new AppError("Class and subject are required");
  await Promise.all([ownOne("sections",b.section_id,branchId,"id"),ownOne("subjects",b.subject_id,branchId,"id,department")]);if(!(await canHandle(ctx,b.section_id,b.subject_id)))throw new AppError("Outside assigned scope",403,"forbidden");
  let teacherId=b.teacher_id||u.teacher_id||null;if(u.role==="Teacher")teacherId=u.teacher_id||null;if(teacherId)await ownOne("teachers",teacherId,branchId,"id");if(b.year_plan_id)await ownOne("year_plans",b.year_plan_id,branchId,"id");
  const lag=Number(b.periods_lagging||0),status=lag<=0?"On Track":lag<=2?"Minor Lag":lag<=5?"Lagging":"Critical";
  const p:any={week_no:b.week_no==null?null:Number(b.week_no),week_label:b.week_label,section_id:b.section_id,subject_id:b.subject_id,teacher_id:teacherId,year_plan_id:b.year_plan_id||null,week_start:b.week_start||null,week_end:b.week_end||null,working_days:b.working_days==null?null:Number(b.working_days),planned_periods:Number(b.planned_periods||0),periods_taken:Number(b.periods_taken||0),periods_lagging:lag,planned_topic:b.planned_topic||null,current_topic:b.current_topic||null,reason:b.reason||null,status,submitted_by:u.id,updated_at:new Date().toISOString(),branch_id:branchId};
  if(b.id){await ownOne("weekly_status",b.id,branchId,"id");const{data,error}=await db.from("weekly_status").update(p).eq("id",b.id).eq("branch_id",branchId).select().single();if(error)throw error;return data}
  const{data:dup,error:de}=await db.from("weekly_status").select("id").eq("branch_id",branchId).eq("section_id",b.section_id).eq("subject_id",b.subject_id).eq("week_start",b.week_start||null).limit(1).maybeSingle();if(de)throw de;if(dup)throw new AppError("This weekly status is already saved. Use Edit.",409,"duplicate_weekly_status");
  const{data,error}=await db.from("weekly_status").insert({...p,submitted_at:new Date().toISOString()}).select().single();if(error)throw error;return data
}

async function replaceScopes(ctx:any,userId:string,b:any){
  const branchId=ctx.branchId;await ownOne("app_users",userId,branchId,"id");
  if(b.section_ids)await ownMany("sections",b.section_ids,branchId);if(b.subject_ids)await ownMany("subjects",b.subject_ids,branchId);
  if(b.departments){const{data,error}=await db.from("subjects").select("department").eq("branch_id",branchId);if(error)throw error;const allowed=new Set((data||[]).map((x:any)=>x.department).filter(Boolean));for(const d of b.departments)if(!allowed.has(d))throw new AppError(`Department ${d} does not belong to this branch`)}
  if(b.departments){await db.from("user_departments").delete().eq("user_id",userId).eq("branch_id",branchId);if(b.departments.length)await db.from("user_departments").insert(unique(b.departments).map(department=>({user_id:userId,department,branch_id:branchId})))}
  if(b.section_ids){await db.from("user_sections").delete().eq("user_id",userId).eq("branch_id",branchId);if(b.section_ids.length)await db.from("user_sections").insert(unique(b.section_ids).map(section_id=>({user_id:userId,section_id,branch_id:branchId})))}
  if(b.subject_ids){await db.from("user_subjects").delete().eq("user_id",userId).eq("branch_id",branchId);if(b.subject_ids.length)await db.from("user_subjects").insert(unique(b.subject_ids).map(subject_id=>({user_id:userId,subject_id,branch_id:branchId})))}
}

async function createUser(ctx:any,b:any){
  requireAdmin(ctx.user);requireRole(b.role);if(b.role==="Super Admin"&&ctx.user.role!=="Super Admin")throw new AppError("Only a Super Admin can create another Super Admin",403,"forbidden");
  const branchId=ctx.branchId,password=b.password||token().slice(0,12)+"aA1!",pw=await passwordRecord(password);let teacher_id=b.teacher_id||null;
  if(teacher_id)await ownOne("teachers",teacher_id,branchId,"id");else if(b.name){const{data:t,error}=await db.from("teachers").select("id").eq("branch_id",branchId).ilike("name",b.name).maybeSingle();if(error)throw error;teacher_id=t?.id||null}
  const{data:existing,error:xe}=await db.from("app_users").select("id").eq("branch_id",branchId).ilike("username",b.username).maybeSingle();if(xe)throw xe;if(existing)throw new AppError("Username already exists in this branch",409,"duplicate_username");
  const{data:n,error}=await db.from("app_users").insert({teacher_id,name:b.name,username:b.username,...pw,role:b.role,primary_department:b.primary_department||null,access_enabled:true,must_change_password:true,employee_id:b.employee_id||null,employee_code:b.employee_code||null,designation:b.designation||null,branch_id:branchId}).select().single();if(error)throw error;
  await replaceScopes(ctx,n.id,{departments:b.departments||[],section_ids:b.section_ids||[],subject_ids:b.subject_ids||[]});return{user:publicUser(n),temporary_password:password}
}

async function updateUser(ctx:any,b:any){
  requireAdmin(ctx.user);const branchId=ctx.branchId,target=await ownOne("app_users",b.user_id,branchId,"*");
  if("role"in b){requireRole(b.role);if((b.role==="Super Admin"||target.role==="Super Admin")&&ctx.user.role!=="Super Admin")throw new AppError("Only a Super Admin can change Super Admin access",403,"forbidden")}
  if("teacher_id"in b&&b.teacher_id)await ownOne("teachers",b.teacher_id,branchId,"id");
  if("username"in b&&norm(b.username)!==norm(target.username)){const{data:x,error}=await db.from("app_users").select("id").eq("branch_id",branchId).ilike("username",b.username).neq("id",target.id).maybeSingle();if(error)throw error;if(x)throw new AppError("Username already exists in this branch",409,"duplicate_username")}
  const p:any={updated_at:new Date().toISOString()};for(const k of["name","username","role","primary_department","access_enabled","teacher_id","employee_id","employee_code","designation"])if(k in b)p[k]=b[k];const{error}=await db.from("app_users").update(p).eq("id",target.id).eq("branch_id",branchId);if(error)throw error;
  await replaceScopes(ctx,target.id,b);return{updated:true}
}

async function resetPassword(ctx:any,b:any){requireAdmin(ctx.user);const target=await ownOne("app_users",b.user_id,ctx.branchId,"id,role");if(target.role==="Super Admin"&&ctx.user.role!=="Super Admin")throw new AppError("Only Super Admin can reset another Super Admin",403,"forbidden");const password=b.password||token().slice(0,12)+"aA1!",pw=await passwordRecord(password);const{error}=await db.from("app_users").update({...pw,must_change_password:true,updated_at:new Date().toISOString()}).eq("id",target.id).eq("branch_id",ctx.branchId);if(error)throw error;await db.from("app_sessions").delete().eq("user_id",target.id).eq("branch_id",ctx.branchId);return{temporary_password:password}}
async function changePassword(ctx:any,b:any){if(!b.password||String(b.password).length<8)throw new AppError("Password must be at least 8 characters");const pw=await passwordRecord(b.password);const{error}=await db.from("app_users").update({...pw,must_change_password:false,updated_at:new Date().toISOString()}).eq("id",ctx.user.id).eq("branch_id",ctx.branchId);if(error)throw error;await db.from("app_sessions").delete().eq("user_id",ctx.user.id).eq("branch_id",ctx.branchId);return{changed:true}}

function safeFileName(v:any){return String(v||"year-plan").replace(/[^a-zA-Z0-9._-]/g,"_")}
async function savePlan(ctx:any,b:any){
  requireAdmin(ctx.user);const branchId=ctx.branchId,subjectIds=unique(b.subject_ids?.length?b.subject_ids:[b.subject_id]);if(!subjectIds.length)throw new AppError("Select at least one subject");await ownMany("subjects",subjectIds,branchId);const sectionIds=unique(b.section_ids||[]);if(sectionIds.length)await ownMany("sections",sectionIds,branchId);
  let plan:any;
  if(b.id){plan=await ownOne("year_plans",b.id,branchId,"*");const patch:any={updated_at:new Date().toISOString(),subject_id:subjectIds[0]};for(const k of["file_name","department","enabled","parse_status","parse_message","file_type","file_size"])if(k in b)patch[k]=b[k];const{data,error}=await db.from("year_plans").update(patch).eq("id",plan.id).eq("branch_id",branchId).select().single();if(error)throw error;plan=data}
  else{let storage_path=null;if(b.file_base64){storage_path=`${branchId}/${Date.now()}-${safeFileName(b.file_name)}`;const{error}=await db.storage.from("year-plans").upload(storage_path,unb64(b.file_base64),{contentType:b.file_type||"application/octet-stream",upsert:false});if(error)throw error}const{data,error}=await db.from("year_plans").insert({file_name:b.file_name,storage_path,file_type:b.file_type||null,file_size:b.file_size||null,department:b.department||"",subject_id:subjectIds[0],uploaded_by:ctx.user.id,enabled:true,parse_status:b.parse_status||"parsed",parse_message:b.parse_message||null,branch_id:branchId}).select().single();if(error)throw error;plan=data}
  await db.from("year_plan_subjects").delete().eq("year_plan_id",plan.id).eq("branch_id",branchId);if(subjectIds.length)await db.from("year_plan_subjects").insert(subjectIds.map(subject_id=>({year_plan_id:plan.id,subject_id,branch_id:branchId})));
  if("section_ids"in b){await db.from("year_plan_assignments").delete().eq("year_plan_id",plan.id).eq("branch_id",branchId);if(sectionIds.length)await db.from("year_plan_assignments").insert(sectionIds.map(section_id=>({year_plan_id:plan.id,section_id,branch_id:branchId})))}
  if(Array.isArray(b.weeks)){await db.from("year_plan_weeks").delete().eq("year_plan_id",plan.id).eq("branch_id",branchId);if(b.weeks.length){for(const w of b.weeks)if(w.subject_id)await ownOne("subjects",w.subject_id,branchId,"id");const rows=b.weeks.map((w:any,i:number)=>({year_plan_id:plan.id,week_no:Number(w.week_no||i+1),week_label:w.week_label||`Week ${w.week_no||i+1}`,start_date:w.start_date||null,end_date:w.end_date||null,working_days:w.working_days??null,planned_periods:w.planned_periods??null,topic:w.topic||null,source_row:w.source_row??null,grade:w.grade??null,subject_id:w.subject_id||subjectIds[0],branch_id:branchId}));const{error}=await db.from("year_plan_weeks").insert(rows);if(error)throw error}}
  return plan
}

async function planUrl(ctx:any,b:any){const branchId=ctx.branchId,p=await ownOne("year_plans",b.id,branchId,"id,storage_path,subject_id");if(!p.storage_path)throw new AppError("Original file is not available in central storage",404,"file_missing");if(!ADMIN.has(ctx.user.role)){const sc=await scopes(ctx);if(!sc.subjectIds.includes(p.subject_id)){const{data:a,error}=await db.from("year_plan_assignments").select("section_id").eq("branch_id",branchId).eq("year_plan_id",p.id);if(error)throw error;if(!(a||[]).some((x:any)=>sc.sectionIds.includes(x.section_id)))throw new AppError("Plan is outside your scope",403,"forbidden")}}const{data,error}=await db.storage.from("year-plans").createSignedUrl(p.storage_path,300);if(error)throw error;return{url:data.signedUrl}}
async function deletePlan(ctx:any,b:any){requireAdmin(ctx.user);const branchId=ctx.branchId,p=await ownOne("year_plans",b.id,branchId,"id,storage_path");await db.from("weekly_status").update({year_plan_id:null,updated_at:new Date().toISOString()}).eq("branch_id",branchId).eq("year_plan_id",p.id);await Promise.all([db.from("year_plan_assignments").delete().eq("branch_id",branchId).eq("year_plan_id",p.id),db.from("year_plan_subjects").delete().eq("branch_id",branchId).eq("year_plan_id",p.id),db.from("year_plan_weeks").delete().eq("branch_id",branchId).eq("year_plan_id",p.id),db.from("safe_yearplan_recapture_state").delete().eq("branch_id",branchId).eq("plan_id",p.id)]);const{error}=await db.from("year_plans").delete().eq("id",p.id).eq("branch_id",branchId);if(error)throw error;if(p.storage_path)await db.storage.from("year-plans").remove([p.storage_path]);return{deleted:true}}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return res({error:"Method not allowed"},405);
  try{
    const b=await req.json().catch(()=>({})),action=b.action||"bootstrap";
    if(action==="login"){const x=await login(norm(b.username),String(b.password||""),norm(b.branch_code));return x?res(x):res({error:"Invalid username, password or branch"},401)}
    const ctx=await auth(req);if(!ctx)return res({error:"Session expired or invalid"},401);
    if(action==="bootstrap")return res(await bootstrap(ctx));
    if(action==="logout"){await db.from("app_sessions").delete().eq("id",ctx.sessionId).eq("branch_id",ctx.branchId);return res({ok:true})}
    if(action==="weekly_save")return res(await saveWeekly(ctx,b));
    if(action==="weekly_delete"){requireAdmin(ctx.user);await ownOne("weekly_status",b.id,ctx.branchId,"id");await db.from("weekly_status").delete().eq("id",b.id).eq("branch_id",ctx.branchId);return res({deleted:true})}
    if(action==="user_create")return res(await createUser(ctx,b));
    if(action==="user_update")return res(await updateUser(ctx,b));
    if(action==="user_reset_password")return res(await resetPassword(ctx,b));
    if(action==="change_password")return res(await changePassword(ctx,b));
    if(action==="yearplan_save")return res(await savePlan(ctx,b));
    if(action==="yearplan_url")return res(await planUrl(ctx,b));
    if(action==="yearplan_delete")return res(await deletePlan(ctx,b));
    return res({error:"Unknown action"},400)
  }catch(e){console.error(e);const status=e instanceof AppError?e.status:400,code=e instanceof AppError?e.code:"error";return res({error:e?.message||String(e),code},status)}
});
