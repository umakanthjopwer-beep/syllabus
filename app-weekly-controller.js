// Authoritative Weekly Status controller.
// One source of truth for staff mappings, academic weeks and Year Plan autofill.
(function(){
  const ENTRY_ROLES=new Set(["Teacher","HOD","Admin","Super Admin"]);
  const WEEK1="2026-06-01",TOTAL_WEEKS=44;
  let lastEntryIdentity="";

  const clean=v=>String(v??"").trim();
  const D=iso=>new Date(iso+"T00:00:00Z");
  const ISO=d=>d.toISOString().slice(0,10);
  function addDays(iso,n){const d=D(iso);d.setUTCDate(d.getUTCDate()+n);return ISO(d)}
  function monday(iso){if(!iso)return"";const d=D(iso),back=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-back);return ISO(d)}
  function fmt(iso){return iso?D(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}):""}
  function weekNo(start){return Math.max(1,Math.floor((D(monday(start))-D(WEEK1))/(7*86400000))+1)}
  function weekForStart(start){const s=monday(start),n=weekNo(s),end=addDays(s,5);return{weekNo:n,start:s,end,label:`Week ${n} | ${fmt(s)} - ${fmt(end)}`}}
  function weekForNumber(n){return weekForStart(addDays(WEEK1,(Number(n)-1)*7))}
  function allWeeks(){return Array.from({length:TOTAL_WEEKS},(_,i)=>weekForNumber(i+1))}
  function todayIso(){try{return typeof schoolTodayIso==="function"?schoolTodayIso():new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}}
  function currentWeek(){return weekForStart(todayIso())}
  function overlaps(a,b,c,d){return!!a&&!!c&&a<=d&&(b||a)>=c}
  function numberOrNull(v){return v===null||v===undefined||v===""?null:(Number.isFinite(Number(v))?Number(v):null)}

  // Academic dates, not legacy week_no values, are authoritative.
  calendarWeekForDate=function(iso){return weekForStart(iso)};
  calendarWeeksForRows=function(){return allWeeks()};
  aggregateWeek=function(rows,start,end){
    const matched=(rows||[]).filter(r=>overlaps(r.startDate,r.endDate||r.startDate,start,end));
    const topics=[];for(const r of matched){const t=clean(r.topic);if(t&&!topics.includes(t))topics.push(t)}
    const dayVals=matched.map(r=>numberOrNull(r.workingDays)).filter(v=>v!==null);
    const periodVals=matched.map(r=>numberOrNull(r.plannedPeriods)).filter(v=>v!==null);
    return{matched,topic:topics.join(" | "),workingDays:dayVals.length?Math.min(6,Math.max(...dayVals)):null,plannedPeriods:periodVals.length?Math.max(...periodVals):null,weekNo:weekNo(start)}
  };

  function selectedStart(){const sel=document.getElementById("wkWeek"),op=sel?.selectedOptions?.[0];return op?.dataset.start||sel?.dataset.weekStart||""}
  function renderWeeks(preferredStart=""){
    const sel=document.getElementById("wkWeek"),weeks=allWeeks();if(!sel)return weeks;
    const desired=monday(preferredStart||selectedStart()||currentWeek().start);
    sel.innerHTML=weeks.map(w=>`<option value="${esc(w.label)}" data-start="${w.start}" data-end="${w.end}" data-week-no="${w.weekNo}">${esc(w.label)}</option>`).join("");
    const chosen=weeks.find(w=>w.start===desired)||weeks.find(w=>w.start===currentWeek().start)||weeks[0];
    sel.value=chosen.label;sel.dataset.weekStart=chosen.start;sel.dataset.weekEnd=chosen.end;sel.dataset.weekNo=String(chosen.weekNo);return weeks
  }
  renderCalendarWeekOptions=function(){return renderWeeks(selectedStart())};
  selectedCalendarWeek=function(){
    const sel=document.getElementById("wkWeek"),op=sel?.selectedOptions?.[0];if(!sel||!op)return null;
    let start=op.dataset.start||sel.dataset.weekStart||"",end=op.dataset.end||sel.dataset.weekEnd||"";
    if(!start){const m=String(op.value||op.textContent||"").match(/Week\s*(\d+)/i);if(m)start=weekForNumber(Number(m[1])).start}
    if(start&&!end)end=addDays(start,5);if(!start||!end)return null;
    const w=weekForStart(start);sel.dataset.weekStart=w.start;sel.dataset.weekEnd=w.end;sel.dataset.weekNo=String(w.weekNo);
    if(op.value!==w.label){op.value=w.label;op.textContent=w.label;op.dataset.start=w.start;op.dataset.end=w.end;op.dataset.weekNo=String(w.weekNo)}
    return w
  };

  function linkedTeacherName(){const t=currentUser?.teacherId&&REMOTE?.teacherById?.get?REMOTE.teacherById.get(currentUser.teacherId):null;return t?.name||currentUser?.name||""}
  function activeEntryUser(){return!!currentUser&&ENTRY_ROLES.has(currentUser.role)}
  function fallbackNameMatch(mapping){const a=clean(mapping?.teacher).toLowerCase(),b=clean(linkedTeacherName()).toLowerCase();return!!a&&!!b&&(a===b||a.endsWith(" "+b)||b.endsWith(" "+a))}
  function linkedMappings(){
    if(!activeEntryUser())return[];const all=(data.setup?.handlingMappings||[]).filter(m=>m.activeForSyllabus!==false),tid=currentUser?.teacherId||"";
    if(tid){const exact=all.filter(m=>m.teacherId===tid);if(exact.length)return exact}
    return all.filter(fallbackNameMatch)
  }
  ownTeacherMappings=function(){return linkedMappings()};
  ownTeacherPairs=function(){return linkedMappings().map(m=>({section:m.section,subject:canonicalSubject(m.subject),department:m.department,teacher:m.teacher,teacherId:m.teacherId}))};
  ownTeacherSections=function(){return[...new Set(linkedMappings().map(m=>m.section).filter(Boolean))]};
  ownTeacherSubjectsFor=function(section){return[...new Set(linkedMappings().filter(m=>m.section===section).map(m=>canonicalSubject(m.subject)).filter(Boolean))]};
  if(typeof canSubmitWeekly==="function"){
    canSubmitWeekly=function(section,subject){const sub=canonicalSubject(subject||"");return linkedMappings().some(m=>m.section===section&&canonicalSubject(m.subject)===sub)}
  }

  updateWeeklySubjects=function(){
    if(!activeEntryUser())return;
    const sectionSel=document.getElementById("wkSection"),subjectSel=document.getElementById("wkSubject"),sections=ownTeacherSections();
    const section=sections.includes(sectionSel?.value)?sectionSel.value:(sections[0]||"");if(sectionSel&&sectionSel.value!==section)sectionSel.value=section;
    const subjects=ownTeacherSubjectsFor(section),old=canonicalSubject(subjectSel?.value||"");if(subjectSel)fillSelect(subjectSel,subjects,subjects.includes(old)?old:(subjects[0]||""))
  };

  // Restore fields discarded by the old bootstrap adapter: teacher_id, grade and subject_id.
  function hydrateRemoteDetails(r){
    try{
      const localMappings=new Map((data.setup?.handlingMappings||[]).map(m=>[m.id,m]));
      for(const raw of r?.mappings||[]){const m=localMappings.get(raw.id);if(!m)continue;m.teacherId=raw.teacher_id||null;m.sectionId=raw.section_id||null;m.subjectId=raw.subject_id||null}
      const localWeekly=new Map((data.weekly||[]).map(w=>[w.id,w]));for(const raw of r?.weekly||[]){const w=localWeekly.get(raw.id);if(w)w.teacherId=raw.teacher_id||null}
      const plansById=new Map((data.plans||[]).map(p=>[p.id,p])),weeksByPlan=new Map();
      for(const raw of r?.weeks||[]){
        const p=plansById.get(raw.year_plan_id);if(!p)continue;const start=raw.start_date||"",end=raw.end_date||start;if(!start)continue;
        const sub=raw.subject_id&&REMOTE?.subjectById?.get?canonicalSubject(REMOTE.subjectById.get(raw.subject_id)?.name||p.subject):canonicalSubject(p.subject||"");
        const cw=weekForStart(start),row={id:raw.id,week:cw.label,weekLabel:cw.label,weekNo:cw.weekNo,academicWeekNo:cw.weekNo,startDate:start,endDate:end,workingDays:numberOrNull(raw.working_days),plannedPeriods:numberOrNull(raw.planned_periods),topic:raw.topic||"",grade:raw.grade==null?null:Number(raw.grade),subject:sub,subjectId:raw.subject_id||null,sourceRow:raw.source_row??null};
        if(!weeksByPlan.has(raw.year_plan_id))weeksByPlan.set(raw.year_plan_id,[]);weeksByPlan.get(raw.year_plan_id).push(row)
      }
      for(const [pid,rows] of weeksByPlan){const p=plansById.get(pid);if(p)p.weeks=rows}
    }catch(e){console.error("Weekly controller hydration",e)}
  }
  const priorApplyRemoteData=applyRemoteData;
  applyRemoteData=function(r){const out=priorApplyRemoteData(r);hydrateRemoteDetails(r);setTimeout(()=>syncEntryForm(false),0);return out};

  if(typeof visibleWeekly==="function"){
    const priorVisibleWeekly=visibleWeekly;
    visibleWeekly=function(){
      if(currentUser?.role!=="Teacher")return priorVisibleWeekly();const tid=currentUser?.teacherId||"";
      if(tid&&data.weekly.some(w=>w.teacherId))return data.weekly.filter(w=>w.teacherId===tid);
      const name=linkedTeacherName();return data.weekly.filter(w=>same(w.teacher,name))
    }
  }

  function clearPlanFields(){for(const id of ["wkDays","wkPlannedPeriods","wkPlanned","wkStart","wkEnd"]){const el=document.getElementById(id);if(el)el.value=""}}
  function clearManualFields(){
    try{if(typeof WEEKLY_EDIT_ID!=="undefined"&&WEEKLY_EDIT_ID)return;if(typeof WEEKLY_EDIT_REENTRY!=="undefined"&&WEEKLY_EDIT_REENTRY)return}catch(e){}
    for(const id of ["wkTakenPeriods","wkLagPeriods","wkActual","wkReason"]){const el=document.getElementById(id);if(el)el.value=""}
  }
  function setSourceNote(text,error=false){const note=document.getElementById("yearPlanSourceNote");if(note){note.textContent=text;note.style.color=error?"#a13c3c":"#54708f"}}

  fillWeeklyCalendarFromPlan=function(preserveSelection=true){
    const section=document.getElementById("wkSection")?.value||"",subject=canonicalSubject(document.getElementById("wkSubject")?.value||"");
    const preferred=preserveSelection?selectedStart():currentWeek().start;renderWeeks(preferred||currentWeek().start);const w=selectedCalendarWeek();
    const teacher=document.getElementById("wkTeacher");if(teacher){teacher.value=linkedTeacherName();teacher.readOnly=true;teacher.setAttribute("aria-readonly","true")}
    if(!section||!subject||!w){clearPlanFields();return}
    let x={plan:null,rows:[]};try{x=planRowsFor(section,subject)||x}catch(e){console.error("Year Plan lookup",e)}
    const agg=aggregateWeek(x.rows||[],w.start,w.end);
    const start=document.getElementById("wkStart"),end=document.getElementById("wkEnd"),days=document.getElementById("wkDays"),periods=document.getElementById("wkPlannedPeriods"),planned=document.getElementById("wkPlanned");
    if(start)start.value=w.start;if(end)end.value=w.end;if(days)days.value=agg.workingDays??"";if(periods)periods.value=agg.plannedPeriods??"";if(planned)planned.value=agg.topic||"";
    const sel=document.getElementById("wkWeek");if(sel)sel.dataset.weekNo=String(w.weekNo);
    try{if(typeof lockYearPlanField==="function"){lockYearPlanField("wkTeacher");lockYearPlanField("wkDays");lockYearPlanField("wkPlannedPeriods",agg.plannedPeriods==null);lockYearPlanField("wkPlanned")};if(typeof simplifyWeeklyLayout==="function")simplifyWeeklyLayout()}catch(e){}
    if(x.plan&&agg.topic)setSourceNote(`Auto-filled from Year Plan: ${x.plan.fileName}${agg.plannedPeriods==null?" · Planned Periods not provided in source file":""}`);
    else if(x.plan)setSourceNote(`Published Year Plan found. Checking the original source for ${w.label}…`);
    else setSourceNote("No published Year Plan is mapped to this grade/section and subject.",true);
    try{if(typeof autoLag==="function")autoLag()}catch(e){}
    if(x.plan&&!agg.topic&&typeof window.retryWeeklySyllabusAutofill==="function")setTimeout(()=>window.retryWeeklySyllabusAutofill().catch?.(()=>{}),0);
  };
  fillWeeklyFromPlan=function(){return fillWeeklyCalendarFromPlan(true)};
  applyWeekDates=function(){return fillWeeklyCalendarFromPlan(true)};

  function fillSectionOptions(forceFirst=false){
    const sections=ownTeacherSections(),sel=document.getElementById("wkSection");if(!sel)return sections;
    const old=sel.value||"",chosen=!forceFirst&&sections.includes(old)?old:(sections[0]||"");fillSelect(sel,sections,chosen);return sections
  }
  function syncEntryForm(forceCurrentWeek=false){
    if(!activeEntryUser())return;const sections=fillSectionOptions(forceCurrentWeek);updateWeeklySubjects();
    if(forceCurrentWeek)renderWeeks(currentWeek().start);else renderWeeks(selectedStart()||currentWeek().start);
    const teacher=document.getElementById("wkTeacher");if(teacher)teacher.value=linkedTeacherName();
    if(sections.length)fillWeeklyCalendarFromPlan(true);else{clearPlanFields();setSourceNote("No active handling classes are linked to this staff account.",true)}
    try{if(typeof applyWeeklyRuleEditability==="function")applyWeeklyRuleEditability()}catch(e){}
  }
  prepareOwnWeeklyEntry=function(){
    if(!activeEntryUser())return;const identity=String(currentUser?.id||currentUser?.teacherId||""),changed=identity!==lastEntryIdentity;lastEntryIdentity=identity;
    if(changed)clearManualFields();syncEntryForm(changed)
  };

  function bind(){
    const section=document.getElementById("wkSection"),subject=document.getElementById("wkSubject"),week=document.getElementById("wkWeek");
    if(section&&!section.dataset.weeklyControllerBound){section.dataset.weeklyControllerBound="1";section.addEventListener("change",()=>{updateWeeklySubjects();clearManualFields();fillWeeklyCalendarFromPlan(true)})}
    if(subject&&!subject.dataset.weeklyControllerBound){subject.dataset.weeklyControllerBound="1";subject.addEventListener("change",()=>{clearManualFields();fillWeeklyCalendarFromPlan(true)})}
    if(week&&!week.dataset.weeklyControllerBound){week.dataset.weeklyControllerBound="1";week.addEventListener("change",()=>{const op=week.selectedOptions?.[0];week.dataset.weekStart=op?.dataset.start||"";week.dataset.weekEnd=op?.dataset.end||"";week.dataset.weekNo=op?.dataset.weekNo||"";clearManualFields();fillWeeklyCalendarFromPlan(true)})}
    for(const id of ["wkActual","wkReason"]){const el=document.getElementById(id);if(el){el.setAttribute("autocomplete","off");el.setAttribute("data-lpignore","true")}}
  }
  const priorInit=init;
  init=function(){const out=priorInit();bind();renderWeeks(currentWeek().start);setTimeout(()=>{bind();prepareOwnWeeklyEntry()},0);return out};
})();
