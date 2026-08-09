function restoreSession(){
  const username=sessionStorage.getItem("khalsa_tracker_user");if(!username)return;
  const user=data.users.find(x=>same(x.username,username)&&x.accessEnabled!==false);if(user){currentUser=user;openApp()}
}
function login(){
  const username=norm($("#loginUsername").value),password=$("#loginPassword").value;
  if(!username||!password){showLoginError("Enter both username and password.");return}
  const user=data.users.find(x=>same(x.username,username));
  if(!user||user.accessEnabled===false){showLoginError("Access is not active. Contact the school Admin.");return}
  if(String(user.password||"")!==password){showLoginError("Incorrect username or password.");return}
  currentUser=user;sessionStorage.setItem("khalsa_tracker_user",user.username);openApp()
}
function showLoginError(msg){const e=$("#loginError");e.textContent=msg;e.classList.remove("hidden")}
function openApp(){
  $("#loginError").classList.add("hidden");$("#loginScreen").classList.add("hidden");$("#appShell").classList.remove("hidden");
  $("#profileName").textContent=currentUser.name;$("#profileRole").textContent=currentUser.role;
  applyRoleAccess();renderAll()
}
function logout(){sessionStorage.removeItem("khalsa_tracker_user");currentUser=null;$("#appShell").classList.add("hidden");$("#loginScreen").classList.remove("hidden");$("#loginPassword").value=""}
function isAdmin(){return currentUser&&ADMIN_ROLES.has(currentUser.role)}
function userDepartments(){return currentUser?.departments?.length?currentUser.departments:(currentUser?.department?[currentUser.department]:[])}
function teacherMappingsFor(name){return data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&same(m.teacher,name))}
function currentScope(){
  if(!currentUser||isAdmin())return{departments:DEPARTMENT_ORDER,sections:SECTIONS.map(x=>x.section),subjects:ALL_SUBJECTS};
  if(currentUser.role==="HOD"){
    const depts=userDepartments();
    const maps=data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&depts.includes(m.department));
    return{departments:depts,sections:[...new Set(maps.map(m=>m.section))],subjects:[...new Set(maps.map(m=>m.subject))]};
  }
  const maps=teacherMappingsFor(currentUser.name);
  const sections=currentUser.sections?.length?currentUser.sections:[...new Set(maps.map(m=>m.section))];
  const subjects=currentUser.subjects?.length?currentUser.subjects:[...new Set(maps.map(m=>m.subject))];
  return{departments:[...new Set(maps.map(m=>m.department).filter(Boolean))],sections,subjects};
}
function applyRoleAccess(){
  const role=currentUser?.role||"";
  const allowed=isAdmin()?["dashboard","yearplans","weekly","reports","users","setup"]:
    role==="HOD"?["dashboard","department","weekly","reports"]:
    role==="Teacher"?["dashboard","weekly","reports"]:["dashboard"];
  $$(".nav-btn,.mobile-nav button").forEach(b=>b.classList.toggle("hidden",!allowed.includes(b.dataset.view)));
  $("#departmentNav")?.classList.toggle("hidden",!allowed.includes("department"));$("#departmentMobileNav")?.classList.toggle("hidden",!allowed.includes("department"));
  if(!allowed.includes(document.querySelector(".view.active")?.id))showView("dashboard");
  $("#addUserBtn")?.classList.toggle("hidden",!isAdmin());
}
function showView(id){
  const allowed=isAdmin()?["dashboard","yearplans","weekly","reports","users","setup"]:
    currentUser?.role==="HOD"?["dashboard","department","weekly","reports"]:
    currentUser?.role==="Teacher"?["dashboard","weekly","reports"]:["dashboard"];
  if(!allowed.includes(id))id="dashboard";
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".nav-btn,.mobile-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="department")renderDepartment();if(id==="users")renderUsers();if(id==="setup")renderSetup();if(id==="reports")renderReports()
}
function visiblePlans(){
  if(!currentUser||isAdmin())return data.plans;
  const sc=currentScope();
  return data.plans.filter(p=>p.enabled!==false&&sc.subjects.includes(p.subject)&&p.assignedSections.some(s=>sc.sections.includes(s)))
}
function visibleWeekly(){
  if(!currentUser||isAdmin())return data.weekly;
  const sc=currentScope();
  return data.weekly.filter(w=>sc.sections.includes(w.section)&&sc.subjects.includes(w.subject)&&(currentUser.role!=="Teacher"||same(w.teacher,currentUser.name)||teacherMappingsFor(currentUser.name).some(m=>m.section===w.section&&m.subject===w.subject)))
}
function visibleSections(){
  if(!currentUser||isAdmin())return SECTIONS;
  const allowed=new Set(currentScope().sections);return SECTIONS.filter(x=>allowed.has(x.section))
}

function updateYearPlanSubjects(){fillSelect($("#ypSubject"),DEPARTMENTS[$("#ypDepartment").value]||[],$("#ypSubject")?.value||"")}
function updateWeeklySubjects(){
  const section=$("#wkSection").value;
  const sc=currentScope();
  const mappingSubjects=[...new Set(data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&m.section===section&&(isAdmin()||sc.subjects.includes(m.subject))).map(m=>m.subject))];
  const planned=[...new Set(visiblePlans().filter(p=>p.assignedSections.includes(section)).map(p=>p.subject))];
  const list=[...new Set([...planned,...mappingSubjects])];
  fillSelect($("#wkSubject"),list.length?list:(isAdmin()?ALL_SUBJECTS:sc.subjects),$("#wkSubject")?.value||list[0])
}
function autoLag(){const planned=Number($("#wkPlannedPeriods").value||0),taken=Number($("#wkTakenPeriods").value||0);$("#wkLagPeriods").value=Math.max(0,planned-taken)}

async function savePlan(){
  if(!isAdmin()){setStatus("#planStatus","Only Admin roles can upload Year Plans.",true);return}
  const file=$("#ypFile").files[0];if(!file){setStatus("#planStatus","Select a Year Plan file first.",true);return}
  const section=$("#ypSection").value,program=$("#ypProgram").value,department=$("#ypDepartment").value,subject=canonicalSubject($("#ypSubject").value),teacher=norm($("#ypTeacher").value);
  let parsed={preview:"",weeks:[]};try{parsed=await parsePlanFile(file)}catch(e){parsed.preview=`Could not parse preview: ${e.message||e}`}
  const duplicate=data.plans.find(p=>p.enabled!==false&&same(p.fileName,file.name)&&same(p.subject,subject));
  if(duplicate){
    if(!duplicate.assignedSections.includes(section))duplicate.assignedSections.push(section);
    duplicate.updatedAt=new Date().toISOString();persist();$("#ypFile").value="";setStatus("#planStatus",`Existing plan found. ${section} was added to its assignments.`);renderAll();return
  }
  const record={id:uid(),section,assignedSections:[section],program,programs:[program],department,subject,teacher,fileName:file.name,fileType:file.type||file.name.split(".").pop(),size:file.size,enabled:true,uploadedAt:new Date().toISOString(),preview:parsed.preview,weeks:parsed.weeks};
  data.plans.unshift(record);sessionFiles[record.id]=URL.createObjectURL(file);persist();$("#ypFile").value="";
  setStatus("#planStatus",`Uploaded ${file.name}. ${record.weeks.length?record.weeks.length+" week rows detected.":"File indexed."} Use Edit to assign more classes.`);renderAll()
}
async function parsePlanFile(file){
  const ext=file.name.split(".").pop().toLowerCase();
  if(["xlsx","xls","csv"].includes(ext)&&window.XLSX){
    const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:"array",cellDates:true});let preview="",weekRows=[];
    for(const sheetName of wb.SheetNames.slice(0,6)){const ws=wb.Sheets[sheetName];const rows=XLSX.utils.sheet_to_json(ws,{defval:"",raw:false});preview+=`[${sheetName}]\n`+XLSX.utils.sheet_to_csv(ws).slice(0,2200)+"\n";weekRows.push(...extractWeekRows(rows))}
    return{preview:preview.slice(0,9000),weeks:dedupeWeeks(weekRows)}
  }
  if(ext==="pdf")return{preview:"PDF Year Plan attached. File assignment is preserved; central PDF extraction/storage will be connected in the production backend.",weeks:[]};
  return{preview:"File attached.",weeks:[]}
}
function normKey(k){return String(k||"").toLowerCase().replace(/[^a-z0-9]+/g," ")}
function pick(row,tests){for(const [k,v] of Object.entries(row)){const n=normKey(k);if(tests.some(t=>n.includes(t)))return v}return""}
function extractWeekRows(rows){
  const out=[];
  for(const row of rows){
    const weekRaw=pick(row,["week no","week number","week"]);const topic=pick(row,["topic","chapter","syllabus","content","activity"]);
    const start=pick(row,["start date","from date"]);const end=pick(row,["end date","to date"]);const days=pick(row,["working days","no of days"]);const periods=pick(row,["planned periods","periods","no of periods"]);
    if(!weekRaw&&!topic)continue;const m=String(weekRaw).match(/(\d{1,2})/);if(!m)continue;
    out.push({week:`Week ${Number(m[1])}`,startDate:String(start||""),endDate:String(end||""),workingDays:Number(String(days).match(/\d+/)?.[0]||0),plannedPeriods:Number(String(periods).match(/\d+/)?.[0]||0),topic:String(topic||"").trim()})
  }return out
}
function dedupeWeeks(rows){const map=new Map();rows.forEach(r=>{const key=r.week+"|"+r.topic;if(!map.has(key))map.set(key,r)});return[...map.values()]}

function renderPlans(){
  const q=($("#planSearch")?.value||"").toLowerCase();const rows=visiblePlans().filter(p=>[p.assignedSections.join(" "),p.program,p.department,p.subject,p.teacher,p.fileName].join(" ").toLowerCase().includes(q));
  $("#planCards").innerHTML=rows.length?rows.map(p=>`<article class="plan-card ${p.enabled===false?"disabled":""}"><div><strong>${esc(p.fileName)}</strong><div class="sub">${esc(p.subject)} · ${esc(p.department)}${p.teacher?" · "+esc(p.teacher):""}</div><div class="plan-meta"><span class="chip">${esc(p.assignedSections.join(", "))}</span><span class="chip">${(p.weeks||[]).length} weekly rows</span><span class="chip">${p.enabled===false?"Disabled":"Active"}</span></div></div><div class="plan-actions"><button onclick="viewPlan('${p.id}')">View</button><button onclick="downloadPlan('${p.id}')">Download</button>${isAdmin()?`<button onclick="editPlan('${p.id}')">Edit</button><button onclick="togglePlan('${p.id}')">${p.enabled===false?"Enable":"Disable"}</button><button class="danger" onclick="deletePlan('${p.id}')">Delete</button>`:""}</div></article>`).join(""):'<div class="bulk-message">No Year Plans available for this view.</div>'
}
window.viewPlan=id=>{const p=data.plans.find(x=>x.id===id);if(!p)return;if(sessionFiles[id]){window.open(sessionFiles[id],"_blank");return}alert(`${p.fileName}\n\nAssigned: ${p.assignedSections.join(", ")}\n\n${p.preview||"The Year Plan index is preserved. Original file bytes require the central file-storage migration."}`)};
window.downloadPlan=id=>{const p=data.plans.find(x=>x.id===id);if(!p)return;if(sessionFiles[id]){const a=document.createElement("a");a.href=sessionFiles[id];a.download=p.fileName;a.click()}else alert("The original file is not in this browser session yet. Its assignment/index is preserved and will be linked when central file storage is migrated.")};
window.editPlan=id=>{
  if(!isAdmin())return;const p=data.plans.find(x=>x.id===id);if(!p)return;editingPlanId=id;
  fillSelect($("#editPlanDepartment"),DEPARTMENT_ORDER,p.department);fillSelect($("#editPlanSubject"),DEPARTMENTS[p.department]||[],p.subject);$("#editPlanTeacher").value=p.teacher||"";
  $("#editPlanSections").innerHTML=SECTIONS.map(s=>{const checked=p.assignedSections.includes(s.section);return`<label class="choice-card ${checked?"selected":""}"><input type="checkbox" value="${s.section}" ${checked?"checked":""}><div><strong>${s.section}</strong><small>${esc(s.batch)} · ${esc(s.program)}</small></div>${checked?'<span class="tick">✓</span>':""}</label>`}).join("");
  $$('#editPlanSections input').forEach(i=>i.onchange=()=>i.closest(".choice-card").classList.toggle("selected",i.checked));$("#editPlanStatus").textContent="";$("#planEditDialog").showModal()
};
function savePlanEdit(e){
  e.preventDefault();if(!editingPlanId)return;const p=data.plans.find(x=>x.id===editingPlanId);if(!p)return;
  const assigned=$$('#editPlanSections input:checked').map(i=>i.value);if(!assigned.length){setStatus("#editPlanStatus","Select at least one class/section.",true);return}
  p.assignedSections=assigned;p.section=assigned[0];p.programs=[...new Set(assigned.map(s=>sectionMeta(s).program))];p.program=p.programs[0]||p.program;p.department=$("#editPlanDepartment").value;p.subject=canonicalSubject($("#editPlanSubject").value);p.teacher=norm($("#editPlanTeacher").value);p.updatedAt=new Date().toISOString();
  persist();$("#planEditDialog").close();editingPlanId=null;renderAll()
}
window.togglePlan=id=>{if(!isAdmin())return;const p=data.plans.find(x=>x.id===id);if(!p)return;p.enabled=p.enabled===false;persist();renderAll()};
window.deletePlan=id=>{if(!isAdmin())return;const p=data.plans.find(x=>x.id===id);if(!p)return;if(!confirm(`Delete Year Plan index for ${p.fileName}? Historical weekly reports will remain.`))return;data.plans=data.plans.filter(x=>x.id!==id);if(sessionFiles[id])URL.revokeObjectURL(sessionFiles[id]);delete sessionFiles[id];persist();renderAll()};
function exportPlanIndex(){const rows=[["File","Department","Subject","Assigned Sections","Teacher","Active","Uploaded"],...visiblePlans().map(p=>[p.fileName,p.department,p.subject,p.assignedSections.join(" | "),p.teacher,p.enabled!==false,p.uploadedAt])];downloadBlob(toCsv(rows),"khalsa-year-plan-index.csv","text/csv")}
