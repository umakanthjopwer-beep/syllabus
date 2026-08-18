// Final Weekly Status entry stability layer for all linked staff roles.
// Uses teacher_id as the authoritative handling link and always shows Week No + Monday-Saturday dates.
(function(){
  const ENTRY_ROLES=new Set(["Teacher","HOD","Admin","Super Admin"]);
  const WEEK1="2026-06-01";
  let lastEntryUserId="";

  function txt(v){return String(v??"").trim()}
  function activeEntryUser(){return!!currentUser&&ENTRY_ROLES.has(currentUser.role)&&!!currentUser.teacherId}
  function addDays(iso,n){const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  function fmtDate(iso){if(!iso)return"";return new Date(iso+"T00:00:00Z").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"})}
  function weekStartFromNo(n){return addDays(WEEK1,(Number(n)-1)*7)}
  function weekNoFromStart(start){if(!start)return 0;const a=new Date(WEEK1+"T00:00:00Z"),b=new Date(start+"T00:00:00Z");return Math.max(1,Math.floor((b-a)/(7*86400000))+1)}
  function fullWeekLabel(n,start,end){return`Week ${n} | ${fmtDate(start)} - ${fmtDate(end)}`}

  function enrichMappingIds(r){
    try{
      const byId=new Map((data.setup?.handlingMappings||[]).map(m=>[m.id,m]));
      for(const raw of r?.mappings||[]){const m=byId.get(raw.id);if(!m)continue;m.teacherId=raw.teacher_id||null;m.sectionId=raw.section_id||null;m.subjectId=raw.subject_id||null}
    }catch(e){}
  }
  if(typeof applyRemoteData==="function"){
    const previous=applyRemoteData;
    applyRemoteData=function(r){const out=previous(r);enrichMappingIds(r);return out}
  }

  function linkedMappings(){
    if(!activeEntryUser())return[];
    const tid=currentUser.teacherId;
    return(data.setup?.handlingMappings||[]).filter(m=>m.activeForSyllabus&&m.teacherId===tid)
  }

  // Replace remaining name-based Weekly Status scope for every staff entry role.
  if(typeof ownTeacherMappings==="function"){
    ownTeacherMappings=function(){return linkedMappings()}
  }
  if(typeof ownTeacherPairs==="function"){
    ownTeacherPairs=function(){return linkedMappings().map(m=>({section:m.section,subject:canonicalSubject(m.subject),department:m.department,teacher:m.teacher,teacherId:m.teacherId}))}
  }
  if(typeof ownTeacherSections==="function"){
    ownTeacherSections=function(){return[...new Set(linkedMappings().map(m=>m.section).filter(Boolean))]}
  }
  if(typeof ownTeacherSubjectsFor==="function"){
    ownTeacherSubjectsFor=function(section){return[...new Set(linkedMappings().filter(m=>m.section===section).map(m=>canonicalSubject(m.subject)).filter(Boolean))]}
  }

  function fillOptions(select,values,selected){
    if(!select)return;
    if(typeof fillSelect==="function"){fillSelect(select,values,selected);return}
    select.innerHTML=values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if(values.includes(selected))select.value=selected;else if(values.length)select.value=values[0]
  }

  function linkedTeacherName(){
    if(!currentUser?.teacherId)return currentUser?.name||"";
    const t=REMOTE?.teacherById?.get?REMOTE.teacherById.get(currentUser.teacherId):null;
    return t?.name||currentUser?.name||""
  }

  function clearManualDraft(){
    if(typeof WEEKLY_EDIT_ID!=="undefined"&&WEEKLY_EDIT_ID)return;
    if(typeof WEEKLY_EDIT_REENTRY!=="undefined"&&WEEKLY_EDIT_REENTRY)return;
    for(const id of ["wkTakenPeriods","wkLagPeriods","wkActual","wkReason"]){const el=document.getElementById(id);if(el)el.value=""}
  }

  function normalizeWeekOptions(){
    const sel=document.getElementById("wkWeek");if(!sel)return;
    const selected=sel.selectedOptions?.[0]||null;
    for(const op of [...sel.options]){
      let start=op.dataset.start||"",end=op.dataset.end||"",n=Number(op.dataset.weekNo||op.dataset.weekNo||0);
      if(!n){const m=String(op.value||op.textContent||"").match(/Week\s*(\d+)/i);if(m)n=Number(m[1])}
      if(!start&&n)start=weekStartFromNo(n);
      if(!end&&start)end=addDays(start,5);
      if(!n&&start)n=weekNoFromStart(start);
      if(start&&end&&n){const label=fullWeekLabel(n,start,end);op.dataset.start=start;op.dataset.end=end;op.dataset.weekNo=String(n);op.value=label;op.textContent=label}
    }
    const nowSelected=selected&&[...sel.options].includes(selected)?selected:sel.selectedOptions?.[0];
    if(nowSelected){sel.dataset.weekStart=nowSelected.dataset.start||"";sel.dataset.weekEnd=nowSelected.dataset.end||"";sel.dataset.weekNo=nowSelected.dataset.weekNo||String(weekNoFromStart(nowSelected.dataset.start||""))}
  }

  if(typeof renderCalendarWeekOptions==="function"){
    const previous=renderCalendarWeekOptions;
    renderCalendarWeekOptions=function(...args){const out=previous(...args);normalizeWeekOptions();return out}
  }

  function rebuildEntryForm(clearDraft=false){
    if(!activeEntryUser())return;
    const maps=linkedMappings(),sections=[...new Set(maps.map(m=>m.section).filter(Boolean))],sectionSel=document.getElementById("wkSection");
    if(!sections.length){
      if(sectionSel)sectionSel.innerHTML="";
      const status=document.getElementById("weeklyStatus");if(status){status.textContent="No active handling classes are linked to this staff account.";status.classList.add("error")}
      return
    }
    const oldSection=sectionSel?.value||"",chosen=sections.includes(oldSection)?oldSection:sections[0];
    fillOptions(sectionSel,sections,chosen);
    try{if(typeof updateWeeklySubjects==="function")updateWeeklySubjects()}catch(e){}
    const teacher=document.getElementById("wkTeacher");if(teacher){teacher.value=linkedTeacherName();teacher.readOnly=true;teacher.setAttribute("aria-readonly","true")}
    if(clearDraft)clearManualDraft();
    try{if(typeof fillWeeklyCalendarFromPlan==="function")fillWeeklyCalendarFromPlan(true);else if(typeof fillWeeklyFromPlan==="function")fillWeeklyFromPlan()}catch(e){console.warn("Weekly form rebuild",e)}
    normalizeWeekOptions();
    try{if(typeof applyWeeklyRuleEditability==="function")applyWeeklyRuleEditability()}catch(e){}
  }

  if(typeof fillWeeklyCalendarFromPlan==="function"){
    const previous=fillWeeklyCalendarFromPlan;
    fillWeeklyCalendarFromPlan=function(...args){const out=previous(...args);normalizeWeekOptions();return out}
  }

  function onEntryIdentityChange(){
    if(!activeEntryUser())return;
    const id=String(currentUser.id||currentUser.teacherId||"");const changed=id!==lastEntryUserId;lastEntryUserId=id;
    setTimeout(()=>rebuildEntryForm(changed),0)
  }

  if(typeof openApp==="function"){
    const previous=openApp;openApp=function(){const out=previous();onEntryIdentityChange();return out}
  }
  if(typeof reloadRemote==="function"){
    const previous=reloadRemote;reloadRemote=async function(){const out=await previous();onEntryIdentityChange();return out}
  }

  if(typeof init==="function"){
    const previous=init;init=function(){
      const out=previous();
      for(const id of ["wkReason","wkActual"]){const el=document.getElementById(id);if(el){el.setAttribute("autocomplete","off");el.setAttribute("data-lpignore","true")}}
      for(const id of ["wkSection","wkSubject","wkWeek"]){document.getElementById(id)?.addEventListener("change",()=>{if(!(typeof WEEKLY_EDIT_ID!=="undefined"&&WEEKLY_EDIT_ID)&&!(typeof WEEKLY_EDIT_REENTRY!=="undefined"&&WEEKLY_EDIT_REENTRY))clearManualDraft();setTimeout(normalizeWeekOptions,0)})}
      setTimeout(()=>{normalizeWeekOptions();onEntryIdentityChange()},0);return out
    }
  }
})();