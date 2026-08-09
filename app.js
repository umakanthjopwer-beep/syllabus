const SECTIONS=[
  {section:'6A',batch:'C5A',program:'C Batch'},{section:'6B',batch:'C5B',program:'C Batch'},{section:'6C',batch:'L5',program:'Lead'},
  {section:'7A',batch:'C4A',program:'C Batch'},{section:'7B',batch:'C4B',program:'C Batch'},{section:'7C',batch:'L4',program:'Lead'},
  {section:'8A',batch:'C3A',program:'C Batch'},{section:'8B',batch:'C3B',program:'C Batch'},{section:'8C',batch:'L3',program:'Lead'},{section:'8D',batch:'8th Techno',program:'Techno'},
  {section:'9A',batch:'C2A',program:'C Batch'},{section:'9B',batch:'C2B',program:'C Batch'},{section:'9C',batch:'L2',program:'Lead'},{section:'9D',batch:'9th Techno',program:'Techno'},
  {section:'10A',batch:'C1A',program:'C Batch'},{section:'10B',batch:'C1B',program:'C Batch'},{section:'10C',batch:'10th Techno',program:'Techno'}
];
const DEPARTMENTS={
  Mathematics:['Maths Track A','Maths Track B','Reasoning','Arithmetic','Vedic Maths'],
  Biology:['Biology','Biology Practice'],
  Chemistry:['Chemistry','Chemistry Practice'],
  English:['English','English Practice'],
  Social:['GK & CA','Social','Social Practice'],
  IT:['IT','Wikilab / Library'],
  Physics:['Physics','Physics Practice'],
  Hindi:['SL Hindi','TL Hindi'],
  Telugu:['SL Telugu','TL Telugu','Telugu Practice']
};
const ALL_SUBJECTS=[...new Set(Object.values(DEPARTMENTS).flat())];
const ROLES={
  'Super Admin':{code:'SA',description:'Full control of setup, users, Year Plans and all operational records.'},
  'Admin':{code:'AD',description:'Manages setup, users, Year Plans and all operational records.'},
  'HOD':{code:'HD',description:'Always sees syllabus lagging reports for assigned departments.'},
  'Teacher':{code:'TR',description:'Can enter status only for assigned class-subject combinations.'}
};
const STORE_KEY='khalsa_syllabus_tracker_previous_app_v4';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const uid=()=>globalThis.crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(16).slice(2));
const defaultData={
  plans:[],weekly:[],
  users:[
    {id:'u-super',name:'J Umakanth',username:'umakanth',role:'Super Admin',department:'Mathematics',departments:['Mathematics'],sections:SECTIONS.map(x=>x.section),subjects:ALL_SUBJECTS},
    {id:'u-hod-social',name:'B. Aruna',username:'aruna',role:'HOD',department:'Social',departments:['Social'],sections:SECTIONS.map(x=>x.section),subjects:DEPARTMENTS.Social}
  ],
  setup:{orientations:[{name:'C Batch',active:true},{name:'Lead',active:true},{name:'Techno',active:true}],teachers:[],bulkImports:[]},
  uiScope:{departments:[],sections:[],subjects:[]}
};
let data=loadData();
let currentUser=null;
let pendingInstall=null;
let pendingBulk=null;
const sessionFiles={};

function clone(v){return JSON.parse(JSON.stringify(v))}
function loadData(){try{const raw=localStorage.getItem(STORE_KEY);if(!raw)return clone(defaultData);const d=JSON.parse(raw);return {...clone(defaultData),...d,setup:{...clone(defaultData.setup),...(d.setup||{})},uiScope:{...clone(defaultData.uiScope),...(d.uiScope||{})}}}catch(e){return clone(defaultData)}}
function persist(){localStorage.setItem(STORE_KEY,JSON.stringify(data))}
function downloadBlob(content,name,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function deptOfSubject(subject){return Object.entries(DEPARTMENTS).find(([,subjects])=>subjects.includes(subject))?.[0]||''}
function statusOf(row){return Number(row.lagPeriods||0)>0?'Lagging':'On Track'}
function sectionMeta(section){return SECTIONS.find(x=>x.section===section)||{section,batch:'',program:''}}
function fillSelect(el,items,value){if(!el)return;el.innerHTML=items.map(x=>`<option value="${esc(x)}"${x===value?' selected':''}>${esc(x)}</option>`).join('')}
function weekInfo(n){const start=new Date(2026,5,1);start.setDate(start.getDate()+(n-1)*7);const end=new Date(start);end.setDate(end.getDate()+5);const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return{label:`Week ${n}`,start:iso(start),end:iso(end)}}
const WEEKS=Array.from({length:44},(_,i)=>weekInfo(i+1));

function init(){
  fillSelect($('#dashboardWeek'),['All Weeks',...WEEKS.map(x=>x.label)],'All Weeks');
  fillSelect($('#ypSection'),SECTIONS.map(x=>x.section),SECTIONS[0].section);
  fillSelect($('#ypDepartment'),Object.keys(DEPARTMENTS),Object.keys(DEPARTMENTS)[0]);
  fillSelect($('#wkWeek'),WEEKS.map(x=>x.label),WEEKS[0].label);
  fillSelect($('#wkSection'),SECTIONS.map(x=>x.section),SECTIONS[0].section);
  fillSelect($('#newUserDepartment'),Object.keys(DEPARTMENTS),Object.keys(DEPARTMENTS)[0]);
  updateYearPlanSubjects();updateWeeklySubjects();applyWeekDates();
  bindEvents();renderAll();restoreSession();
}
function bindEvents(){
  $('#togglePassword').onclick=()=>{const i=$('#loginPassword');i.type=i.type==='password'?'text':'password';$('#togglePassword').textContent=i.type==='password'?'Show':'Hide'};
  $('#loginBtn').onclick=login;$('#loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
  $('#logoutBtn').onclick=logout;$('#logoutTopBtn').onclick=logout;
  $$('.nav-btn,.mobile-nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $('#helpBtn').onclick=$('#mobileHelpBtn').onclick=()=>$('#helpDialog').showModal();$('#closeHelpBtn').onclick=()=>$('#helpDialog').close();
  $('#ypSection').onchange=()=>{const m=sectionMeta($('#ypSection').value);$('#ypProgram').value=m.program};
  $('#ypDepartment').onchange=updateYearPlanSubjects;$('#savePlanBtn').onclick=savePlan;$('#planSearch').oninput=renderPlans;$('#downloadPlanBackup').onclick=exportPlanIndex;
  $('#wkWeek').onchange=()=>{applyWeekDates();fillWeeklyFromPlan()};$('#wkSection').onchange=()=>{updateWeeklySubjects();fillWeeklyFromPlan()};$('#wkSubject').onchange=fillWeeklyFromPlan;
  $('#wkPlannedPeriods').oninput=autoLag;$('#wkTakenPeriods').oninput=autoLag;$('#saveWeeklyBtn').onclick=saveWeekly;$('#weeklySearch').oninput=renderWeekly;
  $('#dashboardWeek').onchange=renderDashboard;$('#dashboardAllBtn').onclick=()=>{$('#dashboardWeek').value='All Weeks';renderDashboard()};
  $('#reportMode').onchange=renderReports;$('#reportStatus').onchange=renderReports;$('#reportFilter').oninput=renderReports;$('#exportCsvBtn').onclick=exportReportCsv;
  $('#allDepartmentsBtn').onclick=selectAllDepartments;$('#allSubjectsBtn').onclick=selectAllSubjects;$('#clearScopeBtn').onclick=clearScope;
  $$('.quick-section').forEach(b=>b.onclick=()=>quickSections(b.dataset.program));
  $('#addUserBtn').onclick=()=>$('#userDialog').showModal();$('#closeUserBtn').onclick=()=>$('#userDialog').close();$('#userForm').onsubmit=addUser;
  $('#backupBtn').onclick=backup;$('#restoreInput').onchange=restoreBackup;
  $('#previewBulkBtn').onclick=previewBulk;$('#importBulkBtn').onclick=importBulk;
  $('#installBtn').onclick=installApp;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pendingInstall=e;$('#installBtn').disabled=false});
}
function restoreSession(){const username=sessionStorage.getItem('khalsa_tracker_user');if(!username)return;const user=data.users.find(x=>x.username.toLowerCase()===username.toLowerCase());if(user){currentUser=user;openApp()}}
function login(){const username=$('#loginUsername').value.trim();const password=$('#loginPassword').value;if(!username||!password){showLoginError('Enter both username and password.');return}const user=data.users.find(x=>x.username.toLowerCase()===username.toLowerCase());if(!user){showLoginError('Username not found. Contact the school Admin.');return}currentUser=user;sessionStorage.setItem('khalsa_tracker_user',user.username);openApp()}
function showLoginError(msg){const e=$('#loginError');e.textContent=msg;e.classList.remove('hidden')}
function openApp(){$('#loginError').classList.add('hidden');$('#loginScreen').classList.add('hidden');$('#appShell').classList.remove('hidden');$('#profileName').textContent=currentUser.name;$('#profileRole').textContent=currentUser.role;renderAll()}
function logout(){sessionStorage.removeItem('khalsa_tracker_user');currentUser=null;$('#appShell').classList.add('hidden');$('#loginScreen').classList.remove('hidden');$('#loginPassword').value=''}
function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav-btn,.mobile-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='users')renderUsers();if(id==='setup')renderSetup();if(id==='reports')renderReports()}
function updateYearPlanSubjects(){fillSelect($('#ypSubject'),DEPARTMENTS[$('#ypDepartment').value]||[],($('#ypSubject')?.value||''))}
function updateWeeklySubjects(){const section=$('#wkSection').value;const plannedSubjects=[...new Set(data.plans.filter(p=>p.enabled!==false&&p.section===section).map(p=>p.subject))];fillSelect($('#wkSubject'),plannedSubjects.length?plannedSubjects:ALL_SUBJECTS,$('#wkSubject')?.value||plannedSubjects[0]||ALL_SUBJECTS[0])}
function applyWeekDates(){const info=WEEKS.find(x=>x.label===$('#wkWeek').value);if(info){$('#wkStart').value=info.start;$('#wkEnd').value=info.end}}
function autoLag(){const planned=Number($('#wkPlannedPeriods').value||0),taken=Number($('#wkTakenPeriods').value||0);$('#wkLagPeriods').value=Math.max(0,planned-taken)}

async function savePlan(){
  const file=$('#ypFile').files[0];if(!file){setStatus('#planStatus','Select a Year Plan file first.',true);return}
  const section=$('#ypSection').value,program=$('#ypProgram').value,department=$('#ypDepartment').value,subject=$('#ypSubject').value,teacher=$('#ypTeacher').value.trim();
  let parsed={preview:'',weeks:[]};try{parsed=await parsePlanFile(file)}catch(e){parsed.preview=`Could not parse preview: ${e.message||e}`}
  const record={id:uid(),section,program,department,subject,teacher,fileName:file.name,fileType:file.type||file.name.split('.').pop(),size:file.size,enabled:true,uploadedAt:new Date().toISOString(),preview:parsed.preview,weeks:parsed.weeks};
  data.plans.unshift(record);sessionFiles[record.id]=URL.createObjectURL(file);persist();$('#ypFile').value='';setStatus('#planStatus',`Uploaded ${file.name}. ${record.weeks.length?record.weeks.length+' week rows detected.':'File indexed.'}`);renderAll()
}
async function parsePlanFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','csv'].includes(ext)&&window.XLSX){const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:true});let preview='',weekRows=[];for(const sheetName of wb.SheetNames.slice(0,4)){const ws=wb.Sheets[sheetName];const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});preview+=`[${sheetName}]\n`+XLSX.utils.sheet_to_csv(ws).slice(0,1800)+'\n';weekRows.push(...extractWeekRows(rows))}return{preview:preview.slice(0,6500),weeks:dedupeWeeks(weekRows)}}
  if(ext==='pdf')return{preview:'PDF Year Plan attached. The previous server version stored and parsed the PDF centrally; this reconstruction keeps the file index and mapping ready for backend parsing.',weeks:[]};
  return{preview:'File attached.',weeks:[]}
}
function normKey(k){return String(k||'').toLowerCase().replace(/[^a-z0-9]+/g,' ')}
function pick(row,tests){for(const [k,v] of Object.entries(row)){const n=normKey(k);if(tests.some(t=>n.includes(t)))return v}return''}
function extractWeekRows(rows){const out=[];for(const row of rows){const weekRaw=pick(row,['week no','week number','week']);const topic=pick(row,['topic','chapter','syllabus','content']);const start=pick(row,['start date','from date']);const end=pick(row,['end date','to date']);const days=pick(row,['working days','no of days']);const periods=pick(row,['planned periods','periods','no of periods']);if(!weekRaw&&!topic)continue;const m=String(weekRaw).match(/(\d{1,2})/);if(!m)continue;out.push({week:`Week ${Number(m[1])}`,startDate:String(start||''),endDate:String(end||''),workingDays:Number(String(days).match(/\d+/)?.[0]||0),plannedPeriods:Number(String(periods).match(/\d+/)?.[0]||0),topic:String(topic||'').trim()})}return out}
function dedupeWeeks(rows){const map=new Map();rows.forEach(r=>{const key=r.week+'|'+r.topic;if(!map.has(key))map.set(key,r)});return[...map.values()]}
function setStatus(sel,msg,error=false){const el=$(sel);el.textContent=msg;el.classList.toggle('error',error)}
function fillWeeklyFromPlan(){const section=$('#wkSection').value,subject=$('#wkSubject').value,week=$('#wkWeek').value;const plan=data.plans.find(p=>p.enabled!==false&&p.section===section&&p.subject===subject);if(!plan)return;$('#wkTeacher').value=plan.teacher||'';const wr=(plan.weeks||[]).find(x=>x.week===week);if(wr){$('#wkPlanned').value=wr.topic||'';$('#wkDays').value=wr.workingDays||'';$('#wkPlannedPeriods').value=wr.plannedPeriods||'';if(/^\d{4}-\d{2}-\d{2}$/.test(wr.startDate))$('#wkStart').value=wr.startDate;if(/^\d{4}-\d{2}-\d{2}$/.test(wr.endDate))$('#wkEnd').value=wr.endDate}else if(!$('#wkPlanned').value){$('#wkPlanned').value=''}autoLag()}
function renderPlans(){const q=($('#planSearch')?.value||'').toLowerCase();const rows=data.plans.filter(p=>[p.section,p.program,p.department,p.subject,p.teacher,p.fileName].join(' ').toLowerCase().includes(q));$('#planCards').innerHTML=rows.length?rows.map(p=>`<article class="plan-card ${p.enabled===false?'disabled':''}"><div><strong>${esc(p.fileName)}</strong><div class="sub">${esc(p.section)} · ${esc(p.program)} · ${esc(p.subject)}${p.teacher?' · '+esc(p.teacher):''}</div><div class="plan-meta"><span class="chip">${esc(p.department||deptOfSubject(p.subject))}</span><span class="chip">${(p.weeks||[]).length} weekly rows</span><span class="chip">${p.enabled===false?'Disabled':'Active'}</span></div></div><div class="plan-actions"><button onclick="viewPlan('${p.id}')">View</button><button onclick="togglePlan('${p.id}')">${p.enabled===false?'Enable':'Disable'}</button><button class="danger" onclick="deletePlan('${p.id}')">Delete</button></div></article>`).join(''):'<div class="bulk-message">No Year Plans uploaded yet.</div>';renderDashboard()}
window.viewPlan=id=>{const p=data.plans.find(x=>x.id===id);if(!p)return;if(sessionFiles[id]){window.open(sessionFiles[id],'_blank');return}alert(`${p.fileName}\n\n${p.preview||'The file index is saved, but this browser session no longer has the original local file bytes.'}`)};
window.togglePlan=id=>{const p=data.plans.find(x=>x.id===id);if(!p)return;p.enabled=p.enabled===false?true:false;persist();renderAll()};
window.deletePlan=id=>{const p=data.plans.find(x=>x.id===id);if(!p)return;if(!confirm(`Delete Year Plan index for ${p.fileName}?`))return;data.plans=data.plans.filter(x=>x.id!==id);if(sessionFiles[id])URL.revokeObjectURL(sessionFiles[id]);delete sessionFiles[id];persist();renderAll()};
function exportPlanIndex(){const rows=[['Class','Programme','Department','Subject','Teacher','File','Active','Uploaded'],...data.plans.map(p=>[p.section,p.program,p.department,p.subject,p.teacher,p.fileName,p.enabled!==false,p.uploadedAt])];downloadBlob(toCsv(rows),'khalsa-year-plan-index.csv','text/csv')}

function saveWeekly(){const subject=$('#wkSubject').value;if(!subject){setStatus('#weeklyStatus','Select a subject.',true);return}const row={id:uid(),week:$('#wkWeek').value,section:$('#wkSection').value,department:deptOfSubject(subject),subject,teacher:$('#wkTeacher').value.trim(),startDate:$('#wkStart').value,endDate:$('#wkEnd').value,workingDays:Number($('#wkDays').value||0),plannedPeriods:Number($('#wkPlannedPeriods').value||0),takenPeriods:Number($('#wkTakenPeriods').value||0),lagPeriods:Number($('#wkLagPeriods').value||0),planned:$('#wkPlanned').value.trim(),actual:$('#wkActual').value.trim(),reason:$('#wkReason').value.trim(),savedAt:new Date().toISOString(),savedBy:currentUser?.name||''};data.weekly.unshift(row);persist();setStatus('#weeklyStatus','Weekly status saved successfully.');renderAll()}
function renderWeekly(){const q=($('#weeklySearch')?.value||'').toLowerCase();const rows=data.weekly.filter(e=>[e.week,e.section,e.subject,e.teacher,e.planned,e.actual,e.reason].join(' ').toLowerCase().includes(q));$('#weeklyTable').innerHTML=rows.length?rows.slice(0,150).map(e=>`<tr><td>${esc(e.week)}</td><td>${esc(e.section)}</td><td>${esc(e.subject)}</td><td>${esc(e.teacher||'-')}</td><td>${e.plannedPeriods||0}</td><td>${e.takenPeriods||0}</td><td>${e.lagPeriods||0}</td><td><span class="${e.lagPeriods>0?'status-bad':'status-good'}">${statusOf(e)}</span></td><td><button class="table-action" onclick="deleteWeekly('${e.id}')">Delete</button></td></tr>`).join(''):'<tr><td colspan="9">No weekly status records yet.</td></tr>'}
window.deleteWeekly=id=>{if(!confirm('Delete this weekly status record?'))return;data.weekly=data.weekly.filter(x=>x.id!==id);persist();renderAll()};
function renderDashboard(){const week=$('#dashboardWeek')?.value||'All Weeks';const rows=week==='All Weeks'?data.weekly:data.weekly.filter(x=>x.week===week);const activePlans=data.plans.filter(x=>x.enabled!==false);$('#statPlans').textContent=activePlans.length;$('#statUpdates').textContent=rows.length;$('#statOnTrack').textContent=rows.filter(x=>Number(x.lagPeriods||0)===0).length;$('#statLagging').textContent=rows.filter(x=>Number(x.lagPeriods||0)>0).length;const alerts=rows.filter(x=>Number(x.lagPeriods||0)>0).length;$('#alertCount').textContent=alerts;$('#mobileAlertCount').textContent=alerts;$('#sectionCards').innerHTML=SECTIONS.map(s=>{const sr=rows.filter(x=>x.section===s.section),lag=sr.reduce((n,x)=>n+Number(x.lagPeriods||0),0),plans=activePlans.filter(p=>p.section===s.section).length;return`<article class="section-card ${sr.length&&!lag?'top':''}"><div class="head"><div><strong>${s.section}</strong><small>${esc(s.batch)} · ${esc(s.program)}</small></div><span class="status-icon ${lag?'bad':''}">${lag?'!':'✓'}</span></div><div class="meta"><span>${plans} plans</span><span>${sr.length} updates</span><span>${lag} lag</span></div></article>`}).join('')}
function renderReports(){let rows=[...data.weekly];const status=$('#reportStatus')?.value||'all',q=($('#reportFilter')?.value||'').toLowerCase(),mode=$('#reportMode')?.value||'teacher';if(status==='lagging')rows=rows.filter(x=>x.lagPeriods>0);if(status==='ontrack')rows=rows.filter(x=>!x.lagPeriods);rows=rows.filter(x=>[x.week,x.section,x.department,x.subject,x.teacher,x.planned,x.actual,x.reason].join(' ').toLowerCase().includes(q));const key={teacher:'teacher',class:'section',subject:'subject',week:'week',department:'department'}[mode];rows.sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||'')));const lagEntries=rows.filter(x=>x.lagPeriods>0).length,totalLag=rows.reduce((n,x)=>n+Number(x.lagPeriods||0),0),classes=new Set(rows.map(x=>x.section)).size;$('#reportSummary').innerHTML=`<span class="summary-pill">Records <b>${rows.length}</b></span><span class="summary-pill">Classes <b>${classes}</b></span><span class="summary-pill">Lagging entries <b>${lagEntries}</b></span><span class="summary-pill">Periods lagging <b>${totalLag}</b></span>`;$('#reportTable').innerHTML=rows.length?rows.map(e=>`<tr><td>${esc(e.week)}</td><td>${esc(e.section)}</td><td>${esc(e.department||deptOfSubject(e.subject))}</td><td>${esc(e.subject)}</td><td>${esc(e.teacher||'-')}</td><td>${esc(e.planned||'-')}</td><td>${esc(e.actual||'-')}</td><td>${e.lagPeriods||0}</td><td><span class="${e.lagPeriods>0?'status-bad':'status-good'}">${statusOf(e)}</span></td></tr>`).join(''):'<tr><td colspan="9">No report data available.</td></tr>'}
function exportReportCsv(){const rows=[['Week','Class','Department','Subject','Teacher','Week Start','Week End','Working Days','Planned Topic','Current Topic','Planned Periods','Periods Taken','Periods Lagging','Reason','Status'],...data.weekly.map(e=>[e.week,e.section,e.department,e.subject,e.teacher,e.startDate,e.endDate,e.workingDays,e.planned,e.actual,e.plannedPeriods,e.takenPeriods,e.lagPeriods,e.reason,statusOf(e)])];downloadBlob(toCsv(rows),'khalsa-syllabus-lagging-report.csv','text/csv')}
function toCsv(rows){return rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')}

function renderUsers(){const counts={};Object.keys(ROLES).forEach(r=>counts[r]=data.users.filter(u=>u.role===r).length);$('#roleCards').innerHTML=Object.entries(ROLES).map(([role,m])=>`<article class="role-card ${role==='Teacher'?'teacher':''}"><div class="role-top"><div class="role-icon ${role==='Teacher'?'green':''}">${m.code}</div><div><h3>${role}</h3><p>${m.description}</p></div></div><span class="role-count">${counts[role]} users</span></article>`).join('');renderScope();$('#userList').innerHTML=data.users.map(u=>`<div class="user-row"><div class="initial">${esc(initials(u.name))}</div><div><strong>${esc(u.name)} · ${esc(u.role)}</strong><small>@${esc(u.username)}${u.department?' · '+esc(u.department):''}</small></div>${u.id==='u-super'?'<span class="soft-badge">Protected</span>':`<button onclick="deleteUser('${u.id}')">Delete</button>`}</div>`).join('')}
function initials(name){return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'U'}
function renderScope(){const s=data.uiScope;$('#departmentCards').innerHTML=Object.entries(DEPARTMENTS).map(([d,subs])=>choiceHtml('department',d,`${subs.join(' · ')}`,s.departments.includes(d))).join('');$('#scopeSections').innerHTML=SECTIONS.map(x=>choiceHtml('section',x.section,`${x.batch} · ${x.program}`,s.sections.includes(x.section))).join('');const visibleSubjects=s.departments.length?[...new Set(s.departments.flatMap(d=>DEPARTMENTS[d]||[]))]:ALL_SUBJECTS;$('#scopeSubjects').innerHTML=visibleSubjects.map(sub=>choiceHtml('subject',sub,deptOfSubject(sub),s.subjects.includes(sub))).join('');$$('.scope-choice').forEach(i=>i.onchange=scopeChanged)}
function choiceHtml(type,value,sub,checked){return`<label class="choice-card ${checked?'selected':''}"><input class="scope-choice" type="checkbox" data-type="${type}" value="${esc(value)}" ${checked?'checked':''}><div><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>${checked?'<span class="tick">✓</span>':''}</label>`}
function scopeChanged(e){const {type}=e.target.dataset,value=e.target;const key=type==='department'?'departments':type==='section'?'sections':'subjects';const arr=new Set(data.uiScope[key]);value.checked?arr.add(value.value):arr.delete(value.value);data.uiScope[key]=[...arr];if(type==='department'){const allowed=new Set(data.uiScope.departments.flatMap(d=>DEPARTMENTS[d]||[]));data.uiScope.subjects=data.uiScope.subjects.filter(x=>allowed.size===0||allowed.has(x))}persist();renderScope()}
function selectAllDepartments(){data.uiScope.departments=Object.keys(DEPARTMENTS);persist();renderScope()}
function selectAllSubjects(){const visible=data.uiScope.departments.length?[...new Set(data.uiScope.departments.flatMap(d=>DEPARTMENTS[d]||[]))]:ALL_SUBJECTS;data.uiScope.subjects=visible;persist();renderScope()}
function clearScope(){data.uiScope={departments:[],sections:[],subjects:[]};persist();renderScope()}
function quickSections(program){const set=new Set(data.uiScope.sections);SECTIONS.filter(x=>x.program===program).forEach(x=>set.add(x.section));data.uiScope.sections=[...set];persist();renderScope()}
function addUser(e){e.preventDefault();const name=$('#newUserName').value.trim(),username=$('#newUsername').value.trim(),role=$('#newUserRole').value,department=$('#newUserDepartment').value;if(!name||!username)return;if(data.users.some(x=>x.username.toLowerCase()===username.toLowerCase())){alert('Username already exists.');return}data.users.push({id:uid(),name,username,role,department,departments:role==='HOD'?[department]:[],sections:[],subjects:[]});persist();$('#userForm').reset();$('#userDialog').close();renderUsers()}
window.deleteUser=id=>{if(!confirm('Delete this staff account?'))return;data.users=data.users.filter(x=>x.id!==id);persist();renderUsers()};

function renderSetup(){const os=data.setup.orientations||[];$('#orientationCount').innerHTML=`${os.filter(x=>x.active).length}<br><small>active</small>`;$('#orientationRows').innerHTML=os.map((o,i)=>`<div class="mrow"><div><strong>${esc(o.name)}</strong><small>${o.active?'Active':'Disabled'}</small></div><div class="buttons"><button onclick="renameOrientation(${i})">Edit</button><button onclick="toggleOrientation(${i})">${o.active?'Disable':'Enable'}</button><button class="delete" onclick="deleteOrientation(${i})">Delete</button></div></div>`).join('');$('#classMasterRows').innerHTML=SECTIONS.map(x=>`<div class="mrow"><div><strong>${x.section}</strong><small>${esc(x.batch)} · ${esc(x.program)}</small></div><div class="buttons"><button onclick="showClassInfo('${x.section}')">Edit</button></div></div>`).join('');$('#departmentCount').innerHTML=`${Object.keys(DEPARTMENTS).length}<br><small>active</small>`;$('#departmentMasterRows').innerHTML=Object.entries(DEPARTMENTS).map(([d,subs])=>`<div class="mrow"><div><strong>${esc(d)}</strong><small>${subs.length} subjects</small></div><div class="buttons"><button onclick="showDepartmentInfo('${esc(d)}')">Edit</button></div></div>`).join('');const teacherSet=new Set([...data.setup.teachers,...data.plans.map(x=>x.teacher).filter(Boolean),...data.weekly.map(x=>x.teacher).filter(Boolean)]);$('#teacherCount').innerHTML=`${teacherSet.size}<br><small>active</small>`}
window.renameOrientation=i=>{const o=data.setup.orientations[i];const n=prompt('Orientation name',o.name);if(!n||n.trim()===o.name)return;o.name=n.trim();persist();renderSetup()};
window.toggleOrientation=i=>{data.setup.orientations[i].active=!data.setup.orientations[i].active;persist();renderSetup()};
window.deleteOrientation=i=>{const name=data.setup.orientations[i].name;if(SECTIONS.some(x=>x.program===name)){alert(`${name} is used by existing classes and cannot be deleted.`);return}if(confirm(`Delete ${name}?`)){data.setup.orientations.splice(i,1);persist();renderSetup()}};
window.showClassInfo=section=>{const x=sectionMeta(section);alert(`${x.section}\nInternal batch: ${x.batch}\nOrientation: ${x.program}\n\nThe class is linked to Year Plans and weekly records. Structural editing will be connected to the shared backend to preserve references safely.`)};
window.showDepartmentInfo=d=>alert(`${d}\n\nSubjects:\n${(DEPARTMENTS[d]||[]).join('\n')}`);
async function previewBulk(){const file=$('#bulkFile').files[0];if(!file){$('#bulkStatus').innerHTML='<div class="bulk-message">Select an Excel or CSV file first.</div>';return}if(!window.XLSX){$('#bulkStatus').innerHTML='<div class="bulk-message">Excel reader is unavailable.</div>';return}try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const result={fileName:file.name,classes:[],teachers:[],subjects:[],mappings:[],issues:[]};for(const s of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[s],{defval:''});const n=s.toLowerCase();if(n.includes('class'))result.classes.push(...rows);else if(n.includes('teacher'))result.teachers.push(...rows);else if(n.includes('subject'))result.subjects.push(...rows);else if(n.includes('mapping')||n.includes('allocation'))result.mappings.push(...rows)}if(!result.classes.length&&!result.teachers.length&&!result.subjects.length&&!result.mappings.length){const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});result.mappings=rows}result.mappings.forEach((r,idx)=>{const keys=Object.keys(r).map(normKey);const hasClass=keys.some(k=>k==='class'||k.includes('class section'));const hasSection=keys.some(k=>k==='section'||k.includes('class section'));if(!(hasClass||hasSection))result.issues.push(`Row ${idx+2}: Class and section are required`) });pendingBulk=result;$('#importBulkBtn').disabled=false;renderBulkPreview()}catch(e){pendingBulk=null;$('#importBulkBtn').disabled=true;$('#bulkStatus').innerHTML=`<div class="bulk-message">Could not read file: ${esc(e.message||e)}</div>`}}
function renderBulkPreview(){const p=pendingBulk;if(!p)return;$('#bulkStatus').innerHTML=`<div class="bulk-summary"><div class="bulk-stat"><strong>${p.classes.length}</strong><small>Classes & Sections</small></div><div class="bulk-stat"><strong>${p.teachers.length}</strong><small>Teachers</small></div><div class="bulk-stat"><strong>${p.subjects.length}</strong><small>Subjects</small></div><div class="bulk-stat"><strong>${p.mappings.length}</strong><small>Mappings</small></div></div><div class="bulk-message">${p.issues.length?`<b>${p.issues.length} issue(s)</b> · ${esc(p.issues.slice(0,8).join(' · '))}`:'Preview ready. No basic reference issues detected.'}</div>`}
function importBulk(){if(!pendingBulk)return;if(pendingBulk.issues.length){alert('Correct the listed issues and upload the file again.');return}const teacherNames=pendingBulk.teachers.map(r=>pick(r,['teacher name','teacher'])).filter(Boolean).map(String);data.setup.teachers=[...new Set([...data.setup.teachers,...teacherNames])];data.setup.bulkImports.unshift({fileName:pendingBulk.fileName,importedAt:new Date().toISOString(),counts:{classes:pendingBulk.classes.length,teachers:pendingBulk.teachers.length,subjects:pendingBulk.subjects.length,mappings:pendingBulk.mappings.length}});persist();$('#bulkFile').value='';pendingBulk=null;$('#importBulkBtn').disabled=true;$('#bulkStatus').innerHTML='<div class="bulk-message"><b>Import recorded.</b> Valid master rows were added to the local reconstructed workspace.</div>';renderSetup()}
function backup(){downloadBlob(JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2),'khalsa-syllabus-tracker-backup.json','application/json')}
function restoreBackup(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);data={...clone(defaultData),...d,setup:{...clone(defaultData.setup),...(d.setup||{})},uiScope:{...clone(defaultData.uiScope),...(d.uiScope||{})}};persist();renderAll();alert('Backup restored successfully.')}catch(err){alert('Invalid backup file.')}};r.readAsText(file)}
async function installApp(){if(pendingInstall){pendingInstall.prompt();await pendingInstall.userChoice;pendingInstall=null}else alert('Use your browser menu and choose “Install app” or “Add to Home screen” if the install prompt is not shown.')}
function renderAll(){renderPlans();renderWeekly();renderDashboard();renderReports();renderUsers();renderSetup()}

init();
