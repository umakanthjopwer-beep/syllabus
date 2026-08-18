// Stable Weekly Status repair for all linked staff roles.
// Uses teacher_id as the primary handling link, clears stale cross-user drafts,
// and always shows Week No + Monday-Saturday dates.
(function(){
  const ENTRY_ROLES=new Set(["Teacher","HOD","Admin","Super Admin"]);
  const WEEK1="2026-06-01";
  let lastEntryIdentity="";

  function text(v){return String(v??"").trim()}
  function normText(v){return text(v).toLowerCase().replace(/\s+/g," ")}
  function teacherNameMatches(a,b){
    const x=normText(a),y=normText(b);if(!x||!y)return false;if(x===y)return true;
    const xa=x.split(" "),ya=y.split(" "),xl=xa[xa.length-1],yl=ya[ya.length-1];
    return x.endsWith(" "+y)||y.endsWith(" "+x)||xl===y||yl===x||xl===yl
  }
  function canUseOwnEntry(){return!!currentUser&&ENTRY_ROLES.has(currentUser.role)&&!!currentUser.teacherId}
  function addDays(iso,n){const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  function weekStartFromNo(n){return addDays(WEEK1,(Number(n)-1)*7)}
  function weekNoFromStart(start){if(!start)return 0;const a=new Date(WEEK1+"T00:00:00Z"),b=new Date(start+"T00:00:00Z");return Math.max(1,Math.floor((b-a)/(7*86400000))+1)}
  function fmtDate(iso){if(!iso)return"";return new Date(iso+"T00:00:00Z").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"})}
  function fullWeekLabel(n,start,end){return`Week ${n} | ${fmtDate(start)} - ${fmtDate(end)}`}

  function enrichHandlingIds(r){
    try{
      const byId=new Map((data.setup?.handlingMappings||[]).map(m=>[m.id,m]));
      for(const raw of r?.mappings||[]){const m=byId.get(raw.id);if(!m)continue;m.teacherId=raw.teacher_id||null;m.sectionId=raw.section_id||null;m.subjectId=raw.subject_id||null}
    }catch(e){}
  }
  if(typeof applyRemoteData==="function"){
    const prev=applyRemoteData;
    applyRemoteData=function(r){const out=prev(r);enrichHandlingIds(r);return out}
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

  function clearWeeklyDraft(){
    if(typeof WEEKLY_EDIT_ID!=="undefined"&&WEEKLY_EDIT_ID)return;
    if(typeof WEEKLY_EDIT_REENTRY!=="undefined"&&WEEKLY_EDIT_REENTRY)return;
    for(const id of ["wkTakenPeriods","wkLagPeriods","wkActual","wkReason"]){const el=document.getElementById(id);if(el){el.value="";el.setAttribute("autocomplete","off")}}
  }

  function normalizeWeekOptions(){
    const sel=document.getElementById("wkWeek");if(!sel)return;
    const selected=sel.selectedOptions?.[0]||null;
    for(const op of [...sel.options]){
      let start=op.dataset.start||"",end=op.dataset.end||"",n=Number(op.dataset.weekNo||0);
      if(!n){const m=String(op.value||op.textContent||"").match(/Week\s*(\d+)/i);if(m)n=Number(m[1])}
      if(!start&&n)start=weekStartFromNo(n);
      if(!end&&start)end=addDays(start,5);
      if(!n&&start)n=weekNoFromStart(start);
      if(start&&end&&n){const label=fullWeekLabel(n,start,end);op.dataset.start=start;op.dataset.end=end;op.dataset.weekNo=String(n);op.value=label;op.textContent=label}
    }
    const op=selected&&[...sel.options].includes(selected)?selected:sel.selectedOptions?.[0];
    if(op){sel.dataset.weekStart=op.dataset.start||"";sel.dataset.weekEnd=op.dataset.end||"";sel.dataset.weekNo=op.dataset.weekNo||String(weekNoFromStart(op.dataset.start||""))}
  }

  if(typeof renderCalendarWeekOptions==="function"){
    const prev=renderCalendarWeekOptions;
    renderCalendarWeekOptions=function(...args){const out=prev(...args);normalizeWeekOptions();return out}
  }

  function repairWeeklyForm(clearDraft=false){
    if(!canUseOwnEntry())return;
    const sections=typeof ownTeacherSections==="function"?ownTeacherSections():[];
    const sectionSel=document.getElementById("wkSection");
    if(sectionSel){
      const old=sectionSel.value||"",selected=sections.includes(old)?old:(sections[0]||"");
      if(typeof fillSelect==="function")fillSelect(sectionSel,sections,selected)
    }
    try{if(typeof updateWeeklySubjects==="function")updateWeeklySubjects()}catch(e){}
    const teacher=document.getElementById("wkTeacher"),linked=currentUser?.teacherId&&REMOTE?.teacherById?.get?REMOTE.teacherById.get(currentUser.teacherId):null;
    if(teacher){teacher.value=linked?.name||currentUser?.name||"";teacher.readOnly=true;teacher.setAttribute("aria-readonly","true")}
    if(clearDraft)clearWeeklyDraft();
    try{if(sections.length&&typeof fillWeeklyFromPlan==="function")fillWeeklyFromPlan()}catch(e){console.warn("Weekly form repair",e)}
    normalizeWeekOptions();
    try{if(typeof applyWeeklyRuleEditability==="function")applyWeeklyRuleEditability()}catch(e){}
  }

  function scheduleRepair(){
    if(!canUseOwnEntry())return;
    const key=String(currentUser.id||currentUser.teacherId||"");const changed=key!==lastEntryIdentity;lastEntryIdentity=key;
    setTimeout(()=>repairWeeklyForm(changed),0)
  }

  if(typeof openApp==="function"){
    const prev=openApp;openApp=function(){const out=prev();scheduleRepair();return out}
  }
  if(typeof reloadRemote==="function"){
    const prev=reloadRemote;reloadRemote=async function(){const out=await prev();scheduleRepair();return out}
  }
  if(typeof init==="function"){
    const prev=init;
    init=function(){
      const out=prev();
      for(const id of ["wkReason","wkActual"]){const el=document.getElementById(id);if(el){el.setAttribute("autocomplete","off");el.setAttribute("data-lpignore","true")}}
      document.getElementById("wkWeek")?.addEventListener("change",()=>setTimeout(normalizeWeekOptions,0));
      setTimeout(normalizeWeekOptions,0);
      return out
    }
  }
})();