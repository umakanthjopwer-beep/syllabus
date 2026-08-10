let WEEKLY_EDIT_ID=null;
let WEEKLY_EDIT_REENTRY=false;

function schoolTodayIso(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`
}
function addIsoDays(iso,n){const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function currentSchoolWeekStart(){const today=schoolTodayIso(),d=new Date(today+"T00:00:00Z"),back=(d.getUTCDay()+6)%7;return addIsoDays(today,-back)}
function selectedWeeklyStart(){try{return selectedCalendarWeek()?.start||document.getElementById("wkStart")?.value||""}catch(e){return document.getElementById("wkStart")?.value||""}}
function isCurrentWeeklyRow(row){return row?.startDate===currentSchoolWeekStart()}
function weeklyReentryIds(){return new Set(WEEKLY_ACCESS?.reentryIds||[])}
function isReentryRow(row){return!!row&&weeklyReentryIds().has(row.id)}
function currentWeekEntryAllowed(){return!!WEEKLY_ACCESS?.canEdit&&selectedWeeklyStart()===currentSchoolWeekStart()}

function ensureWeeklyRuleStyles(){
  if(document.getElementById("weeklyRuleStyles"))return;
  const st=document.createElement("style");st.id="weeklyRuleStyles";st.textContent=`
    .mandatory-note{margin:0 0 14px;padding:9px 12px;border-radius:9px;background:#fff8e8;color:#795713;font-size:12px;font-weight:700}
    .required-mark{color:#b42318;font-weight:900;margin-left:4px}.reentry-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#fff0e8;color:#9a4c15;font-size:10px;font-weight:900;margin-right:5px}
    .reentry-alert{border:1px solid #f0c39e;background:#fff9f4}.reentry-alert .weekly-access-head{align-items:center}.reentry-alert strong{color:#8a4314}
    .weekly-action-wrap{display:flex;gap:5px;flex-wrap:wrap;align-items:center}.weekly-view-only{font-size:10px;color:#8591a2;font-weight:700}
  `;document.head.appendChild(st)
}
function markWeeklyManualFieldsRequired(){
  ensureWeeklyRuleStyles();
  const ids=["wkTakenPeriods","wkActual","wkLagPeriods","wkReason"];
  for(const id of ids){
    const el=document.getElementById(id);if(!el)continue;el.required=true;
    const label=el.closest("label");if(label&&!label.querySelector(".required-mark")){const mark=document.createElement("span");mark.className="required-mark";mark.textContent=" *";mark.title="Mandatory";label.insertBefore(mark,el)}
  }
  const form=document.querySelector("#weekly .panel .form-grid");if(form&&!document.getElementById("weeklyMandatoryNote")){const note=document.createElement("div");note.id="weeklyMandatoryNote";note.className="mandatory-note full";note.textContent="* All editable fields are mandatory. Normal entry/edit is allowed only for the current week.";form.insertBefore(note,form.firstChild)}
}
function ensureWeeklyEditControls(){
  const save=document.getElementById("saveWeeklyBtn");if(!save)return;
  if(!document.getElementById("cancelWeeklyEditBtn")){const b=document.createElement("button");b.id="cancelWeeklyEditBtn";b.type="button";b.className="outline-btn hidden";b.textContent="Cancel Edit";b.onclick=cancelWeeklyEdit;save.before(b)}
}
function lockWeeklyIdentity(locked){for(const id of ["wkWeek","wkSection","wkSubject"]){const el=document.getElementById(id);if(el)el.disabled=!!locked}}
function clearWeeklyManualFields(){for(const id of ["wkTakenPeriods","wkLagPeriods"]){const el=document.getElementById(id);if(el)el.value=""}for(const id of ["wkActual","wkReason"]){const el=document.getElementById(id);if(el)el.value=""}}
function updateWeeklyEditButton(){
  ensureWeeklyEditControls();const save=document.getElementById("saveWeeklyBtn"),cancel=document.getElementById("cancelWeeklyEditBtn");if(!save)return;
  save.textContent=WEEKLY_EDIT_ID?(WEEKLY_EDIT_REENTRY?"Resubmit Re-entry":"Update Weekly Status"):"Save Weekly Status";
  cancel?.classList.toggle("hidden",!WEEKLY_EDIT_ID)
}
function applyWeeklyRuleEditability(){
  const allow=WEEKLY_EDIT_REENTRY||currentWeekEntryAllowed();
  const ids=["wkTakenPeriods","wkActual","wkLagPeriods","wkReason"];
  for(const id of ids){const el=document.getElementById(id);if(el)el.disabled=!allow}
  const save=document.getElementById("saveWeeklyBtn");if(save)save.disabled=!allow;
  const form=document.querySelector("#weekly .panel .form-grid");if(form)form.classList.toggle("weekly-entry-locked",!allow);
  updateWeeklyEditButton()
}
const _ruleBaseEnable=setWeeklyEntryFieldsEnabled;
setWeeklyEntryFieldsEnabled=function(){applyWeeklyRuleEditability()};

function fillSavedWeeklyIntoForm(row){
  const section=document.getElementById("wkSection"),subject=document.getElementById("wkSubject"),week=document.getElementById("wkWeek");
  if(section){section.value=row.section;updateWeeklySubjects()}
  if(subject)subject.value=row.subject;
  try{fillWeeklyCalendarFromPlan(false)}catch(e){try{fillWeeklyFromPlan()}catch(_){}}
  let op=week?[...week.options].find(o=>(o.dataset.start||"")===row.startDate):null;
  if(week&&!op){op=document.createElement("option");op.value=row.week;op.textContent=row.week;op.dataset.start=row.startDate||"";op.dataset.end=row.endDate||"";week.appendChild(op)}
  if(week&&op){week.value=op.value;week.dataset.weekStart=row.startDate||"";week.dataset.weekEnd=row.endDate||""}
  try{fillWeeklyCalendarFromPlan(true)}catch(e){}
  if(document.getElementById("wkStart"))document.getElementById("wkStart").value=row.startDate||"";
  if(document.getElementById("wkEnd"))document.getElementById("wkEnd").value=row.endDate||"";
  if(document.getElementById("wkDays")&&!document.getElementById("wkDays").value)document.getElementById("wkDays").value=row.workingDays??"";
  if(document.getElementById("wkPlannedPeriods")&&!document.getElementById("wkPlannedPeriods").value)document.getElementById("wkPlannedPeriods").value=row.plannedPeriods??"";
  if(document.getElementById("wkPlanned")&&!document.getElementById("wkPlanned").value)document.getElementById("wkPlanned").value=row.planned||"";
  if(document.getElementById("wkTeacher"))document.getElementById("wkTeacher").value=row.teacher||handlingTeacher(row.section,row.subject)||"";
  document.getElementById("wkTakenPeriods").value=String(row.takenPeriods??"");document.getElementById("wkLagPeriods").value=String(row.lagPeriods??"");document.getElementById("wkActual").value=row.actual||"";document.getElementById("wkReason").value=row.reason||"";
}
window.editWeeklyRecord=function(id,reentry=false){
  const row=visibleWeekly().find(x=>x.id===id);if(!row)return;
  const requested=isReentryRow(row);
  if(reentry&&!requested){setStatus("#weeklyStatus","This re-entry request is no longer active.",true);return}
  if(!reentry&&(!isCurrentWeeklyRow(row)||!WEEKLY_ACCESS?.canEdit)){setStatus("#weeklyStatus","Only current-week saved entries can be edited while the entry window is open.",true);return}
  WEEKLY_EDIT_ID=id;WEEKLY_EDIT_REENTRY=!!reentry;fillSavedWeeklyIntoForm(row);lockWeeklyIdentity(true);applyWeeklyRuleEditability();
  setStatus("#weeklyStatus",reentry?"Re-entry correction opened. Correct all mandatory fields and resubmit.":"Current-week saved entry opened for editing.");
  document.querySelector("#weekly .panel .form-grid")?.scrollIntoView({behavior:"smooth",block:"start"})
};
function cancelWeeklyEdit(){WEEKLY_EDIT_ID=null;WEEKLY_EDIT_REENTRY=false;lockWeeklyIdentity(false);clearWeeklyManualFields();try{fillWeeklyCalendarFromPlan(false)}catch(e){}applyWeeklyRuleEditability();setStatus("#weeklyStatus","")}
window.cancelWeeklyEdit=cancelWeeklyEdit;

window.requestWeeklyReentry=async function(id){
  if(!weeklyController())return;const row=visibleWeekly().find(x=>x.id===id);if(!row)return;
  if(!confirm(`Ask ${row.teacher||"the handling teacher"} to re-enter this saved weekly status?`))return;
  try{WEEKLY_ACCESS=await weeklyAccessCall("request_reentry",{weekly_id:id});renderWeeklyAccessControl();renderWeekly();renderWeeklyReentryNotice();setStatus("#weeklyStatus",`Re-entry requested from ${row.teacher||"the handling teacher"}.`)}catch(e){setStatus("#weeklyStatus",e.message,true)}
};

function weeklyActionHtml(e){
  const requested=isReentryRow(e),current=isCurrentWeeklyRow(e),controller=weeklyController();const a=[];
  if(controller){
    if(current&&WEEKLY_ACCESS?.canEdit)a.push(`<button class="table-action" onclick="editWeeklyRecord('${e.id}',false)">Edit</button>`);
    if(requested)a.push(`<span class="reentry-badge">Re-entry requested</span>`);else a.push(`<button class="table-action" onclick="requestWeeklyReentry('${e.id}')">Re-enter</button>`);
    a.push(`<button class="table-action" onclick="deleteWeekly('${e.id}')">Delete</button>`)
  }else if(requested){a.push(`<button class="primary" onclick="editWeeklyRecord('${e.id}',true)">Re-enter now</button>`)}
  else if(current&&WEEKLY_ACCESS?.canEdit&&canSubmitWeekly(e.section,e.subject)){a.push(`<button class="table-action" onclick="editWeeklyRecord('${e.id}',false)">Edit</button>`)}
  else a.push(`<span class="weekly-view-only">View only</span>`);
  return `<div class="weekly-action-wrap">${a.join("")}</div>`
}
renderWeekly=function(){
  const q=(document.getElementById("weeklySearch")?.value||"").toLowerCase();const rows=visibleWeekly().filter(e=>[e.week,e.section,e.subject,e.teacher,e.planned,e.actual,e.reason].join(" ").toLowerCase().includes(q));
  document.getElementById("weeklyTable").innerHTML=rows.length?rows.slice(0,200).map(e=>`<tr><td>${esc(e.week)}${isReentryRow(e)?'<br><span class="reentry-badge">RE-ENTRY REQUIRED</span>':''}</td><td>${esc(e.section)}</td><td>${esc(e.subject)}</td><td>${esc(e.teacher||"-")}</td><td>${e.plannedPeriods||0}</td><td>${e.takenPeriods||0}</td><td>${e.lagPeriods||0}</td><td><span class="${statusClass(e)}">${statusOf(e)}</span></td><td>${weeklyActionHtml(e)}</td></tr>`).join(""):'<tr><td colspan="9">No weekly status records yet.</td></tr>'
};

function renderWeeklyReentryNotice(){
  ensureWeeklyRuleStyles();const dashboard=document.getElementById("dashboard");if(!dashboard)return;let box=document.getElementById("weeklyReentryAlert");
  const ids=[...(WEEKLY_ACCESS?.reentryIds||[])];if(weeklyController()||!ids.length){box?.remove();return}
  if(!box){box=document.createElement("div");box.id="weeklyReentryAlert";box.className="panel reentry-alert";dashboard.querySelector(".page-head")?.insertAdjacentElement("afterend",box)}
  const first=ids[0];box.innerHTML=`<div class="weekly-access-head"><div><div class="eyebrow">ACTION REQUIRED</div><h3 style="margin:4px 0"><strong>Weekly status re-entry required</strong></h3><p class="weekly-access-note">Admin has returned ${ids.length} saved ${ids.length===1?"entry":"entries"} for correction. Open the record, fill all mandatory fields and resubmit.</p></div><button id="openFirstReentry" class="primary">Open Re-entry</button></div>`;
  document.getElementById("openFirstReentry").onclick=()=>{showView("weekly");setTimeout(()=>editWeeklyRecord(first,true),50)}
}

function weeklyMandatoryValues(){
  const taken=document.getElementById("wkTakenPeriods")?.value?.trim()||"",lag=document.getElementById("wkLagPeriods")?.value?.trim()||"",actual=norm(document.getElementById("wkActual")?.value),reason=norm(document.getElementById("wkReason")?.value);const missing=[];
  if(taken==="")missing.push("Periods Taken");if(lag==="")missing.push("Periods Lagging");if(!actual)missing.push("Topic currently taught");if(!reason)missing.push("Reason for lag / status");
  if(missing.length)throw new Error(`Fill all mandatory fields: ${missing.join(", ")}.`);if(Number(taken)<0||Number(lag)<0)throw new Error("Periods Taken and Periods Lagging cannot be negative.");return{taken:Number(taken),lag:Number(lag),actual,reason}
}
saveWeekly=async function(){
  const btn=document.getElementById("saveWeeklyBtn");
  try{
    const section=document.getElementById("wkSection")?.value||"",subject=canonicalSubject(document.getElementById("wkSubject")?.value||""),w=selectedCalendarWeek();if(!section||!subject||!w)throw new Error("Select the week, class and subject.");
    if(!WEEKLY_EDIT_REENTRY&&w.start!==currentSchoolWeekStart())throw new Error("Only the current week can be entered or edited. Previous weeks are view-only unless Admin requests Re-enter.");
    const manual=weeklyMandatoryValues(),section_id=REMOTE.sectionIdByName.get(section),subject_id=REMOTE.subjectIdByName.get(subject);if(!section_id||!subject_id)throw new Error("Class/subject mapping was not found in the central database.");
    const teacher=handlingTeacher(section,subject)||norm(document.getElementById("wkTeacher")?.value),teacher_id=REMOTE.teacherIdByName.get(teacher)||null,{plan,rows}=planRowsFor(section,subject),agg=aggregateWeek(rows,w.start,w.end);
    setBusy(btn,true,WEEKLY_EDIT_ID?(WEEKLY_EDIT_REENTRY?"Resubmitting…":"Updating…"):"Saving…");
    await weeklyAccessCall("save_weekly",{id:WEEKLY_EDIT_ID||undefined,week_no:Number(agg.weekNo||document.getElementById("wkWeek")?.dataset.weekNo||0),week_label:w.label,section_id,subject_id,teacher_id,year_plan_id:plan?.id||null,week_start:w.start,week_end:w.end,working_days:agg.workingDays==null?null:Number(agg.workingDays),planned_periods:agg.plannedPeriods==null?0:Number(agg.plannedPeriods),periods_taken:manual.taken,periods_lagging:manual.lag,planned_topic:agg.topic||document.getElementById("wkPlanned")?.value||"",current_topic:manual.actual,reason:manual.reason});
    const wasReentry=WEEKLY_EDIT_REENTRY;WEEKLY_EDIT_ID=null;WEEKLY_EDIT_REENTRY=false;lockWeeklyIdentity(false);clearWeeklyManualFields();await reloadRemote();renderAll();renderWeeklyReentryNotice();applyWeeklyRuleEditability();setStatus("#weeklyStatus",wasReentry?"Re-entry corrected and resubmitted successfully.":"Weekly status saved successfully.")
  }catch(e){setStatus("#weeklyStatus",e.message||String(e),true)}finally{setBusy(btn,false);updateWeeklyEditButton()}
};

const _rulesRefreshWeeklyAccess=refreshWeeklyAccess;
refreshWeeklyAccess=async function(showError=false){const r=await _rulesRefreshWeeklyAccess(showError);renderWeekly();renderWeeklyReentryNotice();applyWeeklyRuleEditability();return r};
const _rulesInit=init;
init=function(){_rulesInit();markWeeklyManualFieldsRequired();ensureWeeklyEditControls();for(const id of ["wkWeek","wkSection","wkSubject"]){document.getElementById(id)?.addEventListener("change",()=>{if(!WEEKLY_EDIT_ID)setTimeout(applyWeeklyRuleEditability,0)})}applyWeeklyRuleEditability()};
