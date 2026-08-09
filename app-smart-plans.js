const SMART_PLAN_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/yearplan-smart-api";
let smartDraft=null;

const _applyRemoteDataSmart=applyRemoteData;
applyRemoteData=function(r){
  _applyRemoteDataSmart(r);
  const rawWeeks=r.weeks||[];
  for(const p of data.plans){
    const pw=rawWeeks.filter(w=>w.year_plan_id===p.id);
    const subjects=[...new Set([p.subject,...pw.map(w=>canonicalSubject(REMOTE.subjectById.get(w.subject_id)?.name||"")).filter(Boolean)])];
    p.subjects=subjects;
    p.weeks=pw.map(w=>({
      week:w.week_label||dateRangeLabel(w.start_date,w.end_date),weekLabel:w.week_label||dateRangeLabel(w.start_date,w.end_date),weekNo:Number(w.week_no||0),
      startDate:w.start_date||"",endDate:w.end_date||"",workingDays:w.working_days==null?null:Number(w.working_days),plannedPeriods:w.planned_periods==null?null:Number(w.planned_periods),
      topic:w.topic||"",grade:w.grade==null?null:Number(w.grade),subject:canonicalSubject(REMOTE.subjectById.get(w.subject_id)?.name||p.subject)
    }));
  }
};

function dateRangeLabel(a,b){
  if(!a)return"";const f=s=>{const d=new Date(s+"T00:00:00");return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})};
  return !b||a===b?f(a):`${f(a)} - ${f(b)}`;
}
function planSubjects(p){return p.subjects?.length?p.subjects:[p.subject].filter(Boolean)}
function planHasSubject(p,s){return planSubjects(p).some(x=>same(x,s))}
function planRowsFor(section,subject){const g=Number(sectionMeta(section).grade);const p=visiblePlans().find(x=>x.enabled!==false&&x.assignedSections.includes(section)&&planHasSubject(x,subject));if(!p)return{plan:null,rows:[]};return{plan:p,rows:(p.weeks||[]).filter(w=>(w.grade==null||Number(w.grade)===g)&&same(w.subject||p.subject,subject)).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))}}

function smartStyles(){
  if(document.getElementById("smartPlanStyles"))return;const s=document.createElement("style");s.id="smartPlanStyles";s.textContent=`
  .smart-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0 20px}.smart-step{text-align:center;position:relative;font-size:10px;color:#8793a5;font-weight:800}.smart-step b{width:34px;height:34px;margin:0 auto 7px;border-radius:50%;display:grid;place-items:center;background:#edf1f6;color:#78879c}.smart-step.done b{background:#e5f7ef;color:#14845b}.smart-step.active b{background:#2359a7;color:#fff}.smart-file{border:1px solid #dce4ef;border-radius:14px;padding:15px;display:flex;gap:12px;align-items:center}.smart-file-icon{width:50px;height:50px;border-radius:12px;background:#eaf1fc;color:#1c57a3;display:grid;place-items:center;font-weight:900}.smart-file-info{flex:1;min-width:0}.smart-file-info strong,.smart-file-info small{display:block}.smart-file-info strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.smart-file-info small{font-size:10px;color:#8794a6;margin-top:5px}.smart-detect{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.detect-card{border:1px solid #dce4ef;border-radius:11px;padding:11px}.detect-card small{display:block;color:#8995a6;font-size:8px;text-transform:uppercase;letter-spacing:.5px}.detect-card b{display:block;margin-top:6px;font-size:11px}.smart-choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.smart-choice{border:1px solid #d9e2ee;border-radius:11px;padding:11px;display:flex;gap:9px;align-items:flex-start;background:#fff}.smart-choice.selected{border-color:#3271ce;background:#f2f7ff;box-shadow:inset 0 0 0 1px #3271ce}.smart-choice input{accent-color:#2664bd}.smart-choice b{font-size:10px}.smart-choice small{display:block;font-size:8px;color:#94a0b1;margin-top:4px}.smart-section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 10px}.smart-section-title h4{margin:0;font-size:13px}.smart-actions{display:flex;gap:6px;flex-wrap:wrap}.smart-actions button{border:1px solid #d8e1ec;background:#fff;border-radius:9px;padding:7px 9px;color:#28568f;font-size:9px;font-weight:800}.smart-verified{background:#eaf8f1;border:1px solid #bde8d3;color:#19714f;border-radius:12px;padding:12px 14px;font-size:10px;margin:12px 0}.smart-preview{max-height:330px;overflow:auto;border:1px solid #dfe6ef;border-radius:12px}.smart-preview table{min-width:720px}.recovered-chip{background:#fff6db;color:#8b6712}.smart-publish{display:flex;justify-content:space-between;align-items:center;gap:15px;padding-top:17px;border-top:1px solid #e4e9f0;margin-top:17px}.smart-publish strong{font-size:12px}.smart-publish small{display:block;color:#8b96a6;font-size:9px;margin-top:4px}@media(max-width:800px){.smart-detect,.smart-choice-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.smart-detect,.smart-choice-grid{grid-template-columns:1fr}.smart-publish{align-items:flex-start;flex-direction:column}.smart-publish .primary{width:100%}}
  `;document.head.appendChild(s)
}
function injectSmartYearPlans(){
  smartStyles();const sec=document.getElementById("yearplans");if(!sec||sec.dataset.smart==="1")return;sec.dataset.smart="1";
  sec.innerHTML=`
  <div class="page-head"><div><div class="eyebrow blue-text">YEAR PLANS</div><h2>Smart Year Plan import</h2><p>Upload the file once. Class, subject, orientation, sections and handling teachers are detected from the plan and existing school mapping.</p></div></div>
  <div class="panel" id="smartImportPanel">
    <div class="panel-head"><div><div class="eyebrow">NEW IMPORT</div><h3>Year-plan file</h3></div><span class="soft-badge">PDF · XLSX · XLS · CSV</span></div>
    <div class="smart-steps"><div class="smart-step active" id="sp1"><b>1</b>Upload</div><div class="smart-step" id="sp2"><b>2</b>Review</div><div class="smart-step" id="sp3"><b>3</b>Assign</div><div class="smart-step" id="sp4"><b>4</b>Publish</div></div>
    <div id="smartChooser"><label class="restore-box"><span><b>Choose Year Plan</b><br><small class="small-muted">No class, subject or teacher entry is required before upload.</small></span><input id="smartPlanFile" type="file" accept=".pdf,.xlsx,.xls,.csv"></label></div>
    <div id="smartReview" class="hidden"></div>
  </div>
  <div class="panel"><div class="panel-head"><div><div class="eyebrow">PUBLISHED PLANS</div><h3>Year-plan assignments</h3></div><input id="planSearch" class="search-input" placeholder="Search file, class, subject or section"></div><div id="planCards" class="plan-list"></div></div>`;
  document.getElementById("smartPlanFile").onchange=smartFileSelected;document.getElementById("planSearch").oninput=renderPlans;renderPlans()
}
async function loadPdfJs(){if(window.pdfjsLib)return window.pdfjsLib;await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";return window.pdfjsLib}
function romanGrade(v){return({VI:6,VII:7,VIII:8,IX:9,X:10})[String(v||"").toUpperCase()]||null}
function detectGrades(text,name=""){
  const set=new Set();for(const m of text.matchAll(/Class\s*:\s*(VI{1,3}|IX|X)\b/gi)){const g=romanGrade(m[1]);if(g)set.add(g)}
  for(const m of text.matchAll(/Classes?\s+(VI|VII|VIII|IX|X)(?:\s*(?:to|[-–])\s*(VI|VII|VIII|IX|X))?/gi)){const a=romanGrade(m[1]),b=romanGrade(m[2]);if(a)set.add(a);if(a&&b)for(let g=Math.min(a,b);g<=Math.max(a,b);g++)set.add(g)}
  if(!set.size){for(const m of name.matchAll(/\b(6|7|8|9|10)(?:th)?\b/gi))set.add(Number(m[1]))}return[...set].sort((a,b)=>a-b)
}
function detectSubjects(text,name=""){
  const z=(text+" "+name),set=new Set();if(/TL[-\s]*(?:Bal Vatika|Hindi)|Hindi\s*\(TL/i.test(z))set.add("TL Hindi");if(/SL\s*Hindi/i.test(z))set.add("SL Hindi");if(/TL\s*Telugu/i.test(z))set.add("TL Telugu");if(/SL\s*Telugu/i.test(z))set.add("SL Telugu");
  if(/Track\s*[-–]?\s*A/i.test(z))set.add("Track A");if(/Track\s*[-–]?\s*B/i.test(z))set.add("Track B");
  for(const [rx,s] of [[/Subject\s*:\s*Physics|\bPhysics Year Plan/i,"Physics"],[/Subject\s*:\s*Chemistry|chemistry.*Year Plan/i,"Chemistry"],[/Subject\s*:\s*Biology|biology.*Year Plan/i,"Biology"],[/Subject\s*:\s*English|english.*Year Plan/i,"English"],[/Subject\s*:\s*Social|social.*Year Plan/i,"Social"],[/Subject\s*:\s*IT\b|information technology.*Year Plan/i,"IT"]])if(rx.test(z))set.add(s);
  return[...set]
}
function parseDateCell(v){
  const s=String(v??"").replaceAll("‐","-").replaceAll("–","-").replaceAll(".","-");const ds=[...s.matchAll(/(\d{1,2})-(\d{1,2})-(\d{4})/g)].map(m=>`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`);return ds.length?[ds[0],ds[1]||ds[0]]:[null,null]
}
function excelSmartRows(wb,detectedSubjects){
  const out=[];for(const sn of wb.SheetNames){const ws=wb.Sheets[sn],matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});let header=-1,cols={};for(let i=0;i<Math.min(matrix.length,25);i++){const row=matrix[i].map(x=>String(x).trim());const di=row.findIndex(x=>/^date$/i.test(x));if(di>=0){header=i;cols.date=di;cols.days=row.findIndex(x=>/working.*days/i.test(x));cols.period=row.findIndex(x=>/^periods?$/i.test(x));cols.topic=row.findIndex(x=>/^topic|content|syllabus/i.test(x));cols.a=row.findIndex(x=>/track\s*[-–]?\s*a/i.test(x));cols.b=row.findIndex(x=>/track\s*[-–]?\s*b/i.test(x));break}}
    const text=matrix.slice(0,12).flat().join(" "),grades=detectGrades(text+" "+sn);const grade=grades[0]||null;if(header<0)continue;
    for(let i=header+1;i<matrix.length;i++){const r=matrix[i],[start,end]=parseDateCell(r[cols.date]);if(!start)continue;const days=Number(String(r[cols.days]??"").match(/\d+/)?.[0]||0)||null,period=Number(String(r[cols.period]??"").match(/\d+/)?.[0]||0)||null;
      if(cols.a>=0&&String(r[cols.a]||"").trim())out.push({grade,subject:"Track A",startDate:start,endDate:end,workingDays:days,plannedPeriods:period,topic:String(r[cols.a]).trim()});
      if(cols.b>=0&&String(r[cols.b]||"").trim())out.push({grade,subject:"Track B",startDate:start,endDate:end,workingDays:days,plannedPeriods:period,topic:String(r[cols.b]).trim()});
      if(cols.topic>=0&&String(r[cols.topic]||"").trim())out.push({grade,subject:detectedSubjects[0]||"",startDate:start,endDate:end,workingDays:days,plannedPeriods:period,topic:String(r[cols.topic]).trim()});
    }
  }return out
}
async function smartParse(file){
  const ext=file.name.split(".").pop().toLowerCase();let text="",pages=0,rows=[];
  if(["xlsx","xls","csv"].includes(ext)&&window.XLSX){const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});text=wb.SheetNames.map(n=>n+" "+XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");let subjects=detectSubjects(text,file.name);rows=excelSmartRows(wb,subjects);return smartDetection(file,text,wb.SheetNames.length,rows)}
  if(ext==="pdf"){const pdfjs=await loadPdfJs(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;pages=pdf.numPages;const chunks=[];for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i),tc=await pg.getTextContent();chunks.push(tc.items.map(x=>x.str).join(" "))}text=chunks.join("\n");return smartDetection(file,text,pages,[])}
  text=await file.text();return smartDetection(file,text,1,[])
}
function smartDetection(file,text,pages,rows){
  const grades=detectGrades(text,file.name),subjects=detectSubjects(text,file.name);if(rows.length){for(const r of rows){if(r.grade&&!grades.includes(r.grade))grades.push(r.grade);if(r.subject&&!subjects.includes(r.subject))subjects.push(r.subject)}}grades.sort((a,b)=>a-b);
  let maps=data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&grades.includes(Number(sectionMeta(m.section).grade))&&subjects.some(s=>same(s,m.subject)));
  let sections=[...new Set(maps.map(m=>m.section))];if(!sections.length)sections=SECTIONS.filter(s=>grades.includes(Number(s.grade))).map(s=>s.section);
  const orientations=[...new Set(sections.map(s=>sectionMeta(s).program).filter(Boolean))];const dateTokens=[...text.matchAll(/\b\d{1,2}[.\-]\d{1,2}[.\-]20\d{2}\b/g)].length;
  return{file,pages,text,grades,subjects,sections,orientations,rows,dateTokens}
}
async function smartFileSelected(e){
  const file=e.target.files[0];if(!file)return;const box=document.getElementById("smartReview");box.classList.remove("hidden");box.innerHTML='<div class="bulk-message">Reading file contents and matching the school handling map…</div>';setSmartStep(2);
  try{smartDraft=await smartParse(file);renderSmartReview()}catch(err){box.innerHTML=`<div class="login-error">Could not read this file: ${esc(err.message||err)}</div>`}
}
function setSmartStep(n){for(let i=1;i<=4;i++){const e=document.getElementById("sp"+i);if(e){e.classList.toggle("active",i===n);e.classList.toggle("done",i<n)}}}
function smartChoice(type,value,sub,checked=true){return`<label class="smart-choice ${checked?"selected":""}"><input type="checkbox" data-smart="${type}" value="${esc(value)}" ${checked?"checked":""}><div><b>${esc(value)}</b><small>${esc(sub||"")}</small></div></label>`}
function renderSmartReview(){
  const d=smartDraft,box=document.getElementById("smartReview");if(!d)return;const teacherPairs=data.setup.handlingMappings.filter(m=>d.sections.includes(m.section)&&d.subjects.includes(m.subject)).length;
  box.innerHTML=`<div class="smart-file"><div class="smart-file-icon">${d.file.name.split(".").pop().toUpperCase()}</div><div class="smart-file-info"><strong>${esc(d.file.name)}</strong><small>${(d.file.size/1024).toFixed(1)} KB · ${d.pages} ${d.file.type.includes("pdf")?"pages":"sheet(s)"} scanned</small></div><button id="smartChange" class="outline-btn">Change</button></div>
  <div class="smart-verified">✓ Content reviewed automatically. Final mapping can be corrected before publishing.</div>
  <div class="smart-detect"><div class="detect-card"><small>Detected class</small><b>${d.grades.length?d.grades.map(g=>`Class ${g}`).join(", "):"Review required"}</b></div><div class="detect-card"><small>Detected subject</small><b>${d.subjects.join(", ")||"Review required"}</b></div><div class="detect-card"><small>Detected orientation</small><b>${d.orientations.join(" / ")||"From section mapping"}</b></div><div class="detect-card"><small>Date content</small><b>${d.rows.length?d.rows.length+" structured rows":d.dateTokens+" date references found"}</b></div><div class="detect-card"><small>Applicable sections</small><b>${d.sections.length} selected automatically</b></div><div class="detect-card"><small>Teacher mappings</small><b>${teacherPairs} existing handling links</b></div></div>
  <div class="smart-section-title"><h4>Select one or more subjects</h4><div class="smart-actions"><button data-smart-action="subjects-detected">Detected</button><button data-smart-action="subjects-all">All</button><button data-smart-action="subjects-clear">Clear</button></div></div><div id="smartSubjects" class="smart-choice-grid">${ALL_SUBJECTS.map(s=>smartChoice("subject",s,departmentForSubject(s),d.subjects.includes(s))).join("")}</div>
  <div class="smart-section-title"><h4>Select applicable classes / sections</h4><div class="smart-actions"><button data-smart-action="sections-detected">Detected</button><button data-smart-action="c">Add C Batch</button><button data-smart-action="lead">Add Lead</button><button data-smart-action="techno">Add Techno</button><button data-smart-action="sections-clear">Clear</button></div></div><div id="smartSections" class="smart-choice-grid">${SECTIONS.map(s=>smartChoice("section",s.section,`${s.batch} · ${s.program}`,d.sections.includes(s.section))).join("")}</div>
  <div class="smart-section-title"><h4>Verified content structure</h4><span class="soft-badge">Actual date ranges</span></div><div class="smart-preview">${smartPreviewTable(d)}</div>
  <div class="smart-publish"><div><strong id="smartCount">${d.subjects.length} subject(s) · ${d.sections.length} section(s)</strong><small>Handling teachers are assigned automatically from the existing class-subject mapping.</small></div><button id="smartPublish" class="primary">Publish Year Plan</button></div>`;
  document.getElementById("smartChange").onclick=()=>document.getElementById("smartPlanFile").click();box.querySelectorAll('input[data-smart]').forEach(i=>i.onchange=()=>{i.closest('.smart-choice').classList.toggle('selected',i.checked);smartSyncCount()});box.querySelectorAll('[data-smart-action]').forEach(b=>b.onclick=()=>smartAction(b.dataset.smartAction));document.getElementById("smartPublish").onclick=smartPublish;setSmartStep(3)
}
function smartPreviewTable(d){
  if(!d.rows.length)return`<div class="bulk-message">Class/subject/section detection is ready. This PDF contains ${d.dateTokens} date references; detailed row extraction will be retained when detected by the parser. Recovered old-app plans already include their class-specific dated rows.</div>`;
  return`<table><thead><tr><th>Date range</th><th>Class</th><th>Subject</th><th>Working days</th><th>Periods</th><th>Topic</th></tr></thead><tbody>${d.rows.slice(0,12).map(r=>`<tr><td>${esc(dateRangeLabel(r.startDate,r.endDate))}</td><td>${r.grade||"-"}</td><td>${esc(r.subject||"-")}</td><td>${r.workingDays??"-"}</td><td>${r.plannedPeriods??"-"}</td><td>${esc(r.topic||"-")}</td></tr>`).join("")}</tbody></table>`
}
function checkedSmart(type){return[...document.querySelectorAll(`input[data-smart="${type}"]:checked`)].map(i=>i.value)}
function smartAction(a){const set=(type,fn)=>document.querySelectorAll(`input[data-smart="${type}"]`).forEach(i=>{i.checked=fn(i.value);i.closest('.smart-choice').classList.toggle('selected',i.checked)});if(a==="subjects-detected")set("subject",v=>smartDraft.subjects.includes(v));if(a==="subjects-all")set("subject",()=>true);if(a==="subjects-clear")set("subject",()=>false);if(a==="sections-detected")set("section",v=>smartDraft.sections.includes(v));if(a==="sections-clear")set("section",()=>false);if(["c","lead","techno"].includes(a)){const p={c:"C Batch",lead:"Lead",techno:"Techno"}[a];document.querySelectorAll('input[data-smart="section"]').forEach(i=>{if(sectionMeta(i.value).program===p){i.checked=true;i.closest('.smart-choice').classList.add('selected')}})}smartSyncCount()}
function smartSyncCount(){const s=checkedSmart("subject"),c=checkedSmart("section");const e=document.getElementById("smartCount");if(e)e.textContent=`${s.length} subject(s) · ${c.length} section(s)`}
async function smartApi(payload){const r=await fetch(SMART_PLAN_API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${remoteToken()}`},body:JSON.stringify(payload)}),o=await r.json().catch(()=>({}));if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
async function smartPublish(){
  const subjects=checkedSmart("subject"),sections=checkedSmart("section"),btn=document.getElementById("smartPublish");if(!subjects.length||!sections.length){alert("Select at least one subject and one class/section.");return}const subject_ids=subjects.map(s=>REMOTE.subjectIdByName.get(s)).filter(Boolean),section_ids=sections.map(s=>REMOTE.sectionIdByName.get(s)).filter(Boolean);if(subject_ids.length!==subjects.length){alert("One selected subject is missing from the Subject Master.");return}
  const d=smartDraft;setBusy(btn,true,"Publishing…");try{const file_base64=await fileToBase64(d.file);const weeks=(d.rows||[]).filter(r=>subjects.includes(r.subject||subjects[0])&&(!r.grade||sections.some(s=>Number(sectionMeta(s).grade)===Number(r.grade)))).map((r,i)=>({week_no:i+1,week_label:dateRangeLabel(r.startDate,r.endDate),start_date:r.startDate||null,end_date:r.endDate||null,working_days:r.workingDays??null,planned_periods:r.plannedPeriods??null,topic:r.topic||"",grade:r.grade??null,subject_id:REMOTE.subjectIdByName.get(r.subject||subjects[0])||subject_ids[0]}));const departments=[...new Set(subjects.map(departmentForSubject).filter(Boolean))];await smartApi({action:"save",file_name:d.file.name,file_type:d.file.type||"application/octet-stream",file_size:d.file.size,file_base64,department:departments.join(" / "),subject_ids,section_ids,weeks,parse_status:weeks.length?"parsed":"partial",parse_message:`Smart import: ${d.pages} page/sheet(s), ${subjects.length} subject(s), ${sections.length} section(s)`});await reloadRemote();renderAll();injectSmartYearPlans();smartDraft=null;document.getElementById("smartReview").classList.add("hidden");document.getElementById("smartPlanFile").value="";setSmartStep(4);alert("Year Plan published. Teachers are linked automatically from Handling Classes.")}catch(e){alert(e.message||e)}finally{setBusy(btn,false)}
}

renderPlans=function(){
  const target=document.getElementById("planCards");if(!target)return;const q=(document.getElementById("planSearch")?.value||"").toLowerCase();const rows=visiblePlans().filter(p=>[p.fileName,p.department,planSubjects(p).join(" "),p.assignedSections.join(" ")].join(" ").toLowerCase().includes(q));target.innerHTML=rows.length?rows.map(p=>`<article class="plan-card ${p.enabled===false?"disabled":""}"><div><strong>${esc(p.fileName)}</strong><div class="sub">${esc(planSubjects(p).join(" · "))} · ${esc(p.department||"")}</div><div class="plan-meta"><span class="chip">${esc(p.assignedSections.join(", "))}</span><span class="chip">${(p.weeks||[]).length} dated rows</span><span class="chip ${p.storagePath?"":"recovered-chip"}">${p.storagePath?"File stored":"Recovered schedule"}</span><span class="chip">${p.enabled===false?"Disabled":"Active"}</span></div></div><div class="plan-actions">${p.storagePath?`<button onclick="viewPlan('${p.id}')">Open</button><button onclick="downloadPlan('${p.id}')">Download</button>`:""}${isAdmin()?`<button onclick="editPlan('${p.id}')">Edit</button><button onclick="togglePlan('${p.id}')">${p.enabled===false?"Enable":"Disable"}</button><button class="danger" onclick="deletePlan('${p.id}')">Delete</button>`:""}</div></article>`).join(""):'<div class="bulk-message">No Year Plans available.</div>'
};

applyWeekDates=function(){fillWeeklyFromPlan()};
updateWeeklySubjects=function(){const section=document.getElementById("wkSection")?.value;if(!section)return;const sc=currentScope(),mappingSubjects=[...new Set(data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&m.section===section&&(isAdmin()||sc.subjects.includes(m.subject))).map(m=>m.subject))];fillSelect(document.getElementById("wkSubject"),mappingSubjects.length?mappingSubjects:(isAdmin()?ALL_SUBJECTS:sc.subjects),document.getElementById("wkSubject")?.value||mappingSubjects[0]);setTimeout(fillWeeklyFromPlan,0)};
fillWeeklyFromPlan=function(){
  const section=document.getElementById("wkSection")?.value,subject=canonicalSubject(document.getElementById("wkSubject")?.value||"");if(!section||!subject)return;const {plan,rows}=planRowsFor(section,subject),weekSel=document.getElementById("wkWeek");if(rows.length){const old=weekSel.value;fillSelect(weekSel,rows.map(r=>r.weekLabel),rows.some(r=>r.weekLabel===old)?old:rows[0].weekLabel);const wr=rows.find(r=>r.weekLabel===weekSel.value)||rows[0];weekSel.dataset.weekNo=String(wr.weekNo||rows.indexOf(wr)+1);document.getElementById("wkStart").value=wr.startDate||"";document.getElementById("wkEnd").value=wr.endDate||"";document.getElementById("wkDays").value=wr.workingDays??"";document.getElementById("wkPlannedPeriods").value=wr.plannedPeriods??"";document.getElementById("wkPlanned").value=wr.topic||""}else{fillSelect(weekSel,["No dated Year Plan row"],"No dated Year Plan row");weekSel.dataset.weekNo="0";document.getElementById("wkStart").value="";document.getElementById("wkEnd").value="";document.getElementById("wkDays").value="";document.getElementById("wkPlannedPeriods").value="";document.getElementById("wkPlanned").value=""}document.getElementById("wkTeacher").value=handlingTeacher(section,subject)||"";autoLag()
};

saveWeekly=async function(){
  const section=$("#wkSection").value,subject=canonicalSubject($("#wkSubject").value),btn=$("#saveWeeklyBtn");if(!section||!subject){setStatus("#weeklyStatus","Select class and subject.",true);return}const section_id=REMOTE.sectionIdByName.get(section),subject_id=REMOTE.subjectIdByName.get(subject),teacher=handlingTeacher(section,subject)||norm($("#wkTeacher").value),teacher_id=REMOTE.teacherIdByName.get(teacher)||null,{plan,rows}=planRowsFor(section,subject),wr=rows.find(x=>x.weekLabel===$("#wkWeek").value);
  setBusy(btn,true,"Saving…");try{await remoteCall("weekly_save",{week_no:Number(wr?.weekNo||$("#wkWeek").dataset.weekNo||0),week_label:wr?.weekLabel||$("#wkWeek").value,section_id,subject_id,teacher_id,year_plan_id:plan?.id||null,week_start:$("#wkStart").value||null,week_end:$("#wkEnd").value||null,working_days:Number($("#wkDays").value||0),planned_periods:Number($("#wkPlannedPeriods").value||0),periods_taken:Number($("#wkTakenPeriods").value||0),periods_lagging:Number($("#wkLagPeriods").value||0),planned_topic:norm($("#wkPlanned").value),current_topic:norm($("#wkActual").value),reason:norm($("#wkReason").value)});await reloadRemote();setStatus("#weeklyStatus","Weekly status saved centrally.");renderAll();fillWeeklyFromPlan()}catch(e){setStatus("#weeklyStatus",e.message,true)}finally{setBusy(btn,false)}
};

const _smartInit=init;
init=function(){_smartInit();injectSmartYearPlans();const s=document.getElementById("wkSubject"),c=document.getElementById("wkSection"),w=document.getElementById("wkWeek");if(s)s.onchange=fillWeeklyFromPlan;if(c)c.onchange=()=>{updateWeeklySubjects();fillWeeklyFromPlan()};if(w)w.onchange=fillWeeklyFromPlan};
