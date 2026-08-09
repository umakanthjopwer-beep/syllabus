function handlingTeacher(section,subject){
  const exact=data.setup.handlingMappings.find(m=>m.activeForSyllabus&&m.section===section&&m.subject===subject);return exact?.teacher||""
}
function fillWeeklyFromPlan(){
  const section=$("#wkSection").value,subject=$("#wkSubject").value,week=$("#wkWeek").value;
  const plan=visiblePlans().find(p=>p.enabled!==false&&p.assignedSections.includes(section)&&p.subject===subject);
  $("#wkTeacher").value=handlingTeacher(section,subject)||plan?.teacher||"";
  if(!plan){$("#wkPlanned").value="";$("#wkDays").value="";$("#wkPlannedPeriods").value="";autoLag();return}
  const wr=(plan.weeks||[]).find(x=>x.week===week);if(wr){$("#wkPlanned").value=wr.topic||"";$("#wkDays").value=wr.workingDays||"";$("#wkPlannedPeriods").value=wr.plannedPeriods||"";if(/^\d{4}-\d{2}-\d{2}$/.test(wr.startDate))$("#wkStart").value=wr.startDate;if(/^\d{4}-\d{2}-\d{2}$/.test(wr.endDate))$("#wkEnd").value=wr.endDate}else{$("#wkPlanned").value=""}
  autoLag()
}
function canSubmitWeekly(section,subject){
  if(isAdmin())return true;if(currentUser?.role==="HOD")return userDepartments().includes(departmentForSubject(subject));
  return teacherMappingsFor(currentUser?.name||"").some(m=>m.section===section&&m.subject===subject)
}
function saveWeekly(){
  const subject=canonicalSubject($("#wkSubject").value),section=$("#wkSection").value;if(!subject){setStatus("#weeklyStatus","Select a subject.",true);return}
  if(!canSubmitWeekly(section,subject)){setStatus("#weeklyStatus","This class-subject is outside your assigned scope.",true);return}
  const row={id:uid(),week:$("#wkWeek").value,section,department:departmentForSubject(subject),subject,teacher:handlingTeacher(section,subject)||norm($("#wkTeacher").value),startDate:$("#wkStart").value,endDate:$("#wkEnd").value,workingDays:Number($("#wkDays").value||0),plannedPeriods:Number($("#wkPlannedPeriods").value||0),takenPeriods:Number($("#wkTakenPeriods").value||0),lagPeriods:Number($("#wkLagPeriods").value||0),planned:norm($("#wkPlanned").value),actual:norm($("#wkActual").value),reason:norm($("#wkReason").value),savedAt:new Date().toISOString(),savedBy:currentUser?.name||""};
  data.weekly.unshift(row);persist();setStatus("#weeklyStatus",`Weekly status saved · ${statusOf(row)}.`);renderAll()
}
function renderWeekly(){
  const q=($("#weeklySearch")?.value||"").toLowerCase();const rows=visibleWeekly().filter(e=>[e.week,e.section,e.subject,e.teacher,e.planned,e.actual,e.reason].join(" ").toLowerCase().includes(q));
  $("#weeklyTable").innerHTML=rows.length?rows.slice(0,200).map(e=>`<tr><td>${esc(e.week)}</td><td>${esc(e.section)}</td><td>${esc(e.subject)}</td><td>${esc(e.teacher||"-")}</td><td>${e.plannedPeriods||0}</td><td>${e.takenPeriods||0}</td><td>${e.lagPeriods||0}</td><td><span class="${statusClass(e)}">${statusOf(e)}</span></td><td>${isAdmin()?`<button class="table-action" onclick="deleteWeekly('${e.id}')">Delete</button>`:""}</td></tr>`).join(""):'<tr><td colspan="9">No weekly status records yet.</td></tr>'
}
window.deleteWeekly=id=>{if(!isAdmin())return;if(!confirm("Delete this weekly status record?"))return;data.weekly=data.weekly.filter(x=>x.id!==id);persist();renderAll()};

function renderDashboard(){
  const week=$("#dashboardWeek")?.value||"All Weeks";const all=visibleWeekly(),rows=week==="All Weeks"?all:all.filter(x=>x.week===week),plans=visiblePlans().filter(x=>x.enabled!==false);
  $("#statPlans").textContent=plans.length;$("#statUpdates").textContent=rows.length;$("#statOnTrack").textContent=rows.filter(x=>statusOf(x)==="On Track").length;$("#statLagging").textContent=rows.filter(x=>Number(x.lagPeriods||0)>0).length;
  const alerts=rows.filter(x=>Number(x.lagPeriods||0)>0).length;$("#alertCount").textContent=alerts;$("#mobileAlertCount").textContent=alerts;
  $("#sectionCards").innerHTML=visibleSections().map(s=>{const sr=rows.filter(x=>x.section===s.section),lag=sr.reduce((n,x)=>n+Number(x.lagPeriods||0),0),pc=plans.filter(p=>p.assignedSections.includes(s.section)).length;return`<article class="section-card ${sr.length&&!lag?"top":""}"><div class="head"><div><strong>${s.section}</strong><small>${esc(s.batch)} · ${esc(s.program)}</small></div><span class="status-icon ${lag?"bad":""}">${lag?"!":"✓"}</span></div><div class="meta"><span>${pc} plans</span><span>${sr.length} updates</span><span>${lag} lag</span></div></article>`}).join("")
}
function renderReports(){
  let rows=[...visibleWeekly()];const status=$("#reportStatus")?.value||"all",q=($("#reportFilter")?.value||"").toLowerCase(),mode=$("#reportMode")?.value||"teacher";
  if(status==="lagging")rows=rows.filter(x=>Number(x.lagPeriods||0)>0);if(status==="ontrack")rows=rows.filter(x=>Number(x.lagPeriods||0)===0);
  rows=rows.filter(x=>[x.week,x.section,x.department,x.subject,x.teacher,x.planned,x.actual,x.reason].join(" ").toLowerCase().includes(q));
  const key={teacher:"teacher",class:"section",subject:"subject",week:"week",department:"department"}[mode];rows.sort((a,b)=>String(a[key]||"").localeCompare(String(b[key]||"")));
  const lagEntries=rows.filter(x=>Number(x.lagPeriods||0)>0).length,totalLag=rows.reduce((n,x)=>n+Number(x.lagPeriods||0),0),classes=new Set(rows.map(x=>x.section)).size;
  $("#reportSummary").innerHTML=`<span class="summary-pill">Records <b>${rows.length}</b></span><span class="summary-pill">Classes <b>${classes}</b></span><span class="summary-pill">Lagging entries <b>${lagEntries}</b></span><span class="summary-pill">Periods lagging <b>${totalLag}</b></span>`;
  $("#reportTable").innerHTML=rows.length?rows.map(e=>`<tr><td>${esc(e.week)}</td><td>${esc(e.section)}</td><td>${esc(e.department)}</td><td>${esc(e.subject)}</td><td>${esc(e.teacher||"-")}</td><td>${esc(e.planned||"-")}</td><td>${esc(e.actual||"-")}</td><td>${e.lagPeriods||0}</td><td><span class="${statusClass(e)}">${statusOf(e)}</span></td></tr>`).join(""):'<tr><td colspan="9">No report data available.</td></tr>'
}
function exportReportCsv(){const rows=[["Week","Class","Department","Subject","Teacher","Week Start","Week End","Working Days","Planned Topic","Current Topic","Planned Periods","Periods Taken","Periods Lagging","Reason","Status"],...visibleWeekly().map(e=>[e.week,e.section,e.department,e.subject,e.teacher,e.startDate,e.endDate,e.workingDays,e.planned,e.actual,e.plannedPeriods,e.takenPeriods,e.lagPeriods,e.reason,statusOf(e)])];downloadBlob(toCsv(rows),"khalsa-syllabus-lagging-report.csv","text/csv")}

function renderDepartment(){
  if(currentUser?.role!=="HOD"){if($("#departmentMappings"))$("#departmentMappings").innerHTML='<div class="bulk-message">My Department is available to HOD accounts.</div>';return}
  const q=($("#departmentSearch")?.value||"").toLowerCase(),depts=userDepartments();
  const maps=data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&depts.includes(m.department)&&[m.teacher,m.section,m.subject,m.department].join(" ").toLowerCase().includes(q));
  const teachers=[...new Set(maps.map(m=>m.teacher))],sections=[...new Set(maps.map(m=>m.section))],lagRows=visibleWeekly().filter(x=>Number(x.lagPeriods||0)>0);
  $("#departmentSummary").innerHTML=`<span class="summary-pill">Department <b>${esc(depts.join(", "))}</b></span><span class="summary-pill">Handling teachers <b>${teachers.length}</b></span><span class="summary-pill">Authorised sections <b>${sections.length}</b></span><span class="summary-pill">Lagging records <b>${lagRows.length}</b></span>`;
  $("#departmentMappings").innerHTML=maps.length?maps.sort((a,b)=>a.teacher.localeCompare(b.teacher)||a.section.localeCompare(b.section)).map(m=>`<div class="user-row"><div class="initial">${esc(initials(m.teacher))}</div><div><strong>${esc(m.teacher)} · ${esc(m.subject)}</strong><small>${esc(m.section)} · ${esc(sectionMeta(m.section).batch)} · ${m.periodsPerWeek||0} periods/week${m.classTeacher?` · CT: ${esc(m.classTeacher)}`:""}</small></div><span class="soft-badge">${esc(m.department)}</span></div>`).join(""):'<div class="bulk-message">No handling mappings found for this department.</div>'
}

function initials(name){return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"U"}
function renderUsers(){
  if(!isAdmin()){return}
  const counts={};Object.keys(ROLE_META).forEach(r=>counts[r]=data.users.filter(u=>u.role===r).length);
  $("#roleCards").innerHTML=Object.entries(ROLE_META).map(([role,m])=>`<article class="role-card ${role==="Teacher"?"teacher":""}"><div class="role-top"><div class="role-icon ${role==="Teacher"?"green":""}">${m.code}</div><div><h3>${role}</h3><p>${m.description}</p></div></div><span class="role-count">${counts[role]||0} users</span></article>`).join("");
  renderScope();
  $("#userList").innerHTML=data.users.map(u=>`<div class="user-row"><div class="initial">${esc(initials(u.name))}</div><div><strong>${esc(u.name)} · ${esc(u.role)}</strong><small>@${esc(u.username)}${u.department?" · "+esc(u.department):""} · ${u.accessEnabled===false?"Access disabled":"Access active"}</small></div><div class="plan-actions"><button onclick="shareUser('${u.id}')">Share</button>${u.id==="u-super"?'<span class="soft-badge">Protected</span>':`<button onclick="toggleUser('${u.id}')">${u.accessEnabled===false?"Enable":"Disable"}</button><button class="danger" onclick="deleteUser('${u.id}')">Delete</button>`}</div></div>`).join("")
}
function renderScope(){
  const s=data.uiScope;$("#departmentCards").innerHTML=DEPARTMENT_ORDER.map(d=>choiceHtml("department",d,DEPARTMENTS[d].join(" · "),s.departments.includes(d))).join("");
  $("#scopeSections").innerHTML=SECTIONS.map(x=>choiceHtml("section",x.section,`${x.batch} · ${x.program}`,s.sections.includes(x.section))).join("");
  const visible=s.departments.length?[...new Set(s.departments.flatMap(d=>DEPARTMENTS[d]||[]))]:ALL_SUBJECTS;$("#scopeSubjects").innerHTML=visible.map(sub=>choiceHtml("subject",sub,departmentForSubject(sub),s.subjects.includes(sub))).join("");
  $$(".scope-choice").forEach(i=>i.onchange=scopeChanged)
}
function choiceHtml(type,value,sub,checked){return`<label class="choice-card ${checked?"selected":""}"><input class="scope-choice" type="checkbox" data-type="${type}" value="${esc(value)}" ${checked?"checked":""}><div><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>${checked?'<span class="tick">✓</span>':""}</label>`}
function scopeChanged(e){const {type}=e.target.dataset,key=type==="department"?"departments":type==="section"?"sections":"subjects",arr=new Set(data.uiScope[key]);e.target.checked?arr.add(e.target.value):arr.delete(e.target.value);data.uiScope[key]=[...arr];if(type==="department"){const allowed=new Set(data.uiScope.departments.flatMap(d=>DEPARTMENTS[d]||[]));data.uiScope.subjects=data.uiScope.subjects.filter(x=>allowed.size===0||allowed.has(x))}persist();renderScope()}
function selectAllDepartments(){data.uiScope.departments=[...DEPARTMENT_ORDER];persist();renderScope()}
function selectAllSubjects(){data.uiScope.subjects=data.uiScope.departments.length?[...new Set(data.uiScope.departments.flatMap(d=>DEPARTMENTS[d]||[]))]:[...ALL_SUBJECTS];persist();renderScope()}
function clearScope(){data.uiScope={departments:[],sections:[],subjects:[]};persist();renderScope()}
function quickSections(program){const set=new Set(data.uiScope.sections);SECTIONS.filter(x=>x.program===program).forEach(x=>set.add(x.section));data.uiScope.sections=[...set];persist();renderScope()}
function prefillNewUserFromTeacher(){
  const t=data.setup.teachers.find(t=>same(t.name,$("#newUserName").value));if(!t)return;if(t.department)$("#newUserDepartment").value=t.department;
  if($("#newUserRole").value!=="HOD")$("#newUserRole").value="Teacher"
}
function addUser(e){
  e.preventDefault();if(!isAdmin())return;
  const name=norm($("#newUserName").value),username=norm($("#newUsername").value),role=$("#newUserRole").value,department=$("#newUserDepartment").value;if(!name||!username)return;
  if(data.users.some(x=>same(x.username,username))){alert("Username already exists.");return}
  const maps=teacherMappingsFor(name),password=tempPassword();
  data.users.push({id:uid(),name,username,password,role,department,departments:role==="HOD"?[department]:[...new Set(maps.map(m=>m.department).filter(Boolean))],sections:[...new Set(maps.map(m=>m.section))],subjects:[...new Set(maps.map(m=>m.subject))],accessEnabled:true,mustChangePassword:true});
  persist();$("#userForm").reset();$("#userDialog").close();renderUsers();alert(`User created.\nUsername: ${username}\nTemporary password: ${password}\nUse Share to send login details.`)
}
window.shareUser=async id=>{
  if(!isAdmin())return;const u=data.users.find(x=>x.id===id);if(!u)return;
  const text=`Sri Chaitanya School – Khalsa CBSE Branch\nSyllabus Tracker Login\n\nName: ${u.name}\nUsername: ${u.username}\nPassword: ${u.password||"(reset required)"}\nApp Link: ${appLink()}\n\nPlease keep your login private.`;
  try{if(navigator.share){await navigator.share({title:"Khalsa Syllabus Tracker Login",text})}else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert("Login details copied. You can paste them in WhatsApp.")}else{prompt("Copy login details",text)}}catch(e){}
};
window.toggleUser=id=>{if(!isAdmin())return;const u=data.users.find(x=>x.id===id);if(!u)return;u.accessEnabled=u.accessEnabled===false;persist();renderUsers()};
window.deleteUser=id=>{if(!isAdmin())return;if(!confirm("Delete this staff login? Teacher master and handling mappings will remain."))return;data.users=data.users.filter(x=>x.id!==id);persist();renderUsers()};
