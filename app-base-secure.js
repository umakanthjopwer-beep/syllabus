const _LS=LEGACY_SEED_ENC.strings;
const LEGACY_SEED={
  sourceCounts:LEGACY_SEED_ENC.sourceCounts,
  classes:LEGACY_SEED_ENC.classes.map(r=>[_LS[r[0]],_LS[r[1]],r[2],_LS[r[3]],_LS[r[4]]]),
  teachers:LEGACY_SEED_ENC.teachers.map(r=>[_LS[r[0]],_LS[r[1]]||null,_LS[r[2]],_LS[r[3]]]),
  mappings:LEGACY_SEED_ENC.mappings.map(r=>[_LS[r[0]],_LS[r[1]],_LS[r[2]],r[3],_LS[r[4]],_LS[r[5]]||null,_LS[r[6]],_LS[r[7]],_LS[r[8]]])
};

const DEPARTMENTS={
  Telugu:["SL Telugu","TL Telugu","Telugu Practice"],
  Hindi:["SL Hindi","TL Hindi"],
  English:["English","English Practice"],
  Mathematics:["Track A","Track B","Reasoning","Arithmetic","Vedic Maths"],
  Physics:["Physics","Physics Practice"],
  Chemistry:["Chemistry","Chemistry Practice"],
  Biology:["Biology","Biology Practice"],
  Social:["GK & CA","Social","Social Practice"],
  IT:["IT","Wizklub / Library"]
};
const DEPARTMENT_ORDER=["Telugu","Hindi","English","Mathematics","Physics","Chemistry","Biology","Social","IT"];
const ALL_SUBJECTS=[...new Set(DEPARTMENT_ORDER.flatMap(d=>DEPARTMENTS[d]))];
const ADMIN_ROLES=new Set(["Super Admin","Principal","Admin"]);
const STORE_KEY="khalsa_syllabus_tracker_ui_v8";
const APP_SCHEMA=8;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=(v="")=>String(v??"").replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[m]));
const uid=()=>globalThis.crypto?.randomUUID?.()||("id-"+Date.now()+"-"+Math.random().toString(16).slice(2));
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=s=>String(s??"").trim();
const same=(a,b)=>norm(a).toLowerCase()===norm(b).toLowerCase();

const SECTIONS=LEGACY_SEED.classes.map(([section,batch,grade,program,floor])=>({section,batch,grade,program,floor}));
const LEGACY_TEACHERS=LEGACY_SEED.teachers.map(([name,department,primarySubject,legacyDepartment])=>({name,department,primarySubject,legacyDepartment}));
const LEGACY_MAPPINGS=LEGACY_SEED.mappings.map((r,i)=>({id:"legacy-"+(i+1),section:r[0],subject:r[1],teacher:r[2],periodsPerWeek:Number(r[3]||0),week:r[4]||"Every Week",department:r[5]||"",classTeacher:r[6]||"",coClassTeacher:r[7]||"",originalSubject:r[8]||r[1],activeForSyllabus:!!r[5]}));

const ROLE_META={
  "Super Admin":{code:"SA",description:"Complete control over setup, users, Year Plans, mappings, corrections and reports."},
  "Principal":{code:"PR",description:"Views all reports and submissions and can manage staff access."},
  "Admin":{code:"AD",description:"Manages setup, users, Year Plans and operational records."},
  "HOD":{code:"HD",description:"Sees assigned department, handling teachers, sections, weekly status and reports."},
  "Teacher":{code:"TR",description:"Sees assigned classes/subjects and enters weekly syllabus status."}
};

let currentUser=null;
let pendingInstall=null;
let pendingBulk=null;
const sessionFiles={};
let editingPlanId=null;

function canonicalSubject(s){const x=norm(s);if(["Maths Track A","Math A","Maths A"].includes(x))return"Track A";if(["Maths Track B","Math B","Maths B"].includes(x))return"Track B";if(x==="A&R"||x==="Arithmetic & Reasoning"||x==="Reasoning & Arithmetic")return"Reasoning";return x}
function departmentForSubject(s){const c=canonicalSubject(s);return DEPARTMENT_ORDER.find(d=>DEPARTMENTS[d].includes(c))||(["Lead Activity"].includes(c)?"Social":"")}
function statusOf(row){const p=Number(row.lagPeriods||0);if(row.notApplicable)return"Not Applicable";if(p===0)return"On Track";if(p<=2)return"Minor Lag";if(p<=5)return"Lagging";return"Critical Lag"}
function statusClass(row){const s=statusOf(row);return s==="On Track"?"status-good":s==="Minor Lag"?"status-warn":"status-bad"}
function sectionMeta(section){return SECTIONS.find(x=>x.section===section)||{section,batch:"",program:"",grade:""}}
function fillSelect(el,items,value){if(!el)return;el.innerHTML=items.map(x=>`<option value="${esc(x)}"${x===value?" selected":""}>${esc(x)}</option>`).join("")}
function toCsv(rows){return rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n")}
function downloadBlob(content,name,type="text/plain"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function tempPassword(){return "Kh@"+Math.random().toString(36).slice(2,7).toUpperCase()+"9"}
function appLink(){try{const u=new URL(location.href);u.hash="";u.search="";return u.toString()}catch(e){return location.href}}

function defaultData(){return{schemaVersion:APP_SCHEMA,plans:[],weekly:[],users:[],setup:{orientations:[{name:"C Batch",active:true},{name:"Lead",active:true},{name:"Techno",active:true}],teachers:clone(LEGACY_TEACHERS),handlingMappings:clone(LEGACY_MAPPINGS),sourceCounts:clone(LEGACY_SEED.sourceCounts),migratedFrom:"Khalsa_Timetable_Full_Bulk_Import_FILLED.xlsx",bulkImports:[]},uiScope:{departments:[],sections:[],subjects:[]}}}
function migrateData(d){const base=defaultData(),out={...base,...(d||{})};out.setup={...base.setup,...(d?.setup||{})};out.uiScope={...base.uiScope,...(d?.uiScope||{})};out.plans=[];out.weekly=[];out.users=[];if(!Array.isArray(out.setup.teachers)||out.setup.teachers.length<30)out.setup.teachers=clone(LEGACY_TEACHERS);if(!Array.isArray(out.setup.handlingMappings)||out.setup.handlingMappings.length<200)out.setup.handlingMappings=clone(LEGACY_MAPPINGS);out.setup.sourceCounts=out.setup.sourceCounts||clone(LEGACY_SEED.sourceCounts);out.schemaVersion=APP_SCHEMA;return out}
function loadData(){try{const raw=localStorage.getItem(STORE_KEY);return migrateData(raw?JSON.parse(raw):null)}catch(e){return defaultData()}}
let data=loadData();
function persist(){data.schemaVersion=APP_SCHEMA;localStorage.setItem(STORE_KEY,JSON.stringify({schemaVersion:APP_SCHEMA,uiScope:data.uiScope||{departments:[],sections:[],subjects:[]},setup:{orientations:data.setup?.orientations||[]}}))}

function injectEnhancements(){
  if(!$("#enhancementStyles")){const st=document.createElement("style");st.id="enhancementStyles";st.textContent=".status-warn{color:#c97822;font-weight:800}.plan-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.user-row>.plan-actions{align-items:center}";document.head.appendChild(st)}
  if(!$("#department")){$("#reports").insertAdjacentHTML("beforebegin",`<section id="department" class="view"><div class="page-head"><div><div class="eyebrow blue-text">MY DEPARTMENT</div><h2>Department handling & syllabus status</h2><p>Shows all authorised handling teachers, sections, subjects and current lagging records.</p></div></div><div id="departmentSummary" class="report-summary"></div><div class="panel"><div class="panel-head"><div><div class="eyebrow">HANDLING CLASSES</div><h3>Teacher / class / subject mapping</h3></div><input id="departmentSearch" class="search-input" placeholder="Search teacher, class or subject"></div><div id="departmentMappings" class="user-list"></div></div></section>`)}
  if(!$("#departmentNav")){const sideBtn=document.createElement("button");sideBtn.id="departmentNav";sideBtn.className="nav-btn hidden";sideBtn.dataset.view="department";sideBtn.innerHTML="<span>M</span>My Department";$("#sideNav").insertBefore(sideBtn,$('#sideNav [data-view="weekly"]'));const mob=document.createElement("button");mob.id="departmentMobileNav";mob.className="hidden";mob.dataset.view="department";mob.innerHTML="<span>M</span><small>My Dept</small>";$("#mobileNav").insertBefore(mob,$('#mobileNav [data-view="weekly"]'));[sideBtn,mob].forEach(b=>b.onclick=()=>showView("department"))}
  if(!$("#planEditDialog")){document.body.insertAdjacentHTML("beforeend",`<dialog id="planEditDialog" class="app-dialog"><form id="planEditForm" class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">EDIT YEAR PLAN</div><h3>Assignments & mapping</h3></div><button type="button" id="closePlanEditBtn" class="icon-close">×</button></div><div class="form-grid"><label>Department<select id="editPlanDepartment"></select></label><label>Subject<select id="editPlanSubject"></select></label><label class="full">Handling Teacher <small class="small-muted">Teacher assignment comes from Handling Classes.</small><input id="editPlanTeacher" disabled></label></div><div class="scope-block"><div class="scope-title"><strong>Assigned Classes / Sections</strong><button type="button" id="editPlanSelectAll" class="mini-btn">Select all applicable</button></div><div id="editPlanSections" class="choice-grid four"></div></div><p class="small-muted">Adding or removing a section changes future Year Plan assignment only. Existing weekly submissions and historical reports are not deleted.</p><div class="row-actions"><span id="editPlanStatus" class="status-text"></span><button type="submit" class="primary">Save changes</button></div></form></dialog>`);$("#closePlanEditBtn").onclick=()=>$("#planEditDialog").close();$("#editPlanDepartment").onchange=()=>fillSelect($("#editPlanSubject"),DEPARTMENTS[$("#editPlanDepartment").value]||[],$("#editPlanSubject").value);$("#editPlanSelectAll").onclick=()=>$$('#editPlanSections input[type="checkbox"]').forEach(i=>{i.checked=true;i.closest(".choice-card")?.classList.add("selected")});$("#planEditForm").onsubmit=savePlanEdit}
  const roleSelect=$("#newUserRole");if(roleSelect&&!Array.from(roleSelect.options).some(o=>o.value==="Principal")){const op=document.createElement("option");op.textContent="Principal";op.value="Principal";roleSelect.insertBefore(op,roleSelect.firstChild)}
  const nameInput=$("#newUserName");if(nameInput&&!$("#teacherNames")){nameInput.setAttribute("list","teacherNames");const dl=document.createElement("datalist");dl.id="teacherNames";dl.innerHTML=data.setup.teachers.map(t=>`<option value="${esc(t.name)}"></option>`).join("");nameInput.after(dl);nameInput.addEventListener("change",prefillNewUserFromTeacher)}
}
function bindCoreEvents(){
  $("#togglePassword").onclick=()=>{const i=$("#loginPassword");i.type=i.type==="password"?"text":"password";$("#togglePassword").textContent=i.type==="password"?"Show":"Hide"};
  $("#loginBtn").onclick=login;$("#loginPassword").addEventListener("keydown",e=>{if(e.key==="Enter")login()});$("#logoutBtn").onclick=logout;$("#logoutTopBtn").onclick=logout;
  $$(".nav-btn,.mobile-nav button").forEach(b=>b.onclick=()=>showView(b.dataset.view));$("#helpBtn").onclick=$("#mobileHelpBtn").onclick=()=>$("#helpDialog").showModal();$("#closeHelpBtn").onclick=()=>$("#helpDialog").close();
  $("#ypSection").onchange=()=>{const m=sectionMeta($("#ypSection").value);$("#ypProgram").value=m.program};$("#ypDepartment").onchange=updateYearPlanSubjects;$("#savePlanBtn").onclick=savePlan;$("#planSearch").oninput=renderPlans;$("#downloadPlanBackup").onclick=exportPlanIndex;
  $("#wkWeek").onchange=()=>{applyWeekDates();fillWeeklyFromPlan()};$("#wkSection").onchange=()=>{updateWeeklySubjects();fillWeeklyFromPlan()};$("#wkSubject").onchange=fillWeeklyFromPlan;$("#wkPlannedPeriods").oninput=autoLag;$("#wkTakenPeriods").oninput=autoLag;$("#saveWeeklyBtn").onclick=saveWeekly;$("#weeklySearch").oninput=renderWeekly;
  $("#dashboardWeek").onchange=renderDashboard;$("#dashboardAllBtn").onclick=()=>{$("#dashboardWeek").value="All Weeks";renderDashboard()};$("#reportMode").onchange=renderReports;$("#reportStatus").onchange=renderReports;$("#reportFilter").oninput=renderReports;$("#exportCsvBtn").onclick=exportReportCsv;
  $("#allDepartmentsBtn").onclick=selectAllDepartments;$("#allSubjectsBtn").onclick=selectAllSubjects;$("#clearScopeBtn").onclick=clearScope;$$(".quick-section").forEach(b=>b.onclick=()=>quickSections(b.dataset.program));
  $("#addUserBtn").onclick=()=>$("#userDialog").showModal();$("#closeUserBtn").onclick=()=>$("#userDialog").close();$("#userForm").onsubmit=addUser;$("#backupBtn").onclick=backup;$("#restoreInput").onchange=restoreBackup;$("#previewBulkBtn").onclick=previewBulk;$("#importBulkBtn").onclick=importBulk;$("#installBtn").onclick=installApp;$("#departmentSearch").oninput=renderDepartment;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();pendingInstall=e;$("#installBtn").disabled=false})
}
function init(){injectEnhancements();fillSelect($("#dashboardWeek"),["All Weeks",...WEEKS.map(x=>x.label)],"All Weeks");fillSelect($("#ypSection"),SECTIONS.map(x=>x.section),SECTIONS[0].section);fillSelect($("#ypDepartment"),DEPARTMENT_ORDER,DEPARTMENT_ORDER[0]);fillSelect($("#wkWeek"),WEEKS.map(x=>x.label),currentWeekLabel());fillSelect($("#wkSection"),SECTIONS.map(x=>x.section),SECTIONS[0].section);fillSelect($("#newUserDepartment"),DEPARTMENT_ORDER,DEPARTMENT_ORDER[0]);updateYearPlanSubjects();updateWeeklySubjects();applyWeekDates();bindCoreEvents();persist();renderAll();restoreSession()}
function currentWeekLabel(){const start=new Date(2026,5,1),now=new Date(),diff=Math.floor((now-start)/(7*86400000))+1;return"Week "+Math.max(1,Math.min(44,diff))}
function weekInfo(n){const start=new Date(2026,5,1);start.setDate(start.getDate()+(n-1)*7);const end=new Date(start);end.setDate(end.getDate()+5);const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;return{label:`Week ${n}`,start:iso(start),end:iso(end)}}
const WEEKS=Array.from({length:44},(_,i)=>weekInfo(i+1));
function applyWeekDates(){const info=WEEKS.find(x=>x.label===$("#wkWeek").value);if(info){$("#wkStart").value=info.start;$("#wkEnd").value=info.end}}
function setStatus(sel,msg,error=false){const el=$(sel);if(!el)return;el.textContent=msg;el.classList.toggle("error",error)}
