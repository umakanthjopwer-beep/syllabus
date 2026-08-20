// Branch-aware Objective Exam syllabus coverage API.
// Separate from Weekly Status so objective-exam tracking cannot modify normal lagging records.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json"
};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const ADMIN=new Set(["Super Admin","Admin"]);
const READ_ALL=new Set(["Super Admin","Admin","Principal"]);
const enc=new TextEncoder();

function res(v:any,status=200){return new Response(JSON.stringify(v),{status,headers:cors})}
function clean(v:any){return String(v??"").trim()}
function uniq(a:any[]){return[...new Set((a||[]).filter(Boolean))]}
function safeName(v:string){return clean(v||"objective-exam").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,160)||"objective-exam"}
function unb64(v:string){const s=atob(v),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
async function sha(v:string){const b=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v)));let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s)}

async function authBranch(req:Request){
  const h=req.headers.get("authorization")||"",raw=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";
  if(!raw)return null;
  const tokenHash=await sha(raw),now=new Date().toISOString();
  const{data:s}=await db.from("app_sessions").select("id,user_id,branch_id,expires_at").eq("token_hash",tokenHash).gt("expires_at",now).maybeSingle();
  if(!s?.branch_id)return null;
  const{data:u}=await db.from("app_users").select("*").eq("id",s.user_id).eq("branch_id",s.branch_id).eq("access_enabled",true).maybeSingle();
  if(!u)return null;
  const{data:b}=await db.from("branches").select("id,branch_code,branch_name,school_name,location,academic_year,active").eq("id",s.branch_id).eq("active",true).maybeSingle();
  if(!b)return null;
  await db.from("app_sessions").update({last_seen_at:now}).eq("id",s.id).eq("branch_id",s.branch_id);
  return{session:s,user:u,branch:b,branchId:String(s.branch_id)};
}

async function owned(table:string,id:string,branchId:string,label:string){
  const{data,error}=await db.from(table).select("id,branch_id").eq("id",id).eq("branch_id",branchId).maybeSingle();
  if(error)throw error;if(!data)throw new Error(`${label} is outside this branch.`);return data
}
async function ownedMany(table:string,ids:string[],branchId:string,label:string){
  const u=uniq(ids);if(!u.length)return[];
  const{data,error}=await db.from(table).select("id").eq("branch_id",branchId).in("id",u);if(error)throw error;
  if((data||[]).length!==u.length)throw new Error(`${label} contains records outside this branch.`);return u
}
async function hodDepartments(user:any,branchId:string){
  if(user.role!=="HOD")return[];
  const{data,error}=await db.from("user_departments").select("department").eq("branch_id",branchId).eq("user_id",user.id);if(error)throw error;
  return uniq((data||[]).map((x:any)=>x.department))
}
async function subjectDepartment(subjectId:string,branchId:string){
  const{data,error}=await db.from("subjects").select("department").eq("branch_id",branchId).eq("id",subjectId).maybeSingle();if(error)throw error;if(!data)throw new Error("Subject not found in this branch.");return clean(data.department)
}
async function canManageSubject(user:any,subjectId:string,branchId:string){
  if(ADMIN.has(user.role))return true;
  if(user.role!=="HOD")return false;
  const dept=await subjectDepartment(subjectId,branchId),allowed=await hodDepartments(user,branchId);return allowed.includes(dept)
}
async function requireManageSubject(user:any,subjectId:string,branchId:string){if(!await canManageSubject(user,subjectId,branchId))throw new Error("This subject is outside your Objective Exam management scope.")}

async function loadBranchData(branchId:string){
  const [e,s,y,t,secs,subs,teachers]=await Promise.all([
    db.from("objective_exams").select("*").eq("branch_id",branchId).order("exam_date",{ascending:true}),
    db.from("objective_exam_syllabi").select("*").eq("branch_id",branchId).order("created_at",{ascending:true}),
    db.from("objective_exam_scopes").select("*").eq("branch_id",branchId),
    db.from("objective_exam_topics").select("*").eq("branch_id",branchId).order("sequence_no",{ascending:true}),
    db.from("sections").select("id,section,internal_batch,grade,orientation,active").eq("branch_id",branchId),
    db.from("subjects").select("id,name,department,active_for_syllabus").eq("branch_id",branchId),
    db.from("teachers").select("id,name,full_name,designation,syllabus_department,primary_subject,active").eq("branch_id",branchId)
  ]);
  for(const q of [e,s,y,t,secs,subs,teachers])if(q.error)throw q.error;
  return{exams:e.data||[],syllabi:s.data||[],scopes:y.data||[],topics:t.data||[],sections:secs.data||[],subjects:subs.data||[],teachers:teachers.data||[]}
}

async function scopedBootstrap(user:any,branch:any,branchId:string){
  const all=await loadBranchData(branchId);
  let syllabusIds:string[]=[];
  if(READ_ALL.has(user.role))syllabusIds=all.syllabi.map((x:any)=>x.id);
  else if(user.role==="HOD"){
    const deps=await hodDepartments(user,branchId),subIds=new Set(all.subjects.filter((x:any)=>deps.includes(x.department)).map((x:any)=>x.id));
    syllabusIds=all.syllabi.filter((x:any)=>subIds.has(x.subject_id)).map((x:any)=>x.id)
  }else if(user.role==="Teacher"){
    if(user.teacher_id){const ids=new Set(all.scopes.filter((x:any)=>x.teacher_id===user.teacher_id).map((x:any)=>x.syllabus_id));syllabusIds=[...ids]}
  }
  const sid=new Set(syllabusIds),scopes=all.scopes.filter((x:any)=>sid.has(x.syllabus_id)),scopeIds=new Set(scopes.map((x:any)=>x.id)),syllabi=all.syllabi.filter((x:any)=>sid.has(x.id)),visibleExamIds=new Set(syllabi.map((x:any)=>x.exam_id)),exams=(READ_ALL.has(user.role)||user.role==="HOD")?all.exams:all.exams.filter((x:any)=>visibleExamIds.has(x.id)),topics=all.topics.filter((x:any)=>scopeIds.has(x.scope_id));
  return{
    branch:{id:branch.id,branch_code:branch.branch_code,branch_name:branch.branch_name,school_name:branch.school_name,academic_year:branch.academic_year},
    role:user.role,teacher_id:user.teacher_id||null,
    can_manage:ADMIN.has(user.role)||user.role==="HOD",
    exams,syllabi,scopes,topics,sections:all.sections,subjects:all.subjects,teachers:all.teachers
  }
}

async function saveExam(user:any,x:any,branchId:string){
  if(!ADMIN.has(user.role)&&user.role!=="HOD")throw new Error("Only Admin/Super Admin/HOD can create Objective Exams.");
  const name=clean(x.exam_name),date=clean(x.exam_date);if(!name)throw new Error("Exam Name is required.");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Exam Date is required.");
  if(x.id){
    const{data:old,error:oe}=await db.from("objective_exams").select("id,created_by").eq("branch_id",branchId).eq("id",x.id).maybeSingle();if(oe)throw oe;if(!old)throw new Error("Objective Exam was not found in this branch.");
    if(user.role==="HOD"&&old.created_by!==user.id)throw new Error("HOD users can edit only Objective Exams they created. You can still add your department syllabus to this exam.");
    const{data,error}=await db.from("objective_exams").update({exam_name:name,exam_code:clean(x.exam_code)||null,exam_date:date,notes:clean(x.notes)||null,status:["draft","published","closed"].includes(x.status)?x.status:"published",updated_at:new Date().toISOString()}).eq("branch_id",branchId).eq("id",x.id).select().single();if(error)throw error;return data
  }
  const{data,error}=await db.from("objective_exams").insert({branch_id:branchId,exam_name:name,exam_code:clean(x.exam_code)||null,exam_date:date,notes:clean(x.notes)||null,status:"published",created_by:user.id}).select().single();if(error)throw error;return data
}

async function saveSyllabus(user:any,x:any,branchId:string){
  const examId=clean(x.exam_id),subjectId=clean(x.subject_id),sectionIds=await ownedMany("sections",x.section_ids||[],branchId,"Sections"),topics=uniq((x.topics||[]).map((v:any)=>clean(v)).filter(Boolean));
  if(!examId)throw new Error("Select an Objective Exam.");await owned("objective_exams",examId,branchId,"Objective Exam");
  if(!subjectId)throw new Error("Select a Subject.");await owned("subjects",subjectId,branchId,"Subject");await requireManageSubject(user,subjectId,branchId);
  if(!sectionIds.length)throw new Error("Select at least one Grade/Section.");if(!topics.length)throw new Error("Enter at least one exam syllabus topic.");if(topics.length>150)throw new Error("Maximum 150 syllabus topics per upload.");
  let storagePath:string|null=null,fileName=clean(x.file_name)||null;
  if(x.file_base64){
    const size=Number(x.file_size||0);if(size>5*1024*1024)throw new Error("Exam syllabus file must be 5 MB or smaller.");
    storagePath=`${branchId}/objective-exams/${Date.now()}-${safeName(fileName||"exam-syllabus")}`;
    const{error}=await db.storage.from("year-plans").upload(storagePath,unb64(x.file_base64),{contentType:clean(x.file_type)||"application/octet-stream",upsert:false});if(error)throw error
  }
  const now=new Date().toISOString();
  const{data:syllabus,error:syErr}=await db.from("objective_exam_syllabi").insert({branch_id:branchId,exam_id:examId,subject_id:subjectId,file_name:fileName,storage_path:storagePath,file_type:clean(x.file_type)||null,file_size:x.file_size==null?null:Number(x.file_size),syllabus_label:clean(x.syllabus_label)||null,created_by:user.id,updated_at:now}).select().single();
  if(syErr){if(storagePath)await db.storage.from("year-plans").remove([storagePath]);throw syErr}
  try{
    const{data:maps,error:mErr}=await db.from("teaching_mappings").select("section_id,teacher_id").eq("branch_id",branchId).eq("subject_id",subjectId).eq("active_for_syllabus",true).in("section_id",sectionIds);if(mErr)throw mErr;
    const bySection=new Map<string,string|null>();for(const m of maps||[])if(!bySection.has(m.section_id))bySection.set(m.section_id,m.teacher_id||null);
    const scopeRows=sectionIds.map(section_id=>({branch_id:branchId,syllabus_id:syllabus.id,section_id,teacher_id:bySection.get(section_id)||null}));
    const{data:scopes,error:scErr}=await db.from("objective_exam_scopes").insert(scopeRows).select();if(scErr)throw scErr;
    const topicRows:any[]=[];for(const scope of scopes||[])topics.forEach((topic_text:string,i:number)=>topicRows.push({branch_id:branchId,scope_id:scope.id,sequence_no:i+1,topic_text,coverage_status:"Not Started"}));
    const{error:tErr}=await db.from("objective_exam_topics").insert(topicRows);if(tErr)throw tErr;
    return{syllabus,scope_count:(scopes||[]).length,topic_count:topicRows.length,unmapped_sections:(scopes||[]).filter((s:any)=>!s.teacher_id).map((s:any)=>s.section_id)}
  }catch(e){await db.from("objective_exam_syllabi").delete().eq("branch_id",branchId).eq("id",syllabus.id);if(storagePath)await db.storage.from("year-plans").remove([storagePath]);throw e}
}

async function topicContext(topicId:string,branchId:string){
  const{data:topic,error}=await db.from("objective_exam_topics").select("id,scope_id,coverage_status,topic_text").eq("branch_id",branchId).eq("id",topicId).maybeSingle();if(error)throw error;if(!topic)throw new Error("Objective Exam topic not found in this branch.");
  const{data:scope,error:se}=await db.from("objective_exam_scopes").select("id,syllabus_id,section_id,teacher_id").eq("branch_id",branchId).eq("id",topic.scope_id).maybeSingle();if(se)throw se;if(!scope)throw new Error("Objective Exam scope not found.");
  const{data:syllabus,error:ye}=await db.from("objective_exam_syllabi").select("id,exam_id,subject_id").eq("branch_id",branchId).eq("id",scope.syllabus_id).maybeSingle();if(ye)throw ye;if(!syllabus)throw new Error("Objective Exam syllabus not found.");
  return{topic,scope,syllabus}
}
async function canUpdateTopic(user:any,ctx:any,branchId:string){
  if(ADMIN.has(user.role))return true;
  if(user.role==="Teacher")return!!user.teacher_id&&ctx.scope.teacher_id===user.teacher_id;
  if(user.role==="HOD")return await canManageSubject(user,ctx.syllabus.subject_id,branchId);
  return false
}
async function updateTopic(user:any,x:any,branchId:string){
  const id=clean(x.topic_id),status=clean(x.coverage_status);if(!id)throw new Error("Topic is required.");if(!["Not Started","In Progress","Completed"].includes(status))throw new Error("Invalid coverage status.");
  const ctx=await topicContext(id,branchId);if(!await canUpdateTopic(user,ctx,branchId))throw new Error("This exam topic is outside your assigned scope.");
  const{data,error}=await db.from("objective_exam_topics").update({coverage_status:status,teacher_note:clean(x.teacher_note)||null,updated_by:user.id,updated_at:new Date().toISOString()}).eq("branch_id",branchId).eq("id",id).select().single();if(error)throw error;return data
}

async function deleteSyllabus(user:any,x:any,branchId:string){
  const id=clean(x.syllabus_id);if(!id)throw new Error("Syllabus is required.");
  const{data:s,error}=await db.from("objective_exam_syllabi").select("id,subject_id,storage_path").eq("branch_id",branchId).eq("id",id).maybeSingle();if(error)throw error;if(!s)throw new Error("Objective Exam syllabus not found.");await requireManageSubject(user,s.subject_id,branchId);
  const{error:de}=await db.from("objective_exam_syllabi").delete().eq("branch_id",branchId).eq("id",id);if(de)throw de;if(s.storage_path)await db.storage.from("year-plans").remove([s.storage_path]);return{deleted:true}
}
async function deleteExam(user:any,x:any,branchId:string){
  if(!ADMIN.has(user.role))throw new Error("Only Admin/Super Admin can delete an Objective Exam.");const id=clean(x.exam_id);await owned("objective_exams",id,branchId,"Objective Exam");
  const{data:files}=await db.from("objective_exam_syllabi").select("storage_path").eq("branch_id",branchId).eq("exam_id",id);const paths=(files||[]).map((f:any)=>f.storage_path).filter(Boolean);
  const{error}=await db.from("objective_exams").delete().eq("branch_id",branchId).eq("id",id);if(error)throw error;if(paths.length)await db.storage.from("year-plans").remove(paths);return{deleted:true}
}
async function fileUrl(user:any,x:any,branchId:string){
  const id=clean(x.syllabus_id),all=await scopedBootstrap(user,{id:branchId},branchId);if(!all.syllabi.some((s:any)=>s.id===id))throw new Error("This syllabus file is outside your scope.");
  const s=all.syllabi.find((z:any)=>z.id===id);if(!s?.storage_path)throw new Error("No original file is stored for this syllabus.");const{data,error}=await db.storage.from("year-plans").createSignedUrl(s.storage_path,900);if(error)throw error;return{url:data.signedUrl,file_name:s.file_name}
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const a=await authBranch(req);if(!a)return res({error:"Session expired or invalid"},401);
    const x=await req.json().catch(()=>({})),action=clean(x.action)||"bootstrap";
    if(action==="bootstrap"||action==="list")return res(await scopedBootstrap(a.user,a.branch,a.branchId));
    if(action==="save_exam")return res({exam:await saveExam(a.user,x,a.branchId)});
    if(action==="save_syllabus")return res(await saveSyllabus(a.user,x,a.branchId));
    if(action==="update_topic")return res({topic:await updateTopic(a.user,x,a.branchId)});
    if(action==="delete_syllabus")return res(await deleteSyllabus(a.user,x,a.branchId));
    if(action==="delete_exam")return res(await deleteExam(a.user,x,a.branchId));
    if(action==="file_url")return res(await fileUrl(a.user,x,a.branchId));
    return res({error:"Unknown action"},400)
  }catch(e){console.error(e);return res({error:e?.message||String(e)},400)}
});
