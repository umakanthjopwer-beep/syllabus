// @ts-nocheck
// Branch onboarding for Platform Admin and invitation-token self-service setup.
// New branches remain inactive until every onboarding row succeeds.
import {authBranch,cors,db,res} from "https://raw.githubusercontent.com/umakanthjopwer-beep/syllabus/3fc68be4f700c3a14efa2c23019a5d34868fbb10/multibranch/edge-shared-branch-auth.ts";

const enc=new TextEncoder();
function text(v){return String(v??"").trim()}
function key(v){return text(v).toLowerCase()}
function yes(v,defaultValue=true){const s=key(v);if(!s)return defaultValue;return ["yes","y","true","1","active"].includes(s)}
function b64(a){let s="";for(const x of a)s+=String.fromCharCode(x);return btoa(s)}
function unb64(v){const s=atob(v),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
async function pbkdf2(p,salt,it){const k=await crypto.subtle.importKey("raw",enc.encode(p),"PBKDF2",false,["deriveBits"]);return b64(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:it,hash:"SHA-256"},k,256)))}
async function passwordRecord(p){const salt=b64(crypto.getRandomValues(new Uint8Array(16))),iterations=200000;return{password_salt:salt,password_hash:await pbkdf2(p,salt,iterations),password_iterations:iterations}}
function randomPassword(){return b64(crypto.getRandomValues(new Uint8Array(12))).replace(/[^a-zA-Z0-9]/g,"").slice(0,10)+"aA1!"}
function uniqueCi(values){const seen=new Set();for(const v of values){const k=key(v);if(!k)continue;if(seen.has(k))return false;seen.add(k)}return true}
function required(row,fields,label,errors){for(const f of fields)if(!text(row?.[f]))errors.push(`${label}: ${f} is required.`)}
function roleRank(role){return role==="Super Admin"?3:role==="HOD"?2:1}
async function shaHex(v){const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v)));return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("")}
function constantTimeEqual(a,b){a=String(a||"");b=String(b||"");if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}

async function requirePlatformAdmin(req){
  const ctx=await authBranch(req);if(!ctx)return null;
  const{data,error}=await db.from("platform_admins").select("user_id,active").eq("user_id",ctx.user.id).eq("active",true).maybeSingle();
  if(error)throw error;if(!data)return false;return ctx
}

async function requireSelfRegistration(token){
  const supplied=text(token);if(!supplied)return null;
  const{data,error}=await db.from("app_settings").select("value").eq("key","branch_self_registration").maybeSingle();if(error)throw error;
  const cfg=data?.value||{};if(cfg.enabled!==true||!cfg.token_hash)return null;
  const actual=await shaHex(supplied);if(!constantTimeEqual(actual,String(cfg.token_hash).toLowerCase()))return null;
  if(Number(cfg.max_branches)>0){const{count,error:ce}=await db.from("branches").select("id",{count:"exact",head:true});if(ce)throw ce;if(Number(count||0)>=Number(cfg.max_branches))throw new Error("Branch registration limit reached. Contact the system owner.")}
  return cfg
}

function normalizeWorkbook(workbook){
  const errors=[],warnings=[];
  const branchRows=Array.isArray(workbook?.Branch)?workbook.Branch:[];
  const sections=Array.isArray(workbook?.Classes_Sections)?workbook.Classes_Sections:[];
  const teachers=Array.isArray(workbook?.Teachers)?workbook.Teachers:[];
  const subjects=Array.isArray(workbook?.Subjects)?workbook.Subjects:[];
  const mappings=Array.isArray(workbook?.Teaching_Mappings)?workbook.Teaching_Mappings:[];
  const hods=Array.isArray(workbook?.HODs)?workbook.HODs:[];
  if(branchRows.length!==1)errors.push("Branch sheet must contain exactly one data row.");
  if(sections.length>100)errors.push("A branch may contain at most 100 class/section rows in one onboarding workbook.");
  if(teachers.length>300)errors.push("A branch may contain at most 300 teacher rows in one onboarding workbook.");
  if(subjects.length>100)errors.push("A branch may contain at most 100 subject rows in one onboarding workbook.");
  if(mappings.length>2000)errors.push("A branch may contain at most 2,000 teaching mapping rows in one onboarding workbook.");
  if(hods.length>50)errors.push("A branch may contain at most 50 HOD rows in one onboarding workbook.");
  const br=branchRows[0]||{};
  required(br,["Branch Code","Branch Name","School Name","Location","Academic Year","Dean / Branch Super Admin Name","Dean Mobile Number / Login Username"],"Branch row 2",errors);
  sections.forEach((r,i)=>required(r,["Class Display Name","Internal Batch Code","Grade","Orientation / Programme","Active"],`Classes_Sections row ${i+2}`,errors));
  teachers.forEach((r,i)=>required(r,["Teacher Full Name","Designation","Department","Primary Subject","Mobile Number / Login Username","Active"],`Teachers row ${i+2}`,errors));
  subjects.forEach((r,i)=>required(r,["Subject Name","Department","Active for Syllabus Tracking"],`Subjects row ${i+2}`,errors));
  mappings.forEach((r,i)=>required(r,["Class Display Name","Internal Batch Code","Subject","Department","Teacher Full Name","Periods Per Week","Week Pattern","Class Teacher","Co-Class Teacher","Active for Syllabus Tracking"],`Teaching_Mappings row ${i+2}`,errors));
  hods.forEach((r,i)=>required(r,["HOD Name","Department","Mobile Number / Login Username"],`HODs row ${i+2}`,errors));
  if(!sections.length)errors.push("At least one class/section is required.");
  if(!teachers.length)errors.push("At least one teacher is required.");
  if(!subjects.length)errors.push("At least one subject is required.");
  if(!mappings.length)warnings.push("No teaching mappings were supplied. Teacher/HOD scopes will be limited until mappings are added.");

  const branchCode=text(br["Branch Code"]).toUpperCase();
  if(branchCode&&!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(branchCode))errors.push("Branch Code may use only letters, numbers, hyphen and underscore (2-40 characters).");
  if(!uniqueCi(sections.map(r=>r["Class Display Name"])))errors.push("Duplicate Class Display Name exists inside this branch.");
  if(!uniqueCi(sections.map(r=>r["Internal Batch Code"])))errors.push("Duplicate Internal Batch Code exists inside this branch.");
  if(!uniqueCi(teachers.map(r=>r["Teacher Full Name"])))errors.push("Duplicate Teacher Full Name exists inside this branch.");
  if(!uniqueCi(subjects.map(r=>r["Subject Name"])))errors.push("Duplicate Subject Name exists inside this branch.");

  const sectionByBatch=new Map(sections.map(r=>[key(r["Internal Batch Code"]),r]));
  const teacherByName=new Map(teachers.map(r=>[key(r["Teacher Full Name"]),r]));
  const subjectByName=new Map(subjects.map(r=>[key(r["Subject Name"]),r]));
  mappings.forEach((r,i)=>{
    const label=`Teaching_Mappings row ${i+2}`,sec=sectionByBatch.get(key(r["Internal Batch Code"])),sub=subjectByName.get(key(r["Subject"])),teacher=teacherByName.get(key(r["Teacher Full Name"]));
    if(!sec)errors.push(`${label}: Internal Batch Code does not exist in Classes_Sections.`);
    else if(key(sec["Class Display Name"])!==key(r["Class Display Name"]))errors.push(`${label}: Class Display Name does not match Internal Batch Code.`);
    if(!sub)errors.push(`${label}: Subject is not defined in Subjects.`);
    else if(key(sub["Department"])!==key(r["Department"]))errors.push(`${label}: Subject department does not match Subjects sheet.`);
    if(!teacher)errors.push(`${label}: Teacher does not exist in Teachers.`);
    const n=Number(r["Periods Per Week"]);if(!Number.isInteger(n)||n<0)errors.push(`${label}: Periods Per Week must be a non-negative whole number.`)
  });
  hods.forEach((r,i)=>{if(!subjects.some(s=>key(s["Department"])===key(r["Department"])))warnings.push(`HODs row ${i+2}: department has no subject in Subjects sheet.`)});

  const usernames=[text(br["Dean Mobile Number / Login Username"]),...teachers.map(r=>text(r["Mobile Number / Login Username"])),...hods.map(r=>text(r["Mobile Number / Login Username"]))].filter(Boolean);
  const nameByUsername=new Map();
  const addIdentity=(username,name)=>{const u=key(username);if(!u)return;if(!nameByUsername.has(u))nameByUsername.set(u,new Set());nameByUsername.get(u).add(key(name))};
  addIdentity(br["Dean Mobile Number / Login Username"],br["Dean / Branch Super Admin Name"]);teachers.forEach(r=>addIdentity(r["Mobile Number / Login Username"],r["Teacher Full Name"]));hods.forEach(r=>addIdentity(r["Mobile Number / Login Username"],r["HOD Name"]));
  for(const [u,names] of nameByUsername)if(names.size>1)errors.push(`Login username '${u}' is assigned to different people in this workbook.`);

  const normalized={
    branch:{branch_code:branchCode,branch_name:text(br["Branch Name"]),school_name:text(br["School Name"]),location:text(br["Location"]),academic_year:text(br["Academic Year"]),dean_name:text(br["Dean / Branch Super Admin Name"]),dean_username:text(br["Dean Mobile Number / Login Username"])},
    sections:sections.map(r=>({section:text(r["Class Display Name"]),internal_batch:text(r["Internal Batch Code"]),grade:Number(r["Grade"]),orientation:text(r["Orientation / Programme"]),floor:text(r["Floor (optional)"])||null,active:yes(r["Active"],true)})),
    teachers:teachers.map(r=>({name:text(r["Teacher Full Name"]),employee_code:text(r["Employee ID / Code (if available)"])||null,designation:text(r["Designation"]),department:text(r["Department"]),primary_subject:text(r["Primary Subject"]),username:text(r["Mobile Number / Login Username"]),active:yes(r["Active"],true)})),
    subjects:subjects.map(r=>({name:text(r["Subject Name"]),department:text(r["Department"]),active_for_syllabus:yes(r["Active for Syllabus Tracking"],true)})),
    mappings:mappings.map(r=>({section:text(r["Class Display Name"]),internal_batch:text(r["Internal Batch Code"]),subject:text(r["Subject"]),department:text(r["Department"]),teacher:text(r["Teacher Full Name"]),periods_per_week:Number(r["Periods Per Week"]),week_pattern:text(r["Week Pattern"])||"Every Week",class_teacher:yes(r["Class Teacher"],false)?"Yes":"No",co_class_teacher:yes(r["Co-Class Teacher"],false)?"Yes":"No",active_for_syllabus:yes(r["Active for Syllabus Tracking"],true)})),
    hods:hods.map(r=>({name:text(r["HOD Name"]),department:text(r["Department"]),username:text(r["Mobile Number / Login Username"]),employee_code:text(r["Employee ID / Code (if available)"])||null}))
  };
  for(const s of normalized.sections)if(!Number.isInteger(s.grade)||s.grade<1||s.grade>12)errors.push(`Invalid grade for ${s.section}.`);
  return{ok:errors.length===0,errors,warnings,normalized,summary:{sections:normalized.sections.length,teachers:normalized.teachers.length,subjects:normalized.subjects.length,mappings:normalized.mappings.length,hods:normalized.hods.length,user_logins:new Set(usernames.map(key)).size}}
}

async function cleanupBranch(branchId){
  const tables=["branch_settings","user_departments","user_sections","user_subjects","app_sessions","weekly_entry_requests","weekly_status","year_plan_assignments","year_plan_subjects","year_plan_weeks","safe_yearplan_recapture_state","year_plans","teaching_mappings","app_users","teachers","sections","subjects"];
  for(const table of tables){try{await db.from(table).delete().eq("branch_id",branchId)}catch(_){}}
  try{await db.from("branches").delete().eq("id",branchId).eq("active",false)}catch(_){}
}

async function createBranch(validated,createdBy){
  const v=validated.normalized;
  const{data:exists,error:xe}=await db.from("branches").select("id,branch_code").ilike("branch_code",v.branch.branch_code).maybeSingle();if(xe)throw xe;if(exists)throw new Error("Branch Code already exists.");
  const{data:branch,error:be}=await db.from("branches").insert({branch_code:v.branch.branch_code,branch_name:v.branch.branch_name,school_name:v.branch.school_name,location:v.branch.location,academic_year:v.branch.academic_year,active:false}).select().single();if(be)throw be;
  const branchId=branch.id;
  try{
    const{data:sections,error:se}=await db.from("sections").insert(v.sections.map(x=>({...x,branch_id:branchId}))).select();if(se)throw se;
    const{data:subjects,error:sue}=await db.from("subjects").insert(v.subjects.map(x=>({...x,branch_id:branchId}))).select();if(sue)throw sue;
    const teacherRows=v.teachers.map(x=>({name:x.name,full_name:x.name,employee_code:x.employee_code,designation:x.designation,source_department:x.department,syllabus_department:x.department,primary_subject:x.primary_subject,active:x.active,branch_id:branchId}));
    const{data:teachers,error:te}=await db.from("teachers").insert(teacherRows).select();if(te)throw te;
    const sectionByBatch=new Map((sections||[]).map(x=>[key(x.internal_batch),x])),subjectByName=new Map((subjects||[]).map(x=>[key(x.name),x])),teacherByName=new Map((teachers||[]).map(x=>[key(x.name),x]));
    const mappingRows=v.mappings.map(m=>({section_id:sectionByBatch.get(key(m.internal_batch))?.id,subject_id:subjectByName.get(key(m.subject))?.id,teacher_id:teacherByName.get(key(m.teacher))?.id||null,periods_per_week:m.periods_per_week,week_pattern:m.week_pattern,class_teacher:m.class_teacher,co_class_teacher:m.co_class_teacher,active_for_syllabus:m.active_for_syllabus,branch_id:branchId}));
    if(mappingRows.length){const{error:me}=await db.from("teaching_mappings").insert(mappingRows);if(me)throw me}

    const userSpecs=new Map();
    const upsertSpec=spec=>{const u=key(spec.username);if(!u)return;const old=userSpecs.get(u);if(!old||roleRank(spec.role)>roleRank(old.role))userSpecs.set(u,{...old,...spec});else if(spec.role==="HOD"&&old.role==="HOD")old.departments=[...new Set([...(old.departments||[]),...(spec.departments||[])])]};
    upsertSpec({name:v.branch.dean_name,username:v.branch.dean_username,role:"Super Admin",departments:v.subjects.map(s=>s.department)});
    for(const h of v.hods)upsertSpec({name:h.name,username:h.username,role:"HOD",departments:[h.department],employee_code:h.employee_code});
    for(const t of v.teachers)if(t.active)upsertSpec({name:t.name,username:t.username,role:"Teacher",departments:[t.department],employee_code:t.employee_code,designation:t.designation});

    const tempPasswords=[],createdUsers=[];
    for(const spec of userSpecs.values()){
      const teacher=teacherByName.get(key(spec.name)),password=randomPassword(),pw=await passwordRecord(password),primary=(spec.departments||[])[0]||teacher?.syllabus_department||null;
      const{data:u,error:ue}=await db.from("app_users").insert({teacher_id:teacher?.id||null,name:spec.name,username:spec.username,...pw,role:spec.role,primary_department:primary,access_enabled:true,must_change_password:true,employee_code:spec.employee_code||teacher?.employee_code||null,designation:spec.designation||teacher?.designation||null,branch_id:branchId}).select().single();if(ue)throw ue;
      createdUsers.push({...u,requested_departments:spec.departments||[]});tempPasswords.push({name:u.name,username:u.username,role:u.role,temporary_password:password})
    }

    const allSectionIds=(sections||[]).map(x=>x.id),allSubjectIds=(subjects||[]).filter(x=>x.active_for_syllabus!==false).map(x=>x.id),allDepartments=[...new Set((subjects||[]).map(x=>x.department).filter(Boolean))],mappingData=mappingRows;
    for(const u of createdUsers){
      let departments=[],sectionIds=[],subjectIds=[];
      if(u.role==="Super Admin"){departments=allDepartments;sectionIds=allSectionIds;subjectIds=allSubjectIds}
      else if(u.role==="HOD"){
        departments=[...new Set(u.requested_departments.filter(Boolean))];subjectIds=(subjects||[]).filter(s=>departments.includes(s.department)&&s.active_for_syllabus!==false).map(s=>s.id);const set=new Set(subjectIds);sectionIds=[...new Set(mappingData.filter(m=>set.has(m.subject_id)&&m.active_for_syllabus).map(m=>m.section_id))]
      }else if(u.teacher_id){
        const own=mappingData.filter(m=>m.teacher_id===u.teacher_id&&m.active_for_syllabus);sectionIds=[...new Set(own.map(m=>m.section_id))];subjectIds=[...new Set(own.map(m=>m.subject_id))];departments=[...new Set((subjects||[]).filter(s=>subjectIds.includes(s.id)).map(s=>s.department).filter(Boolean))]
      }
      if(departments.length){const{error}=await db.from("user_departments").insert(departments.map(department=>({user_id:u.id,department,branch_id:branchId})));if(error)throw error}
      if(sectionIds.length){const{error}=await db.from("user_sections").insert(sectionIds.map(section_id=>({user_id:u.id,section_id,branch_id:branchId})));if(error)throw error}
      if(subjectIds.length){const{error}=await db.from("user_subjects").insert(subjectIds.map(subject_id=>({user_id:u.id,subject_id,branch_id:branchId})));if(error)throw error}
    }
    const dean=createdUsers.find(u=>u.role==="Super Admin");
    const{error:bse}=await db.from("branch_settings").insert({branch_id:branchId,key:"weekly_entry",value:{open:false},updated_by:dean?.id||null});if(bse)throw bse;
    const{error:ae}=await db.from("branches").update({active:true,updated_at:new Date().toISOString()}).eq("id",branchId).eq("active",false);if(ae)throw ae;
    return{branch:{...branch,active:true},summary:{sections:sections?.length||0,subjects:subjects?.length||0,teachers:teachers?.length||0,mappings:mappingRows.length,users:createdUsers.length},temporary_passwords:tempPasswords,weekly_entry_open:false,created_by:createdBy||"self-service"}
  }catch(e){await cleanupBranch(branchId);throw e}
}

async function listBranches(){const{data,error}=await db.from("branches").select("id,branch_code,branch_name,school_name,location,academic_year,active,created_at").order("created_at");if(error)throw error;return data||[]}
async function checkDuplicateBranch(v){if(!v.ok)return v;const{data:exists,error}=await db.from("branches").select("id").ilike("branch_code",v.normalized.branch.branch_code).maybeSingle();if(error)throw error;if(exists){v.ok=false;v.errors.push("Branch Code already exists.")}return v}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return res({error:"Method not allowed"},405);
  try{
    const body=await req.json().catch(()=>({})),action=text(body.action)||"status";

    if(["self_status","self_validate","self_create"].includes(action)){
      const cfg=await requireSelfRegistration(body.registration_token);if(!cfg)return res({error:"This branch setup link is invalid or has been disabled."},403);
      if(action==="self_status")return res({ok:true,self_service:true,enabled:true});
      const v=await checkDuplicateBranch(normalizeWorkbook(body.workbook||{}));
      if(action==="self_validate")return res(v,v.ok?200:400);
      if(!v.ok)return res(v,400);
      const created=await createBranch(v,null);return res({ok:true,self_service:true,...created})
    }

    const ctx=await requirePlatformAdmin(req);if(ctx===null)return res({error:"Session expired or invalid"},401);if(ctx===false)return res({error:"Platform Admin access required"},403);
    if(action==="status")return res({platform_admin:true,branches:await listBranches()});
    if(action==="validate"){const v=await checkDuplicateBranch(normalizeWorkbook(body.workbook||{}));return res(v,v.ok?200:400)}
    if(action==="create"){const v=await checkDuplicateBranch(normalizeWorkbook(body.workbook||{}));if(!v.ok)return res(v,400);const created=await createBranch(v,ctx.user.id);return res({ok:true,...created})}
    return res({error:"Unknown action"},400)
  }catch(e){console.error(e);return res({error:e?.message||String(e)},400)}
});