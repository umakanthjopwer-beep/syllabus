// Repair Teacher/HOD Weekly Status scope using teacher_id first and clear stale draft values.
(function(){
  function normText(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ")}
  function teacherNameMatches(a,b){
    const x=normText(a),y=normText(b);if(!x||!y)return false;if(x===y)return true;
    const xa=x.split(" "),ya=y.split(" "),xl=xa[xa.length-1],yl=ya[ya.length-1];
    return x.endsWith(" "+y)||y.endsWith(" "+x)||xl===y||yl===x||xl===yl
  }
  function enrichHandlingIds(r){
    try{
      const byId=new Map((data.setup?.handlingMappings||[]).map(m=>[m.id,m]));
      for(const raw of r?.mappings||[]){const m=byId.get(raw.id);if(!m)continue;m.teacherId=raw.teacher_id||null;m.sectionId=raw.section_id||null;m.subjectId=raw.subject_id||null}
    }catch(e){}
  }
  if(typeof applyRemoteData==="function"){
    const prev=applyRemoteData;applyRemoteData=function(r){const out=prev(r);enrichHandlingIds(r);return out}
  }
  if(typeof ownTeacherMappings==="function"){
    ownTeacherMappings=function(){
      if(typeof canEnterOwnWeekly==="function"&&!canEnterOwnWeekly())return[];
      const all=(data.setup?.handlingMappings||[]).filter(m=>m.activeForSyllabus),tid=currentUser?.teacherId||"";
      if(tid){const exact=all.filter(m=>m.teacherId===tid);if(exact.length)return exact}
      const linked=tid&&REMOTE?.teacherById?.get?REMOTE.teacherById.get(tid):null;
      const names=[linked?.name,currentUser?.name].filter(Boolean);
      return all.filter(m=>names.some(n=>teacherNameMatches(n,m.teacher)))
    }
  }
  function clearTeacherWeeklyDraft(){
    if(currentUser?.role!=="Teacher")return;
    for(const id of ["wkTakenPeriods","wkLagPeriods","wkReason"]){const el=document.getElementById(id);if(el)el.value=""}
    const actual=document.getElementById("wkActual");if(actual)actual.value="";
    for(const id of ["wkTakenPeriods","wkLagPeriods","wkReason","wkActual"]){const el=document.getElementById(id);if(el)el.setAttribute("autocomplete","off")}
  }
  function repairTeacherWeeklyForm(){
    if(currentUser?.role!=="Teacher")return;
    clearTeacherWeeklyDraft();
    const sections=typeof ownTeacherSections==="function"?ownTeacherSections():[];
    const sectionSel=document.getElementById("wkSection");
    if(sectionSel){
      const old=sectionSel.value||"",selected=sections.includes(old)?old:(sections[0]||"");
      if(typeof fillSelect==="function")fillSelect(sectionSel,sections,selected)
    }
    try{if(typeof updateWeeklySubjects==="function")updateWeeklySubjects()}catch(e){}
    const teacher=document.getElementById("wkTeacher");
    if(teacher){const linked=currentUser?.teacherId&&REMOTE?.teacherById?.get?REMOTE.teacherById.get(currentUser.teacherId):null;teacher.value=linked?.name||currentUser?.name||""}
    try{if(sections.length&&typeof fillWeeklyFromPlan==="function")fillWeeklyFromPlan()}catch(e){}
    try{if(typeof applyWeeklyRuleEditability==="function")applyWeeklyRuleEditability()}catch(e){}
  }
  if(typeof openApp==="function"){
    const prev=openApp;openApp=function(){const out=prev();setTimeout(repairTeacherWeeklyForm,0);return out}
  }
  if(typeof reloadRemote==="function"){
    const prev=reloadRemote;reloadRemote=async function(){const out=await prev();setTimeout(repairTeacherWeeklyForm,0);return out}
  }
  if(typeof init==="function"){
    const prev=init;init=function(){const out=prev();for(const id of ["wkReason","wkActual"]){document.getElementById(id)?.setAttribute("autocomplete","off")}return out}
  }
})();