function lockYearPlanField(id, sourceMissing=false){
  const el=document.getElementById(id);if(!el)return;
  el.readOnly=true;el.setAttribute("aria-readonly","true");el.style.background="#f7f9fc";el.style.cursor="default";
  if(id==="wkPlanned")el.style.resize="none";
  if(id==="wkPlannedPeriods")el.placeholder=sourceMissing?"Not given in Year Plan":"";
}
function fmtWeekDate(iso){
  if(!iso)return"";const d=new Date(iso+"T00:00:00");return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
}
function isoDate(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function calendarWeekForDate(iso){
  const d=new Date(iso+"T00:00:00"),day=d.getDay(),back=(day+6)%7,start=new Date(d);start.setDate(d.getDate()-back);const end=new Date(start);end.setDate(start.getDate()+5);
  return{start:isoDate(start),end:isoDate(end),label:`${fmtWeekDate(isoDate(start))} to ${fmtWeekDate(isoDate(end))}`}
}
function overlaps(a1,a2,b1,b2){return!!a1&&a1<=b2&&(a2||a1)>=b1}
function calendarWeeksForRows(rows){
  const map=new Map();
  for(const r of rows){if(!r.startDate)continue;let cursor=new Date(r.startDate+"T00:00:00"),last=new Date((r.endDate||r.startDate)+"T00:00:00");while(cursor<=last){const w=calendarWeekForDate(isoDate(cursor));map.set(w.start,w);const next=new Date(w.start+"T00:00:00");next.setDate(next.getDate()+7);cursor=next}}
  return[...map.values()].sort((a,b)=>a.start.localeCompare(b.start))
}
function aggregateWeek(rows,start,end){
  const matched=rows.filter(r=>overlaps(r.startDate,r.endDate,start,end));
  const topics=[...new Set(matched.map(r=>String(r.topic||"").trim()).filter(Boolean))];
  const workingVals=matched.map(r=>r.workingDays).filter(v=>v!=null&&v!=="").map(Number).filter(Number.isFinite);
  const periodVals=matched.map(r=>r.plannedPeriods).filter(v=>v!=null&&v!=="").map(Number).filter(Number.isFinite);
  return{matched,topic:topics.join("\n"),workingDays:workingVals.length?workingVals.reduce((a,b)=>a+b,0):null,plannedPeriods:periodVals.length?periodVals.reduce((a,b)=>a+b,0):null,weekNo:Number(matched.find(r=>r.weekNo)?.weekNo||0)}
}
function ensureYearPlanSourceNote(){
  if(document.getElementById("yearPlanSourceNote"))return;
  const planned=document.getElementById("wkPlanned");if(!planned)return;
  const note=document.createElement("div");note.id="yearPlanSourceNote";note.className="small-muted";note.style.marginTop="6px";note.style.fontSize="10px";note.style.fontWeight="700";note.style.color="#54708f";
  planned.insertAdjacentElement("afterend",note)
}
function simplifyWeeklyLayout(){
  for(const id of ["wkStart","wkEnd"]){const el=document.getElementById(id);if(el?.closest("label"))el.closest("label").style.display="none"}
  const week=document.getElementById("wkWeek");if(week?.closest("label")){const label=week.closest("label");for(const n of [...label.childNodes])if(n.nodeType===3&&n.textContent.trim()==="Week")n.textContent="Week (Monday to Saturday)"}
  lockYearPlanField("wkTeacher");lockYearPlanField("wkDays");lockYearPlanField("wkPlannedPeriods");lockYearPlanField("wkPlanned");ensureYearPlanSourceNote()
}
function renderCalendarWeekOptions(rows){
  const sel=document.getElementById("wkWeek"),weeks=calendarWeeksForRows(rows);if(!sel)return[];
  const previous=sel.dataset.weekStart||"",today=isoDate(new Date()),todayWeek=calendarWeekForDate(today).start;
  sel.innerHTML=weeks.length?weeks.map(w=>`<option value="${esc(w.label)}" data-start="${w.start}" data-end="${w.end}">${esc(w.label)}</option>`).join(""):'<option>No dated Year Plan row</option>';
  const preferred=weeks.find(w=>w.start===previous)||weeks.find(w=>w.start===todayWeek)||weeks[0];
  if(preferred){sel.value=preferred.label;sel.dataset.weekStart=preferred.start;sel.dataset.weekEnd=preferred.end}else{sel.dataset.weekStart="";sel.dataset.weekEnd=""}
  return weeks
}
function selectedCalendarWeek(){
  const sel=document.getElementById("wkWeek"),op=sel?.selectedOptions?.[0];if(!sel||!op)return null;const start=op.dataset.start||sel.dataset.weekStart,end=op.dataset.end||sel.dataset.weekEnd;return start&&end?{start,end,label:op.value}:null
}
function fillWeeklyCalendarFromPlan(preserveSelection=true){
  const section=document.getElementById("wkSection")?.value,subject=canonicalSubject(document.getElementById("wkSubject")?.value||"");if(!section||!subject)return;
  const {plan,rows}=planRowsFor(section,subject),sel=document.getElementById("wkWeek"),oldStart=preserveSelection?sel?.dataset.weekStart||"":"";
  if(sel)sel.dataset.weekStart=oldStart;
  const weeks=renderCalendarWeekOptions(rows);if(oldStart&&weeks.some(w=>w.start===oldStart)){const w=weeks.find(w=>w.start===oldStart);sel.value=w.label;sel.dataset.weekStart=w.start;sel.dataset.weekEnd=w.end}
  const w=selectedCalendarWeek();const agg=w?aggregateWeek(rows,w.start,w.end):{matched:[],topic:"",workingDays:null,plannedPeriods:null,weekNo:0};
  document.getElementById("wkTeacher").value=handlingTeacher(section,subject)||"";
  document.getElementById("wkStart").value=w?.start||"";document.getElementById("wkEnd").value=w?.end||"";
  document.getElementById("wkDays").value=agg.workingDays??"";document.getElementById("wkPlannedPeriods").value=agg.plannedPeriods??"";document.getElementById("wkPlanned").value=agg.topic||"";
  if(sel)sel.dataset.weekNo=String(agg.weekNo||weeks.findIndex(x=>x.start===w?.start)+1||0);
  lockYearPlanField("wkPlannedPeriods",agg.plannedPeriods==null);simplifyWeeklyLayout();
  const note=document.getElementById("yearPlanSourceNote");if(note)note.textContent=plan?`Auto-filled from Year Plan: ${plan.fileName}${agg.plannedPeriods==null?" · Planned Periods not provided in source file":""}`:"No published Year Plan row found for this class and subject.";
  if(typeof autoLag==="function")autoLag()
}
fillWeeklyFromPlan=function(){fillWeeklyCalendarFromPlan(true)};
applyWeekDates=function(){fillWeeklyCalendarFromPlan(true)};

saveWeekly=async function(){
  const section=$("#wkSection").value,subject=canonicalSubject($("#wkSubject").value),btn=$("#saveWeeklyBtn");if(!section||!subject){setStatus("#weeklyStatus","Select class and subject.",true);return}
  const section_id=REMOTE.sectionIdByName.get(section),subject_id=REMOTE.subjectIdByName.get(subject),teacher=handlingTeacher(section,subject)||norm($("#wkTeacher").value),teacher_id=REMOTE.teacherIdByName.get(teacher)||null,{plan,rows}=planRowsFor(section,subject),w=selectedCalendarWeek(),agg=w?aggregateWeek(rows,w.start,w.end):{matched:[],topic:"",workingDays:null,plannedPeriods:null,weekNo:0};
  setBusy(btn,true,"Saving…");
  try{
    await remoteCall("weekly_save",{week_no:Number(agg.weekNo||$("#wkWeek").dataset.weekNo||0),week_label:w?.label||$("#wkWeek").value,section_id,subject_id,teacher_id,year_plan_id:plan?.id||null,week_start:w?.start||null,week_end:w?.end||null,working_days:agg.workingDays==null?null:Number(agg.workingDays),planned_periods:agg.plannedPeriods==null?null:Number(agg.plannedPeriods),periods_taken:Number($("#wkTakenPeriods").value||0),periods_lagging:Number($("#wkLagPeriods").value||0),planned_topic:agg.topic||"",current_topic:norm($("#wkActual").value),reason:norm($("#wkReason").value)});
    await reloadRemote();setStatus("#weeklyStatus","Weekly status saved centrally.");renderAll();fillWeeklyCalendarFromPlan(true)
  }catch(e){setStatus("#weeklyStatus",e.message,true)}finally{setBusy(btn,false)}
};

const _weeklySourceInit=init;
init=function(){_weeklySourceInit();simplifyWeeklyLayout();setTimeout(()=>fillWeeklyCalendarFromPlan(false),0);const w=document.getElementById("wkWeek");if(w)w.onchange=()=>{const op=w.selectedOptions?.[0];w.dataset.weekStart=op?.dataset.start||"";w.dataset.weekEnd=op?.dataset.end||"";fillWeeklyCalendarFromPlan(true)}};
