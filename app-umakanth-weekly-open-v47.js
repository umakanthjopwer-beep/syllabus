// Permanent personal Weekly/Lagging entry for J Umakanth only.
// Keeps the normal completed-week request/re-entry workflow unchanged for every other user.
(function(){
  const OWNER_USERNAME="umakanth";
  const OWNER_EMPLOYEE_CODE="HYD263425S";
  const clean=v=>String(v??"").trim();

  function permanentOwner(){
    if(!currentUser)return false;
    const username=clean(currentUser.username).toLowerCase();
    const code=clean(currentUser.employeeCode||currentUser.employee_code).toUpperCase();
    return username===OWNER_USERNAME&&(code===OWNER_EMPLOYEE_CODE||!code);
  }
  function ownerMappings(){
    try{return typeof ownTeacherMappings==="function"?ownTeacherMappings():[]}catch(e){return[]}
  }
  function ownerPair(section,subject){
    const sub=canonicalSubject(subject||"");
    return ownerMappings().some(m=>m.section===section&&canonicalSubject(m.subject)===sub)
  }
  function ownerRow(row){return!!row&&ownerPair(row.section,row.subject)}
  function notFutureWeek(){
    try{const s=selectedWeeklyStart();return!!s&&s<=currentSchoolWeekStart()}catch(e){return false}
  }
  window.isPermanentPersonalWeeklyUser=permanentOwner;

  const baseCurrentWeekEntryAllowed=typeof currentWeekEntryAllowed==="function"?currentWeekEntryAllowed:null;
  currentWeekEntryAllowed=function(){
    if(permanentOwner())return notFutureWeek();
    return baseCurrentWeekEntryAllowed?baseCurrentWeekEntryAllowed():false
  };

  const baseRenderWeeklyAccessControl=typeof renderWeeklyAccessControl==="function"?renderWeeklyAccessControl:null;
  if(baseRenderWeeklyAccessControl){
    renderWeeklyAccessControl=function(){
      const out=baseRenderWeeklyAccessControl();
      if(permanentOwner()){
        const box=document.getElementById("weeklyEntryAccessPanel");
        const state=box?.querySelector(".weekly-access-state");
        if(state){state.className="weekly-access-state personal";state.textContent="YOUR ENTRY ALWAYS OPEN"}
        const note=box?.querySelector(".weekly-access-note");
        if(note)note.textContent="Your own syllabus lagging report stays open for current and completed weeks. No edit/re-entry request is required for your own mapped classes.";
        try{applyWeeklyRuleEditability()}catch(e){}
      }
      return out
    }
  }

  const baseEditWeeklyRecord=window.editWeeklyRecord;
  window.editWeeklyRecord=function(id,reentry=false){
    const row=visibleWeekly().find(x=>x.id===id);
    if(permanentOwner()&&ownerRow(row)){
      WEEKLY_EDIT_ID=id;WEEKLY_EDIT_REENTRY=false;
      fillSavedWeeklyIntoForm(row);lockWeeklyIdentity(true);applyWeeklyRuleEditability();
      setStatus("#weeklyStatus","Your personal weekly entry is permanently open. Update the required fields and save.");
      document.querySelector("#weekly .panel .form-grid")?.scrollIntoView({behavior:"smooth",block:"start"});
      return
    }
    return baseEditWeeklyRecord(id,reentry)
  };

  const baseWeeklyActionHtml=typeof weeklyActionHtml==="function"?weeklyActionHtml:null;
  if(baseWeeklyActionHtml){
    weeklyActionHtml=function(e){
      if(permanentOwner()&&ownerRow(e)){
        return `<div class="weekly-action-wrap"><button class="table-action" onclick="editWeeklyRecord('${e.id}',false)">Edit</button>${weeklyController()?`<button class="table-action" onclick="deleteWeekly('${e.id}')">Delete</button>`:""}</div>`
      }
      return baseWeeklyActionHtml(e)
    }
  }

  const baseSaveWeekly=saveWeekly;
  saveWeekly=async function(){
    if(!permanentOwner())return baseSaveWeekly();
    const btn=document.getElementById("saveWeeklyBtn");
    try{
      const section=document.getElementById("wkSection")?.value||"";
      const subject=canonicalSubject(document.getElementById("wkSubject")?.value||"");
      const w=selectedCalendarWeek();
      if(!section||!subject||!w)throw new Error("Select the week, class and subject.");
      if(!ownerPair(section,subject))throw new Error("Only your own handling class-subject combinations can be entered here.");
      if(w.start>currentSchoolWeekStart())throw new Error("Future weeks cannot be entered before they begin.");
      const manual=weeklyMandatoryValues();
      const section_id=REMOTE.sectionIdByName.get(section),subject_id=REMOTE.subjectIdByName.get(subject);
      if(!section_id||!subject_id)throw new Error("Class/subject mapping was not found in the central database.");
      const mapping=ownerMappings().find(m=>m.section===section&&canonicalSubject(m.subject)===subject);
      const teacher=mapping?.teacher||(typeof loggedTeacherAlias==="function"?loggedTeacherAlias():clean(document.getElementById("wkTeacher")?.value));
      const teacher_id=mapping?.teacherId||currentUser?.teacherId||REMOTE.teacherIdByName.get(teacher)||null;
      const {plan,rows}=planRowsFor(section,subject),agg=aggregateWeek(rows,w.start,w.end);
      setBusy(btn,true,WEEKLY_EDIT_ID?"Updating…":"Saving…");
      await weeklyAccessCall("save_weekly",{
        id:WEEKLY_EDIT_ID||undefined,
        week_no:Number(agg.weekNo||document.getElementById("wkWeek")?.dataset.weekNo||0),week_label:w.label,
        section_id,subject_id,teacher_id,year_plan_id:plan?.id||null,week_start:w.start,week_end:w.end,
        working_days:agg.workingDays==null?null:Number(agg.workingDays),planned_periods:agg.plannedPeriods==null?0:Number(agg.plannedPeriods),
        periods_taken:manual.taken,periods_lagging:manual.lag,planned_topic:agg.topic||document.getElementById("wkPlanned")?.value||"",
        current_topic:manual.actual,reason:manual.reason
      });
      WEEKLY_EDIT_ID=null;WEEKLY_EDIT_REENTRY=false;lockWeeklyIdentity(false);clearWeeklyManualFields();
      await reloadRemote();renderAll();renderWeeklyReentryNotice();applyWeeklyRuleEditability();
      setStatus("#weeklyStatus","Your weekly status was saved successfully.")
    }catch(e){setStatus("#weeklyStatus",e.message||String(e),true)}finally{setBusy(btn,false);updateWeeklyEditButton()}
  };

  function refreshPersonalNote(){
    if(!permanentOwner())return;
    const n=document.getElementById("weeklyMandatoryNote");
    if(n)n.textContent="* All editable fields are mandatory. Your own current and completed weeks remain permanently open; future weeks stay locked until they begin.";
    try{applyWeeklyRuleEditability()}catch(e){}
  }
  const baseOpenApp=openApp;
  openApp=function(){const r=baseOpenApp();setTimeout(refreshPersonalNote,0);return r};
  const baseShowView=showView;
  showView=function(id){const r=baseShowView(id);if(id==="weekly")setTimeout(refreshPersonalNote,0);return r};
})();
