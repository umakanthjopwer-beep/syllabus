// Week-aware Year Plan capture engine.
// Normalizes parsed source rows into Monday-Saturday academic weeks and validates capture coverage.
(function(){
  const WEEK1="2026-06-01";
  const YEAR_END="2027-04-30";
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||""));
  const D=s=>new Date(s+"T00:00:00Z"),ISO=d=>d.toISOString().slice(0,10);
  function add(s,n){const d=D(s);d.setUTCDate(d.getUTCDate()+n);return ISO(d)}
  function monday(s){const d=D(s),back=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-back);return ISO(d)}
  function weekNo(s){return Math.max(1,Math.floor((D(monday(s))-D(WEEK1))/(7*86400000))+1)}
  function label(start){const f=s=>D(s).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}),end=add(start,5);return`Week ${weekNo(start)} | ${f(start)} - ${f(end)}`}
  function overlapDays(a,b,ws,we){let n=0;for(let x=a;x<=b;x=add(x,1)){const dow=D(x).getUTCDay();if(x>=ws&&x<=we&&dow!==0)n++}return n}
  function distribute(total,weights){if(total==null||total===""||!Number.isFinite(Number(total)))return weights.map(()=>null);let left=Math.max(0,Math.round(Number(total))),sum=weights.reduce((a,b)=>a+b,0)||1;const out=weights.map(w=>Math.floor(left*w/sum)),used=out.reduce((a,b)=>a+b,0);let rem=left-used;const order=weights.map((w,i)=>({i,f:left*w/sum-Math.floor(left*w/sum)})).sort((a,b)=>b.f-a.f);for(let k=0;k<rem;k++)out[order[k%order.length].i]++;return out}
  function sourceWeeks(a,b){const out=[];let ws=monday(a),guard=0;while(ws<=b&&guard++<60){const we=add(ws,5),weight=overlapDays(a,b,ws,we);if(weight>0)out.push({start:ws,end:we,weight});ws=add(ws,7)}return out}
  function normalizeOne(r){
    let a=valid(r.startDate)?r.startDate:"",b=valid(r.endDate)?r.endDate:a;if(!a)return[];if(!b)b=a;if(b<a){const t=a;a=b;b=t}
    const weeks=sourceWeeks(a,b);if(!weeks.length)return[];
    const wd=distribute(r.workingDays,weeks.map(x=>x.weight)),pp=distribute(r.plannedPeriods,weeks.map(x=>x.weight));
    return weeks.map((w,i)=>({grade:r.grade??null,subject:canonicalSubject(r.subject||""),startDate:w.start,endDate:w.end,workingDays:wd[i],plannedPeriods:pp[i],topic:clean(r.topic),academicWeekNo:weekNo(w.start),weekLabel:label(w.start),sourceStartDate:a,sourceEndDate:b,sourceRow:r.sourceRow??null}))
  }
  function mergeRows(rows){
    const buckets=new Map();
    for(const r of rows){const key=[r.grade??"",canonicalSubject(r.subject||""),r.startDate].join("|");if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r)}
    const out=[];
    for(const group of buckets.values()){
      const sample=group[0],bySource=new Map();
      for(const r of group){const sk=`${r.sourceStartDate}|${r.sourceEndDate}`;if(!bySource.has(sk))bySource.set(sk,[]);bySource.get(sk).push(r)}
      const topics=[],days=[],periods=[];
      for(const sameSource of bySource.values()){
        for(const t of sameSource.map(x=>clean(x.topic)).filter(Boolean))if(!topics.includes(t))topics.push(t);
        const dv=sameSource.map(x=>x.workingDays).filter(x=>x!=null&&Number.isFinite(Number(x))).map(Number);if(dv.length)days.push(Math.max(...dv));
        const pv=sameSource.map(x=>x.plannedPeriods).filter(x=>x!=null&&Number.isFinite(Number(x))).map(Number);if(pv.length)periods.push(Math.max(...pv));
      }
      out.push({grade:sample.grade,subject:sample.subject,startDate:sample.startDate,endDate:sample.endDate,workingDays:days.length?Math.min(6,days.reduce((a,b)=>a+b,0)):null,plannedPeriods:periods.length?periods.reduce((a,b)=>a+b,0):null,topic:topics.join(" | "),academicWeekNo:sample.academicWeekNo,weekNo:sample.academicWeekNo,weekLabel:sample.weekLabel,week:sample.weekLabel})
    }
    return out.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||Number(a.grade||0)-Number(b.grade||0)||String(a.subject).localeCompare(String(b.subject)))
  }
  function dateTokens(text){
    const out=[];for(const m of String(text||"").matchAll(/\b(\d{1,2})[.\-](\d{1,2})[.\-](20\d{2})\b/g)){const s=`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;if(s>=WEEK1&&s<=YEAR_END)out.push(s)}return out
  }
  function validate(d,raw,normalized){
    const parsedStarts=new Set(normalized.map(r=>r.startDate)),sourceStarts=new Set();for(const x of dateTokens(d.text))sourceStarts.add(monday(x));
    const uncovered=[...sourceStarts].filter(x=>!parsedStarts.has(x));
    const sourceRows=(raw||[]).filter(r=>valid(r.startDate)),blank=normalized.filter(r=>!clean(r.topic)).length;
    d.captureWarnings=[];if(uncovered.length)d.captureWarnings.push(`${uncovered.length} dated source week(s) were detected in the file but have no captured syllabus row.`);if(blank)d.captureWarnings.push(`${blank} normalized week row(s) have no syllabus topic.`);
    d.captureIncomplete=uncovered.length>0;d.captureWarning=d.captureWarnings.join(" ");d.normalizationSummary={rawRows:sourceRows.length,weekRows:normalized.length,uncoveredWeeks:uncovered,blankRows:blank};
  }
  function normalizeDraft(d){const raw=(d.rows||[]).map((r,i)=>({...r,sourceRow:i+1})),split=raw.flatMap(normalizeOne),normalized=mergeRows(split);d.rawRows=raw;d.rows=normalized;validate(d,raw,normalized);return d}

  const baseSmartParse=smartParse;
  smartParse=async function(file){return normalizeDraft(await baseSmartParse(file))};

  // Publish uses academic week number derived from date, never row position.
  smartPublish=async function(){
    const subjects=checkedSmart("subject"),sections=checkedSmart("section"),btn=document.getElementById("smartPublish");if(!subjects.length||!sections.length){alert("Select at least one subject and one class/section.");return}
    const subject_ids=subjects.map(s=>REMOTE.subjectIdByName.get(s)).filter(Boolean),section_ids=sections.map(s=>REMOTE.sectionIdByName.get(s)).filter(Boolean);if(subject_ids.length!==subjects.length){alert("One selected subject is missing from the Subject Master.");return}
    const d=smartDraft;if(d.captureIncomplete){alert(`Year Plan capture needs review before publishing. ${d.captureWarning||"Some dated weeks were not captured."}`);return}
    setBusy(btn,true,"Publishing…");try{
      const file_base64=await fileToBase64(d.file),weeks=(d.rows||[]).filter(r=>subjects.includes(canonicalSubject(r.subject||subjects[0]))&&(!r.grade||sections.some(s=>Number(sectionMeta(s).grade)===Number(r.grade)))).map((r,i)=>({week_no:Number(r.academicWeekNo||r.weekNo||weekNo(r.startDate)),week_label:r.weekLabel||label(r.startDate),start_date:r.startDate||null,end_date:r.endDate||null,working_days:r.workingDays??null,planned_periods:r.plannedPeriods??null,topic:r.topic||"",grade:r.grade??null,subject_id:REMOTE.subjectIdByName.get(canonicalSubject(r.subject||subjects[0]))||subject_ids[0],source_row:i+1}));
      if(!weeks.length)throw new Error("No usable week-wise syllabus rows were captured from the Year Plan.");
      const departments=[...new Set(subjects.map(departmentForSubject).filter(Boolean))];
      await smartApi({action:"save",file_name:d.file.name,file_type:d.file.type||"application/octet-stream",file_size:d.file.size,file_base64,department:departments.join(" / "),subject_ids,section_ids,weeks,parse_status:"parsed",parse_message:`Week-normalized smart import: ${d.pages} page/sheet(s), ${weeks.length} Monday-Saturday row(s), ${subjects.length} subject(s), ${sections.length} section(s)`});
      await reloadRemote();renderAll();injectSmartYearPlans();smartDraft=null;document.getElementById("smartReview").classList.add("hidden");document.getElementById("smartPlanFile").value="";setSmartStep(4);alert(`Year Plan published with ${weeks.length} week-wise syllabus row(s).`)
    }catch(e){alert(e.message||e)}finally{setBusy(btn,false)}
  };

  // Super Admin Re-capture also writes normalized academic week numbers/dates.
  if(typeof reprocessStoredPlan==="function"){
    reprocessStoredPlan=async function(id){
      if(currentUser?.role!=="Super Admin")return;const p=data.plans.find(x=>x.id===id);if(!p)return;if(!confirm(`Re-capture and normalize the stored Year Plan into Monday-Saturday weeks?\n\n${p.fileName}\n\nExisting non-blank capture data is protected by Safe Re-capture.`))return;
      try{
        const signed=await remoteCall("yearplan_url",{id}),resp=await fetch(signed.url);if(!resp.ok)throw new Error("Could not read the stored source file.");const blob=await resp.blob(),file=new File([blob],p.fileName,{type:p.fileType||blob.type||"application/octet-stream"}),d=await smartParse(file);
        if(d.captureIncomplete)throw new Error(d.captureWarning||"Source capture is incomplete; existing data was not changed.");
        const subjects=planSubjects(p).map(canonicalSubject),grades=new Set((p.assignedSections||[]).map(s=>Number(sectionMeta(s).grade))),parsed=(d.rows||[]).filter(r=>(!r.grade||grades.has(Number(r.grade)))&&subjects.some(s=>same(s,canonicalSubject(r.subject||subjects[0]))));if(!parsed.length)throw new Error("Re-capture found no usable week-wise syllabus rows. Existing data was not changed.");
        const subject_ids=subjects.map(s=>REMOTE.subjectIdByName.get(s)).filter(Boolean),section_ids=(p.assignedSections||[]).map(s=>REMOTE.sectionIdByName.get(s)).filter(Boolean);if(subject_ids.length!==subjects.length)throw new Error("A linked subject is missing from Subject Master.");
        const weeks=parsed.map((r,i)=>({week_no:Number(r.academicWeekNo||r.weekNo||weekNo(r.startDate)),week_label:r.weekLabel||label(r.startDate),start_date:r.startDate,end_date:r.endDate,working_days:r.workingDays??null,planned_periods:r.plannedPeriods??null,topic:r.topic||"",grade:r.grade??null,subject_id:REMOTE.subjectIdByName.get(canonicalSubject(r.subject||subjects[0]))||subject_ids[0],source_row:i+1}));
        await smartApi({action:"save",id:p.id,department:p.department||subjects.map(departmentForSubject).filter(Boolean).join(" / "),subject_ids,section_ids,weeks,parse_status:"parsed",parse_message:`Source re-capture: ${weeks.length} dated row(s) · Monday-Saturday normalized · ${new Date().toLocaleString("en-IN")}`});
        await reloadRemote();renderAll();alert(`Re-capture completed: ${weeks.length} Monday-Saturday syllabus row(s) verified.`)
      }catch(e){alert(e.message||String(e))}
    };
  }
})();
