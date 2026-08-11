// Super Admin audit for all class/subject/teacher/year-plan/week mappings and safe source re-capture.
(function(){
  const OPTIONAL_NO_PLAN=new Set(["Wizklub / Library","GK & CA","Lead Activity","Biology Practice","Chemistry Practice","English Practice","Physics Practice","Social Practice","Telugu Practice"]);
  const today=()=>new Date().toISOString().slice(0,10);
  const maxDate=rows=>rows.reduce((m,r)=>{const d=String(r.endDate||r.startDate||"");return d>m?d:m},"");
  const minDate=rows=>rows.reduce((m,r)=>{const d=String(r.startDate||"");return d&&(!m||d<m)?d:m},"");
  const currentRows=rows=>{const d=today();return rows.filter(r=>r.startDate&&r.startDate<=d&&(r.endDate||r.startDate)>=d)};
  function auditRows(){
    const out=[];
    for(const m of data.setup?.handlingMappings||[]){
      if(!m.activeForSyllabus)continue;const x=planRowsFor(m.section,m.subject),rows=x.rows||[],cur=currentRows(rows),blank=rows.filter(r=>!String(r.topic||"").trim()).length;
      let status="OK",kind="ok";
      if(!x.plan){status=OPTIONAL_NO_PLAN.has(m.subject)?"NO SEPARATE YEAR PLAN":"YEAR PLAN MISSING";kind=OPTIONAL_NO_PLAN.has(m.subject)?"optional":"bad"}
      else if(!rows.length){status="NO WEEK DATA";kind="bad"}
      else if(String(x.plan.parseStatus||"").toLowerCase()==="partial"){status="PARTIAL CAPTURE";kind="bad"}
      else if(maxDate(rows)<today()){status="COVERAGE ENDS EARLY";kind="bad"}
      else if(!cur.length){status="CURRENT WEEK MISSING";kind="warn"}
      else if(cur.some(r=>!String(r.topic||"").trim())){status="CURRENT SYLLABUS BLANK";kind="bad"}
      else if(blank){status=`${blank} BLANK ROW(S)`;kind="warn"}
      out.push({...m,plan:x.plan,rows,start:minDate(rows),end:maxDate(rows),blank,status,kind})
    }
    return out
  }
  function ensureAuditPanel(){
    if(currentUser?.role!=="Super Admin")return;const setup=document.getElementById("setup");if(!setup||document.getElementById("dataIntegrityAudit"))return;
    const p=document.createElement("div");p.className="panel";p.id="dataIntegrityAudit";p.innerHTML=`<div class="panel-head"><div><div class="eyebrow">SUPER ADMIN AUDIT</div><h3>Teacher · Subject · Year Plan · Week Integrity</h3><p class="small-muted">Checks all active syllabus mappings across all 17 sections. A file being attached is not counted as complete unless usable dated rows are available.</p></div><div class="smart-actions"><button id="auditRefreshBtn">Refresh audit</button></div></div><div id="auditSummary" class="report-summary"></div><div class="report-toolbar"><label class="grow">Search<input id="auditSearch" placeholder="Class, teacher, subject, file or status"></label><label>Status<select id="auditFilter"><option value="all">All</option><option value="issues">Issues only</option><option value="ok">OK only</option></select></label></div><div class="table-wrap"><table><thead><tr><th>Class</th><th>Subject</th><th>Teacher</th><th>Year Plan</th><th>Week Rows</th><th>Coverage</th><th>Status</th><th>Action</th></tr></thead><tbody id="auditTable"></tbody></table></div>`;setup.appendChild(p);
    document.getElementById("auditRefreshBtn").onclick=()=>renderIntegrityAudit();document.getElementById("auditSearch").oninput=renderIntegrityAudit;document.getElementById("auditFilter").onchange=renderIntegrityAudit
  }
  function renderIntegrityAudit(){
    if(currentUser?.role!=="Super Admin")return;ensureAuditPanel();const all=auditRows(),q=(document.getElementById("auditSearch")?.value||"").toLowerCase(),f=document.getElementById("auditFilter")?.value||"all";
    const noTeacher=all.filter(x=>!x.teacher).length,noPlan=all.filter(x=>!x.plan).length,bad=all.filter(x=>x.kind==="bad").length,warn=all.filter(x=>x.kind==="warn").length,ok=all.filter(x=>x.kind==="ok").length;
    const sum=document.getElementById("auditSummary");if(sum)sum.innerHTML=`<div class="bulk-summary"><div class="bulk-stat"><strong>${new Set(all.map(x=>x.section)).size}</strong><small>Sections</small></div><div class="bulk-stat"><strong>${all.length}</strong><small>Teacher-subject mappings</small></div><div class="bulk-stat"><strong>${noTeacher}</strong><small>Missing teachers</small></div><div class="bulk-stat"><strong>${noPlan}</strong><small>No Year Plan</small></div><div class="bulk-stat"><strong>${bad+warn}</strong><small>Capture issues</small></div><div class="bulk-stat"><strong>${ok}</strong><small>Usable now</small></div></div>`;
    const rows=all.filter(x=>{const text=[x.section,x.subject,x.teacher,x.plan?.fileName,x.status].join(" ").toLowerCase();return(!q||text.includes(q))&&(f==="all"||(f==="issues"&&x.kind!=="ok")||(f==="ok"&&x.kind==="ok"))});
    const tb=document.getElementById("auditTable");if(tb)tb.innerHTML=rows.map(x=>`<tr><td><b>${esc(x.section)}</b></td><td>${esc(x.subject)}</td><td>${esc(x.teacher||"MISSING")}</td><td>${x.plan?esc(x.plan.fileName):"—"}</td><td>${x.rows.length}${x.blank?` <small>(${x.blank} blank)</small>`:""}</td><td>${x.start?`${esc(x.start)} → ${esc(x.end)}`:"—"}</td><td><span class="${x.kind==="ok"?"status-good":x.kind==="warn"?"status-warn":"status-bad"}">${esc(x.status)}</span></td><td>${x.plan&&x.kind!=="ok"?`<button onclick="reprocessStoredPlan('${x.plan.id}')">Re-capture</button>`:""}</td></tr>`).join("")||'<tr><td colspan="8">No rows for this filter.</td></tr>'
  }

  window.reprocessStoredPlan=async id=>{
    if(currentUser?.role!=="Super Admin")return;const p=data.plans.find(x=>x.id===id);if(!p)return;
    if(!confirm(`Re-capture dated syllabus rows from the stored original file?\n\n${p.fileName}\n\nExisting class/subject assignments will be preserved.`))return;
    try{
      const signed=await remoteCall("yearplan_url",{id}),resp=await fetch(signed.url);if(!resp.ok)throw new Error("Could not read the stored source file.");const blob=await resp.blob(),file=new File([blob],p.fileName,{type:p.fileType||blob.type||"application/octet-stream"});
      const d=await smartParse(file),subjects=planSubjects(p).map(canonicalSubject),grades=new Set((p.assignedSections||[]).map(s=>Number(sectionMeta(s).grade))),parsed=(d.rows||[]).filter(r=>(!r.grade||grades.has(Number(r.grade)))&&subjects.some(s=>same(s,r.subject||subjects[0])));
      if(!parsed.length)throw new Error("Re-capture found no usable dated rows. The existing data was not changed.");
      if(d.captureIncomplete)throw new Error(d.captureWarning||"Source capture is incomplete; existing data was not changed.");
      for(const s of subjects){if(!parsed.some(r=>same(r.subject||subjects[0],s))&&subjects.length>1)throw new Error(`Re-capture did not find ${s}. Existing shared-plan data was not changed.`)}
      const subject_ids=subjects.map(s=>REMOTE.subjectIdByName.get(s)).filter(Boolean),section_ids=(p.assignedSections||[]).map(s=>REMOTE.sectionIdByName.get(s)).filter(Boolean);if(subject_ids.length!==subjects.length)throw new Error("A linked subject is missing from Subject Master.");
      const weeks=parsed.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||String(a.subject).localeCompare(String(b.subject))).map((r,i)=>({week_no:i+1,week_label:dateRangeLabel(r.startDate,r.endDate),start_date:r.startDate||null,end_date:r.endDate||null,working_days:r.workingDays??null,planned_periods:r.plannedPeriods??null,topic:r.topic||"",grade:r.grade??null,subject_id:REMOTE.subjectIdByName.get(canonicalSubject(r.subject||subjects[0]))||subject_ids[0],source_row:i+1}));
      await smartApi({action:"save",id:p.id,department:p.department||subjects.map(departmentForSubject).filter(Boolean).join(" / "),subject_ids,section_ids,weeks,parse_status:"parsed",parse_message:`Source re-capture: ${weeks.length} dated row(s) · ${new Date().toLocaleString("en-IN")}`});await reloadRemote();renderAll();ensureAuditPanel();renderIntegrityAudit();alert(`Re-capture completed: ${weeks.length} dated row(s) restored from the original file.`)
    }catch(e){alert(e.message||String(e))}
  };

  const baseRenderPlansAudit=renderPlans;
  renderPlans=function(){baseRenderPlansAudit();if(currentUser?.role!=="Super Admin")return;document.querySelectorAll("#planCards .plan-card").forEach(card=>{const title=card.querySelector("strong")?.textContent||"",subject=canonicalSubject((card.querySelector(".sub")?.textContent||"").split(" · ")[0]),p=(data.plans||[]).find(x=>x.fileName===title&&planHasSubject(x,subject));const a=card.querySelector(".plan-actions");if(p&&a&&!a.querySelector(".recapture-btn")){const b=document.createElement("button");b.className="recapture-btn";b.textContent="Re-capture Source";b.onclick=()=>reprocessStoredPlan(p.id);a.insertBefore(b,a.firstChild)}})};

  const baseRenderSetupAudit=renderSetup;
  renderSetup=function(){baseRenderSetupAudit();ensureAuditPanel();renderIntegrityAudit()};
  const baseRenderAllAudit=renderAll;
  renderAll=function(){baseRenderAllAudit();if(currentUser?.role==="Super Admin"){ensureAuditPanel();renderIntegrityAudit()}};

  const sourceRecoveryCache=new Map();
  async function recoverWeeklyFromStoredSource(section,subject,plan,start,end){
    if(!plan||!start)return;const key=plan.id;try{
      let d=sourceRecoveryCache.get(key);if(!d){const signed=await remoteCall("yearplan_url",{id:plan.id}),resp=await fetch(signed.url);if(!resp.ok)return;const blob=await resp.blob(),file=new File([blob],plan.fileName,{type:plan.fileType||blob.type||"application/octet-stream"});d=await smartParse(file);sourceRecoveryCache.set(key,d)}
      const grade=Number(sectionMeta(section).grade),rows=(d.rows||[]).filter(r=>(!r.grade||Number(r.grade)===grade)&&same(canonicalSubject(r.subject||subject),subject));
      let found=rows.find(r=>r.startDate===start&&(r.endDate||r.startDate)===(end||start));if(!found)found=rows.find(r=>r.startDate<=start&&(r.endDate||r.startDate)>=start);if(!found||!String(found.topic||"").trim())return;
      const box=document.getElementById("wkPlanned");if(box)box.value=found.topic||"";const days=document.getElementById("wkDays");if(days&&found.workingDays!=null)days.value=found.workingDays;const pp=document.getElementById("wkPlannedPeriods");if(pp&&found.plannedPeriods!=null)pp.value=found.plannedPeriods;const note=document.getElementById("weeklyStatus");if(note){note.textContent=`Syllabus recovered directly from the stored Year Plan source: ${plan.fileName}`;note.classList.remove("error")}
    }catch(e){console.warn("Live Year Plan source recovery",e)}
  }
  const baseFillWeeklyAudit=fillWeeklyFromPlan;
  fillWeeklyFromPlan=function(){const r=baseFillWeeklyAudit();try{const section=document.getElementById("wkSection")?.value,subject=canonicalSubject(document.getElementById("wkSubject")?.value||""),week=document.getElementById("wkWeek")?.value;if(section&&subject&&week){const x=planRowsFor(section,subject),row=(x.rows||[]).find(w=>same(w.week||w.weekLabel,week)||same(dateRangeLabel(w.startDate,w.endDate),week));if(row&&!String(row.topic||"").trim()){const box=document.getElementById("wkPlanned");if(box)box.value="Recovering syllabus from original Year Plan…";const note=document.getElementById("weeklyStatus");if(note){note.textContent="Stored week row is incomplete. Reading the original Year Plan source…";note.classList.add("error")}setTimeout(()=>recoverWeeklyFromStoredSource(section,subject,x.plan,row.startDate,row.endDate),0)}}}catch(e){}return r};
})();