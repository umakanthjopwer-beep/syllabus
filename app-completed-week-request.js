// Teacher/HOD request workflow for missed completed-week Weekly Status entries.
(function(){
  const LATE_ROLES=new Set(["Teacher","HOD"]);
  function txt(v){return String(v??"").trim()}
  function requests(){return Array.isArray(WEEKLY_ACCESS?.completedWeekRequests)?WEEKLY_ACCESS.completedWeekRequests:[]}
  function selectedWeek(){try{return selectedCalendarWeek()}catch(e){return null}}
  function lateRequestFor(start){return requests().find(r=>txt(r.week_start)===txt(start))||null}
  function approvedLate(start){return lateRequestFor(start)?.status==="approved"}
  function pendingLate(start){return lateRequestFor(start)?.status==="pending"}
  function isPastWeek(w){return!!w?.start&&w.start<currentSchoolWeekStart()}
  function selectedSavedExists(w){
    if(!w)return false;const section=document.getElementById("wkSection")?.value||"",subject=canonicalSubject(document.getElementById("wkSubject")?.value||"");
    if(!section||!subject)return false;
    try{return visibleWeekly().some(r=>r.startDate===w.start&&r.section===section&&canonicalSubject(r.subject)===subject)}catch(e){return false}
  }
  function prettyWeek(w){if(!w)return"";try{return`${new Date(w.start+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})} - ${new Date(w.end+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}`}catch(e){return`${w.start} - ${w.end}`}}
  function ensureStyles(){
    if(document.getElementById("completedWeekRequestStyles"))return;const s=document.createElement("style");s.id="completedWeekRequestStyles";s.textContent=`
      .completed-week-box{margin:0 0 14px;border:1px solid #d8e2ef;background:#f8fbff;border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between}.completed-week-box.pending{background:#fff8e8;border-color:#eed69b}.completed-week-box.approved{background:#edf9f2;border-color:#bce2cb}.completed-week-box.saved{background:#f6f7f9;border-color:#dfe3e8}.completed-week-box strong{display:block;font-size:12px;color:#26384d}.completed-week-box small{display:block;margin-top:3px;color:#697a90;line-height:1.35}.completed-week-box button{flex-shrink:0}
      @media(max-width:760px){.completed-week-box{align-items:stretch;flex-direction:column}.completed-week-box button{width:100%}}
    `;document.head.appendChild(s)
  }
  function ensureBox(){
    ensureStyles();const week=document.getElementById("wkWeek"),panel=week?.closest(".panel");if(!panel)return null;let box=document.getElementById("completedWeekRequestBox");if(!box){box=document.createElement("div");box.id="completedWeekRequestBox";box.className="completed-week-box";const form=panel.querySelector(".form-grid");panel.insertBefore(box,form||panel.firstChild)}return box
  }
  function renderCompletedWeekBox(){
    const box=ensureBox();if(!box)return;const w=selectedWeek(),role=currentUser?.role||"";
    if(!LATE_ROLES.has(role)||!isPastWeek(w)||WEEKLY_EDIT_REENTRY){box.classList.add("hidden");return}
    box.classList.remove("hidden","pending","approved","saved");const req=lateRequestFor(w.start),exists=selectedSavedExists(w);
    if(exists){box.classList.add("saved");box.innerHTML=`<div><strong>Completed week · saved record already exists</strong><small>${esc(prettyWeek(w))}. This request option is only for a missed entry. A saved past record can be changed only through the separate Admin Re-enter process.</small></div>`;return}
    if(req?.status==="approved"){box.classList.add("approved");box.innerHTML=`<div><strong>Completed-week entry approved</strong><small>${esc(prettyWeek(w))}. You can enter any missing assigned class/subject status for this approved week. Existing saved records remain locked.</small></div>`;return}
    if(req?.status==="pending"){box.classList.add("pending");box.innerHTML=`<div><strong>Completed-week entry request pending</strong><small>${esc(prettyWeek(w))}. Entry will remain locked until Branch Admin approves this request.</small></div><button class="outline-btn" disabled>Approval Pending</button>`;return}
    box.innerHTML=`<div><strong>Missed this completed week's syllabus status?</strong><small>${esc(prettyWeek(w))}. Send a request to Branch Admin. Approval will open only this completed week for your missing entries.</small></div><button id="requestCompletedWeekBtn" class="outline-btn">Request Completed Week Entry</button>`;
    document.getElementById("requestCompletedWeekBtn").onclick=requestCompletedWeekEntry
  }
  async function requestCompletedWeekEntry(){
    const w=selectedWeek(),btn=document.getElementById("requestCompletedWeekBtn");if(!w||!isPastWeek(w))return;if(btn)setBusy(btn,true,"Requesting…");
    try{WEEKLY_ACCESS=await weeklyAccessCall("request_completed_week",{week_start:w.start,week_end:w.end,note:"Missed completed-week syllabus status entry"});renderWeeklyAccessControl();renderCompletedWeekBox();applyWeeklyRuleEditability();setStatus("#weeklyStatus",`Request sent for ${prettyWeek(w)}. You can enter it after Branch Admin approval.`)}catch(e){setStatus("#weeklyStatus",e.message||String(e),true)}finally{if(btn)setBusy(btn,false)}
  }
  window.requestCompletedWeekEntry=requestCompletedWeekEntry;

  function enhanceAdminRequestLabels(){
    if(!weeklyController())return;const rows=[...document.querySelectorAll("#weeklyEntryAccessPanel .weekly-request-row")],items=WEEKLY_ACCESS?.pendingRequests||[];
    rows.forEach((row,i)=>{const r=items[i],small=row.querySelector("small");if(!r||!small)return;const when=new Date(r.requested_at).toLocaleString("en-IN");small.textContent=r.request_type==="completed_week"?`${r.user?.role||"Staff"} · COMPLETED WEEK ${r.week_start||""} to ${r.week_end||""} · requested ${when}`:`${r.user?.role||"Staff"} · GENERAL ENTRY ACCESS · requested ${when}`})
  }
  if(typeof renderWeeklyAccessControl==="function"){
    const previous=renderWeeklyAccessControl;renderWeeklyAccessControl=function(){const out=previous();enhanceAdminRequestLabels();renderCompletedWeekBox();return out}
  }
  if(typeof applyWeeklyRuleEditability==="function"){
    const previous=applyWeeklyRuleEditability;applyWeeklyRuleEditability=function(){previous();const w=selectedWeek(),late=!WEEKLY_EDIT_ID&&!WEEKLY_EDIT_REENTRY&&isPastWeek(w)&&approvedLate(w.start)&&!selectedSavedExists(w);if(late){for(const id of ["wkTakenPeriods","wkActual","wkLagPeriods","wkReason"]){const el=document.getElementById(id);if(el)el.disabled=false}const save=document.getElementById("saveWeeklyBtn");if(save)save.disabled=false;const form=document.querySelector("#weekly .panel .form-grid");if(form)form.classList.remove("weekly-entry-locked")}renderCompletedWeekBox()}
  }

  if(typeof saveWeekly==="function"){
    const previous=saveWeekly;saveWeekly=async function(){
      const w=selectedWeek();if(!w||WEEKLY_EDIT_ID||WEEKLY_EDIT_REENTRY||w.start===currentSchoolWeekStart())return previous();
      const btn=document.getElementById("saveWeeklyBtn");
      try{
        if(!approvedLate(w.start))throw new Error("This completed week is locked. Send a completed-week entry request and wait for approval.");
        const section=document.getElementById("wkSection")?.value||"",subject=canonicalSubject(document.getElementById("wkSubject")?.value||"");if(!section||!subject)throw new Error("Select the week, class and subject.");
        if(selectedSavedExists(w))throw new Error("A status is already saved for this class, subject and week. Ask Admin to use Re-enter if a correction is required.");
        const manual=weeklyMandatoryValues(),section_id=REMOTE.sectionIdByName.get(section),subject_id=REMOTE.subjectIdByName.get(subject);if(!section_id||!subject_id)throw new Error("Class/subject mapping was not found in the central database.");
        const teacher=handlingTeacher(section,subject)||norm(document.getElementById("wkTeacher")?.value),teacher_id=REMOTE.teacherIdByName.get(teacher)||null,{plan,rows}=planRowsFor(section,subject),agg=aggregateWeek(rows,w.start,w.end);
        setBusy(btn,true,"Saving completed week…");
        await weeklyAccessCall("save_weekly",{week_no:Number(agg.weekNo||document.getElementById("wkWeek")?.dataset.weekNo||0),week_label:w.label,section_id,subject_id,teacher_id,year_plan_id:plan?.id||null,week_start:w.start,week_end:w.end,working_days:agg.workingDays==null?null:Number(agg.workingDays),planned_periods:agg.plannedPeriods==null?0:Number(agg.plannedPeriods),periods_taken:manual.taken,periods_lagging:manual.lag,planned_topic:agg.topic||document.getElementById("wkPlanned")?.value||"",current_topic:manual.actual,reason:manual.reason});
        clearWeeklyManualFields();await reloadRemote();renderAll();renderCompletedWeekBox();applyWeeklyRuleEditability();setStatus("#weeklyStatus",`Completed-week status saved successfully for ${prettyWeek(w)}.`)
      }catch(e){setStatus("#weeklyStatus",e.message||String(e),true)}finally{setBusy(btn,false);updateWeeklyEditButton()}
    }
  }

  const previousRefresh=refreshWeeklyAccess;refreshWeeklyAccess=async function(showError=false){const out=await previousRefresh(showError);renderCompletedWeekBox();applyWeeklyRuleEditability();return out};
  const previousInit=init;init=function(){previousInit();for(const id of ["wkWeek","wkSection","wkSubject"]){document.getElementById(id)?.addEventListener("change",()=>setTimeout(()=>{renderCompletedWeekBox();applyWeeklyRuleEditability()},0))}setTimeout(renderCompletedWeekBox,0)};
})();
