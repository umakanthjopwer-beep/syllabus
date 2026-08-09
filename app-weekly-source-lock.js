function lockYearPlanField(id, sourceMissing=false){
  const el=document.getElementById(id);if(!el)return;
  el.readOnly=true;el.setAttribute("aria-readonly","true");el.style.background="#f7f9fc";el.style.cursor="default";
  if(["wkStart","wkEnd"].includes(id))el.style.pointerEvents="none";
  if(id==="wkPlannedPeriods")el.placeholder=sourceMissing?"Not given in Year Plan":"";
}
function ensureYearPlanSourceNote(){
  if(document.getElementById("yearPlanSourceNote"))return;
  const planned=document.getElementById("wkPlanned");if(!planned)return;
  const note=document.createElement("div");note.id="yearPlanSourceNote";note.className="small-muted";note.style.marginTop="6px";note.style.fontSize="10px";note.style.fontWeight="700";note.style.color="#54708f";
  planned.insertAdjacentElement("afterend",note);
}
function applyYearPlanSourceLock(){
  const section=document.getElementById("wkSection")?.value,subject=canonicalSubject(document.getElementById("wkSubject")?.value||""),week=document.getElementById("wkWeek")?.value;
  const found=section&&subject?planRowsFor(section,subject):{plan:null,rows:[]};
  const wr=found.rows.find(x=>x.weekLabel===week)||found.rows[0]||null;
  for(const id of ["wkTeacher","wkStart","wkEnd","wkDays","wkPlannedPeriods","wkPlanned"])lockYearPlanField(id,id==="wkPlannedPeriods"&&wr?.plannedPeriods==null);
  ensureYearPlanSourceNote();
  const note=document.getElementById("yearPlanSourceNote");
  if(note)note.textContent=found.plan?`Auto-filled from Year Plan: ${found.plan.fileName}${wr?.plannedPeriods==null?" · Planned Periods not provided in source file":""}`:"No published Year Plan row found for this class and subject.";
}
const _sourceFillWeeklyFromPlan=fillWeeklyFromPlan;
fillWeeklyFromPlan=function(){
  _sourceFillWeeklyFromPlan();
  applyYearPlanSourceLock();
};

// Save all planned fields from the selected Year Plan row itself, never from teacher-editable text.
saveWeekly=async function(){
  const section=$("#wkSection").value,subject=canonicalSubject($("#wkSubject").value),btn=$("#saveWeeklyBtn");
  if(!section||!subject){setStatus("#weeklyStatus","Select class and subject.",true);return}
  const section_id=REMOTE.sectionIdByName.get(section),subject_id=REMOTE.subjectIdByName.get(subject),teacher=handlingTeacher(section,subject)||norm($("#wkTeacher").value),teacher_id=REMOTE.teacherIdByName.get(teacher)||null,{plan,rows}=planRowsFor(section,subject),wr=rows.find(x=>x.weekLabel===$("#wkWeek").value);
  setBusy(btn,true,"Saving…");
  try{
    await remoteCall("weekly_save",{
      week_no:Number(wr?.weekNo||$("#wkWeek").dataset.weekNo||0),
      week_label:wr?.weekLabel||$("#wkWeek").value,
      section_id,subject_id,teacher_id,year_plan_id:plan?.id||null,
      week_start:wr?.startDate||null,week_end:wr?.endDate||null,
      working_days:wr?.workingDays==null?null:Number(wr.workingDays),
      planned_periods:wr?.plannedPeriods==null?null:Number(wr.plannedPeriods),
      periods_taken:Number($("#wkTakenPeriods").value||0),
      periods_lagging:Number($("#wkLagPeriods").value||0),
      planned_topic:wr?.topic||"",
      current_topic:norm($("#wkActual").value),reason:norm($("#wkReason").value)
    });
    await reloadRemote();setStatus("#weeklyStatus","Weekly status saved centrally.");renderAll();fillWeeklyFromPlan()
  }catch(e){setStatus("#weeklyStatus",e.message,true)}finally{setBusy(btn,false)}
};

const _weeklySourceInit=init;
init=function(){_weeklySourceInit();applyYearPlanSourceLock()};
