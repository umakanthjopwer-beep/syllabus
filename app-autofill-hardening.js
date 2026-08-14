// Final Weekly Status autofill hardening.
// Uses all matching class-subject plans, merges split source rows into Monday-Saturday weeks,
// then falls back to the original stored source for a missing week.
(function(){
  const sourceCache=new Map(),pending=new Map();
  const clean=v=>String(v??"").trim();
  const monday=s=>{if(!s)return"";const d=new Date(s+"T00:00:00Z"),back=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-back);return d.toISOString().slice(0,10)};
  const saturday=s=>{const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+5);return d.toISOString().slice(0,10)};
  function matchingPlans(section,subject){
    const sub=canonicalSubject(subject||"");return(data.plans||[]).filter(p=>p.enabled!==false&&p.assignedSections?.includes(section)&&planHasSubject(p,sub))
  }
  function mergeWeekGroup(group,ws){
    const exact=group.filter(r=>r.startDate===ws&&(r.endDate||r.startDate)===saturday(ws)),use=exact.length?exact:group;
    const spans=new Map();for(const r of use){const key=`${r.startDate}|${r.endDate||r.startDate}`,old=spans.get(key);if(!old){spans.set(key,{...r});continue}if(clean(r.topic)&&!clean(old.topic).includes(clean(r.topic)))old.topic=clean(old.topic)?`${clean(old.topic)} | ${clean(r.topic)}`:clean(r.topic);if(r.workingDays!=null)old.workingDays=Math.max(Number(old.workingDays||0),Number(r.workingDays||0));if(r.plannedPeriods!=null)old.plannedPeriods=Math.max(Number(old.plannedPeriods||0),Number(r.plannedPeriods||0))}
    const uniq=[...spans.values()],topics=[];for(const r of uniq)for(const t of clean(r.topic).split(/\s*\|\s*/).filter(Boolean))if(!topics.includes(t))topics.push(t);
    const days=uniq.map(r=>r.workingDays).filter(v=>v!=null&&v!=="").map(Number).filter(Number.isFinite),periods=uniq.map(r=>r.plannedPeriods).filter(v=>v!=null&&v!=="").map(Number).filter(Number.isFinite),sample=uniq.find(r=>clean(r.topic))||uniq[0]||{};
    return{...sample,startDate:ws,endDate:saturday(ws),topic:topics.join(" | "),workingDays:days.length?Math.min(6,exact.length?Math.max(...days):days.reduce((a,b)=>a+b,0)):null,plannedPeriods:periods.length?(exact.length?Math.max(...periods):periods.reduce((a,b)=>a+b,0)):null}
  }
  function bestRows(rows){
    const groups=new Map();for(const r of rows||[]){if(!r.startDate)continue;const ws=monday(r.startDate);if(!groups.has(ws))groups.set(ws,[]);groups.get(ws).push(r)}
    return[...groups.entries()].map(([ws,g])=>mergeWeekGroup(g,ws)).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))
  }
  const basePlanRowsFor=planRowsFor;
  planRowsFor=function(section,subject){
    const sub=canonicalSubject(subject||""),grade=Number(sectionMeta(section)?.grade||0),base=basePlanRowsFor(section,sub),plans=matchingPlans(section,sub),all=[...(base.rows||[])];
    for(const p of plans){if(base.plan&&p.id===base.plan.id)continue;for(const w of p.weeks||[]){if((w.grade==null||Number(w.grade)===grade)&&same(canonicalSubject(w.subject||p.subject),sub))all.push(w)}}
    return{plan:base.plan||plans[0]||null,rows:bestRows(all),plans}
  };

  // Teacher plan visibility must recognise shared/multi-subject Year Plans.
  const baseVisiblePlans=visiblePlans;
  visiblePlans=function(){
    if(currentUser?.role!=="Teacher")return baseVisiblePlans();
    const pairs=typeof ownTeacherPairs==="function"?ownTeacherPairs():[];
    return(data.plans||[]).filter(p=>p.enabled!==false&&pairs.some(x=>p.assignedSections?.includes(x.section)&&planHasSubject(p,x.subject)))
  };

  async function parseStored(plan){
    if(sourceCache.has(plan.id))return sourceCache.get(plan.id);
    const promise=(async()=>{const signed=await remoteCall("yearplan_url",{id:plan.id}),resp=await fetch(signed.url);if(!resp.ok)throw new Error("Stored Year Plan source could not be read.");const blob=await resp.blob(),file=new File([blob],plan.fileName,{type:plan.fileType||blob.type||"application/octet-stream"});return await smartParse(file)})();
    sourceCache.set(plan.id,promise);try{return await promise}catch(e){sourceCache.delete(plan.id);throw e}
  }
  function filteredSourceRows(d,section,subject){const grade=Number(sectionMeta(section)?.grade||0),sub=canonicalSubject(subject||"");return(d.rows||[]).filter(r=>(!r.grade||Number(r.grade)===grade)&&same(canonicalSubject(r.subject||sub),sub))}
  function recoveredAggregate(rows,w){
    const matched=(rows||[]).filter(r=>r.startDate&&r.startDate<=w.end&&(r.endDate||r.startDate)>=w.start),merged=bestRows(matched),row=merged.find(r=>r.startDate===w.start)||mergeWeekGroup(matched,w.start);
    return{matched,topic:clean(row?.topic),workingDays:row?.workingDays??null,plannedPeriods:row?.plannedPeriods??null}
  }
  function cacheRecovered(plan,section,subject,w,agg){
    if(!plan||!agg.topic)return;const grade=Number(sectionMeta(section)?.grade||0),sub=canonicalSubject(subject||""),label=calendarWeekForDate(w.start)?.label||w.label||"",weekNo=calendarWeekForDate(w.start)?.weekNo||0,row={week:label,weekLabel:label,weekNo,startDate:w.start,endDate:w.end,workingDays:agg.workingDays,plannedPeriods:agg.plannedPeriods,topic:agg.topic,grade,subject:sub,recoveredFromSource:true};
    plan.weeks=plan.weeks||[];const i=plan.weeks.findIndex(x=>Number(x.grade||grade)===grade&&same(canonicalSubject(x.subject||sub),sub)&&monday(x.startDate)===w.start);if(i>=0)plan.weeks[i]={...plan.weeks[i],...row};else plan.weeks.push(row)
  }
  function setSourceNote(text,error=false){const note=document.getElementById("yearPlanSourceNote");if(note){note.textContent=text;note.style.color=error?"#a13c3c":"#54708f"}}
  async function rescueSelectedWeek(section,subject,w){
    const key=`${section}|${canonicalSubject(subject)}|${w.start}`;if(pending.has(key))return pending.get(key);
    const task=(async()=>{
      const plans=matchingPlans(section,subject);if(!plans.length)return false;setSourceNote("Stored weekly row is missing. Reading the original Year Plan automatically…");
      for(const plan of plans){
        try{const d=await parseStored(plan),rows=filteredSourceRows(d,section,subject),agg=recoveredAggregate(rows,w);if(!agg.topic)continue;cacheRecovered(plan,section,subject,w,agg);const box=document.getElementById("wkPlanned"),days=document.getElementById("wkDays"),pp=document.getElementById("wkPlannedPeriods");if(box)box.value=agg.topic;if(days&&agg.workingDays!=null)days.value=agg.workingDays;if(pp&&agg.plannedPeriods!=null)pp.value=agg.plannedPeriods;setSourceNote(`Auto-recovered from original Year Plan: ${plan.fileName}${agg.plannedPeriods==null?" · Planned Periods not separately provided":""}`);if(typeof autoLag==="function")autoLag();return true}catch(e){console.warn("Year Plan week source recovery",plan?.fileName,e)}}
      setSourceNote("No syllabus topic was found in the original Year Plan for this selected week.",true);return false
    })();pending.set(key,task);try{return await task}finally{pending.delete(key)}
  }
  const baseFill=fillWeeklyCalendarFromPlan;
  fillWeeklyCalendarFromPlan=function(preserveSelection=true){
    const result=baseFill(preserveSelection);setTimeout(()=>{try{const section=document.getElementById("wkSection")?.value,subject=canonicalSubject(document.getElementById("wkSubject")?.value||""),w=selectedCalendarWeek?.(),box=document.getElementById("wkPlanned");if(!section||!subject||!w||clean(box?.value))return;const x=planRowsFor(section,subject);if(!x.plan)return;rescueSelectedWeek(section,subject,w)}catch(e){console.warn("Weekly syllabus autofill rescue",e)}},0);return result
  };
  fillWeeklyFromPlan=function(){return fillWeeklyCalendarFromPlan(true)};
  applyWeekDates=function(){return fillWeeklyCalendarFromPlan(true)};
  window.retryWeeklySyllabusAutofill=function(){const section=document.getElementById("wkSection")?.value,subject=canonicalSubject(document.getElementById("wkSubject")?.value||""),w=selectedCalendarWeek?.();return section&&subject&&w?rescueSelectedWeek(section,subject,w):Promise.resolve(false)};
})();
