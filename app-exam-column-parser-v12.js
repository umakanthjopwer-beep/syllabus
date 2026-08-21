// Authoritative Exam Syllabus parser: one subject column = one syllabus region.
// No cross-column row concatenation and no legacy inference.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  let pdfPromise=null,runId=0,state=null,boundInput=null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const text=v=>String(v??"").trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v):text(v);
  const escHtml=v=>typeof esc==="function"?esc(v):text(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const compact=v=>text(v).toUpperCase().replace(/[^A-Z0-9&]+/g,"");
  const words=v=>text(v).toUpperCase().replace(/[^A-Z0-9&]+/g," ").replace(/\s+/g," ").trim();

  function appSections(){try{return Array.isArray(SECTIONS)?SECTIONS:[]}catch(_){return[]}}
  function activeMappings(){try{return data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}catch(_){return[]}}
  function subjectsFor(section){return uniq(activeMappings().filter(m=>m.section===section).map(m=>canon(m.subject)))}
  function teacherFor(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return activeMappings().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function sid(section){try{return REMOTE?.sectionIdByName?.get(section)||null}catch(_){return null}}
  function subid(subject){try{return REMOTE?.subjectIdByName?.get(canon(subject))||null}catch(_){return null}}
  function tid(section,subject){const name=teacherFor(section,subject);try{return REMOTE?.teacherIdByName?.get(name)||null}catch(_){return null}}
  function sectionLabel(section){const s=appSections().find(x=>x.section===section);return s?[s.section,s.batch,s.program].filter(Boolean).join(" · "):section}

  const SUBJECTS=[
    ["Track A",["TRACK A","MATH A","MATHS A","MAT A","MATHEMATICS A"]],
    ["Track B",["TRACK B","MATH B","MATHS B","MAT B","MATHEMATICS B"]],
    ["Physics",["PHYSICS","PHYS","PHY"]],
    ["Chemistry",["CHEMISTRY","CHEM"]],
    ["Biology",["BIOLOGY","BIO"]],
    ["Reasoning",["REASONING","A&R","A & R","ARITHMETIC & REASONING"]],
    ["English",["ENGLISH","ENG"]],
    ["Social",["SOCIAL","SOCIAL STUDIES","SOCIAL SCIENCE","SOC"]],
    ["SL Telugu",["SL TELUGU","SECOND LANGUAGE TELUGU"]],
    ["TL Telugu",["TL TELUGU","THIRD LANGUAGE TELUGU"]],
    ["SL Hindi",["SL HINDI","SECOND LANGUAGE HINDI"]],
    ["TL Hindi",["TL HINDI","THIRD LANGUAGE HINDI"]],
    ["IT",["INFORMATION TECHNOLOGY","COMPUTER SCIENCE","COMPUTER","IT"]]
  ];
  const aliasMap=new Map();
  for(const[name,aliases]of SUBJECTS)for(const a of aliases)aliasMap.set(compact(a),name);
  function exactSubject(v){const name=aliasMap.get(compact(v))||null;return name&&subid(name)?name:null}

  function examSignals(fileName){
    const s=text(fileName).replace(/\.[^.]+$/," "),level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i),test=s.match(/\b(?:BIWEEKLY\s+TEST|BIWT)\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    if(!level||!test||!/\bC\s*[- ]?BATCH\b|\bBIWEEKLY\s+TEST\b|\bBIWT\b/i.test(s))return null;
    const n=Number(level[1]);return{grade:11-n,level:`C${n}`,examName:`C Batch BIWT ${Number(test[1])}`}
  }
  function dateFrom(fileName,lines=[]){
    for(const v of [fileName,...lines]){const m=text(v).match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);if(!m)continue;let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);if(y>=2020&&y<=2035&&mo>=1&&mo<=12&&d>=1&&d<=31)return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}
    return""
  }

  function isPattern(v){
    const s=words(v);
    return /\b(PAPER\s+PATTERN|MATHEMATICS\s+PATTERN|PHYSICS\s+PATTERN|CHEMISTRY\s+PATTERN|BIOLOGY\s+PATTERN|OBJECTIVE\s+TEST|STRAIGHT\s+OBJECTIVE|OBJECTIVE\s+TYPE|QUESTION(?:S)?|NO\s+OF\s+QUESTIONS|TOTAL\s+QUESTIONS|TOTAL\s+MARKS|EACH\s+QUESTION|MARKS?|CORRECT\s+ANSWER|WRONG\s+ANSWER|NEGATIVE\s+MARK|MULTIPLE\s+CHOICE|SINGLE\s+CORRECT|MULTI\s+CORRECT|INTEGER\s+TYPE|MATRIX\s+MATCH|ASSERTION|PASSAGE|DURATION|TIME\s+ALLOWED|INSTRUCTIONS?|ALL\s+THE\s+BEST)\b/.test(s)||/\b\d+\s*(?:TO|-)\s*\d+\b.*\b\d+\s*[X×]\s*\d+\b/.test(s)||/\b\d+\s*[X×]\s*\d+\s*=\s*\d+\b/.test(s)
  }
  function isMeta(v){const s=words(v);return !s||/SRI\s+CHAITANYA|NORTH\s+INDIA|\bCBSE\b|C\s*[- ]?BATCH|BIWEEKLY\s+TEST|\bBIWT\b|EXAM\s+DATE|ACADEMIC\s+YEAR|SYLLABUS\s+FOR|PAGE\s+\d+/.test(s)}
  function isHeader(v){return /^(S\.?\s*NO\.?|SL\.?\s*NO\.?|SUBJECT|SYLLABUS|PORTION|CHAPTERS?|TOPICS?|REMARKS?|DATE|MARKS?)$/i.test(text(v))}
  function clean(v){return text(v).replace(/^[|,:;\-–—\s]+|[|,:;\-–—\s]+$/g,"").replace(/\s+/g," ").trim()}
  function cutPattern(v){const s=clean(v);const re=/\b(PAPER\s+PATTERN|MATHEMATICS\s+PATTERN|PHYSICS\s+PATTERN|CHEMISTRY\s+PATTERN|BIOLOGY\s+PATTERN|OBJECTIVE\s+TEST|STRAIGHT\s+OBJECTIVE|OBJECTIVE\s+TYPE|ALL\s+THE\s+BEST)\b/i;const m=re.exec(s);return m?clean(s.slice(0,m.index)):s}
  function validTopic(v){const s=clean(v);if(s.length<2||s.length>350||isMeta(s)||isPattern(s)||isHeader(s)||exactSubject(s))return false;return /[A-Za-z]/.test(s)}
  function addTopic(map,subject,v){const s=cutPattern(v);if(!validTopic(s))return;if(!map.has(subject))map.set(subject,[]);const a=map.get(subject);if(!a.some(x=>x.toLowerCase()===s.toLowerCase()))a.push(s)}

  function groupRows(items){
    const rows=[];
    for(const it of items){let row=rows.find(r=>Math.abs(r.y-it.y)<=4.2);if(!row){row={y:it.y,items:[]};rows.push(row)}row.items.push(it)}
    rows.sort((a,b)=>b.y-a.y);for(const r of rows)r.items.sort((a,b)=>a.x-b.x);return rows
  }
  function rowText(items){return clean(items.map(z=>z.v).join(" "))}
  function subjectWindows(row){
    const a=row.items,out=[];
    for(let i=0;i<a.length;i++)for(let j=i;j<Math.min(a.length,i+10);j++){
      const slice=a.slice(i,j+1),joined=slice.map(z=>z.v).join(" "),tight=slice.map(z=>z.v).join(""),name=exactSubject(joined)||exactSubject(tight);if(!name)continue;
      if(compact(tight).length>28)continue;const x1=slice[0].x,x2=slice[slice.length-1].x+(slice[slice.length-1].w||0);out.push({name,i,j,x1,x2,cx:(x1+x2)/2,y:row.y})
    }
    out.sort((u,v)=>(u.j-u.i)-(v.j-v.i)||u.i-v.i);
    const keep=[];for(const h of out){if(keep.some(k=>k.name===h.name&&Math.abs(k.cx-h.cx)<18))continue;keep.push(h)}
    return keep.sort((u,v)=>u.cx-v.cx)
  }
  function allAnchors(page){const out=[];page.rows.forEach((row,ri)=>subjectWindows(row).forEach(h=>out.push({...h,ri})));return out}
  function mergeWrapped(lines){
    const out=[];for(const raw of lines){const s=clean(raw);if(!validTopic(s))continue;if(!out.length){out.push(s);continue}const prev=out[out.length-1];
      const continuation=/^(AND|OR|OF|THE|IN|ON|WITH|TO|FOR)\b/i.test(s)||/\b(OF|AND|OR|WITH|IN|ON|TO|FOR)$/i.test(prev)||(/^[A-Za-z][A-Za-z\s-]{1,26}$/.test(s)&&/^\s*\d+[.)-]/.test(prev));
      if(continuation)out[out.length-1]=`${prev} ${s}`.replace(/\s+/g," ").trim();else out.push(s)
    }return uniq(out)
  }

  function findColumnHeader(page,anchors){
    const byRow=new Map();for(const a of anchors){if(!byRow.has(a.ri))byRow.set(a.ri,[]);byRow.get(a.ri).push(a)}
    const candidates=[];
    for(const[ri,list]of byRow){const names=uniq(list.map(x=>x.name));if(names.length<2)continue;const picked=[];for(const name of names){const same=list.filter(x=>x.name===name).sort((a,b)=>(a.j-a.i)-(b.j-b.i));picked.push(same[0])}candidates.push({ri,heads:picked.sort((a,b)=>a.cx-b.cx),count:names.length})}
    return candidates.sort((a,b)=>b.count-a.count||a.ri-b.ri)[0]||null
  }
  function columnBounds(heads){
    const cs=heads.map(h=>h.cx),out=[];
    for(let i=0;i<heads.length;i++){
      const left=i===0?(heads.length>1?cs[0]-(cs[1]-cs[0])/2:heads[i].x1-40):(cs[i-1]+cs[i])/2;
      const right=i===heads.length-1?(heads.length>1?cs[i]+(cs[i]-cs[i-1])/2:heads[i].x2+180):(cs[i]+cs[i+1])/2;
      out.push({subject:heads[i].name,left,right})
    }return out
  }
  function parseColumns(page,header){
    const heads=header.heads,bounds=columnBounds(heads),subjects=uniq(heads.map(h=>h.name)),topics=new Map(),lines=new Map(subjects.map(s=>[s,[]])),stopped=new Set();
    for(let ri=header.ri+1;ri<page.rows.length;ri++){
      const row=page.rows[ri];
      const laterHeads=subjectWindows(row);if(laterHeads.length>=2)break;
      for(const b of bounds){
        if(stopped.has(b.subject))continue;
        const cells=row.items.filter(z=>{const c=z.x+(z.w||0)/2;return c>b.left&&c<=b.right});
        if(!cells.length)continue;let t=rowText(cells);if(!t)continue;
        if(exactSubject(t)||isHeader(t)||isMeta(t))continue;
        if(isPattern(t)){const before=cutPattern(t);if(validTopic(before))lines.get(b.subject).push(before);stopped.add(b.subject);continue}
        if(validTopic(t))lines.get(b.subject).push(t)
      }
    }
    for(const s of subjects)for(const t of mergeWrapped(lines.get(s)||[]))addTopic(topics,s,t);
    return{layout:"subject columns",subjects,topics}
  }

  function syllabusX(page){const xs=[];for(const row of page.rows)for(const it of row.items){if(/^(SYLLABUS|PORTION|CHAPTERS?|TOPICS?)$/.test(words(it.v)))xs.push(it.x)}return xs.length?Math.min(...xs):null}
  function parseRows(page,anchors){
    if(!anchors.length)return null;const ordered=[...anchors].sort((a,b)=>a.ri-b.ri||a.cx-b.cx),topics=new Map(),subjects=uniq(ordered.map(a=>a.name)),sx=syllabusX(page);
    for(let ai=0;ai<ordered.length;ai++){
      const a=ordered[ai],next=ordered.slice(ai+1).find(x=>x.ri>a.ri),endRi=next?next.ri:page.rows.length,lines=[];
      for(let ri=a.ri;ri<endRi;ri++){
        const row=page.rows[ri];if(ri>a.ri&&subjectWindows(row).length)break;
        let cells;if(ri===a.ri)cells=row.items.filter(z=>z.x>a.x2+4&&(sx==null||z.x>=sx-8));else cells=row.items.filter(z=>sx!=null?z.x>=sx-8:z.x>a.x2+4);
        if(!cells.length)continue;let t=rowText(cells);if(!t)continue;if(isPattern(t)){const before=cutPattern(t);if(validTopic(before))lines.push(before);break}if(validTopic(t))lines.push(t)
      }
      for(const t of mergeWrapped(lines))addTopic(topics,a.name,t)
    }
    return{layout:"subject rows",subjects,topics}
  }
  function parsePage(page){const anchors=allAnchors(page);if(!anchors.length)return null;const header=findColumnHeader(page,anchors);if(header)return parseColumns(page,header);return parseRows(page,anchors)}
  function parseDocument(pages){
    const subjects=[],topics=new Map(),layouts=[];
    for(const page of pages){const p=parsePage(page);if(!p)continue;layouts.push(p.layout);for(const s of p.subjects){if(!subjects.includes(s))subjects.push(s);for(const t of p.topics.get(s)||[])addTopic(topics,s,t)}}
    for(const s of subjects)topics.set(s,mergeWrapped(topics.get(s)||[]));return{subjects,topics,layout:uniq(layouts).join(" + ")||"geometry"}
  }

  async function pdfLib(){if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfPromise)return pdfPromise;pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfPromise}
  async function readPdf(file){
    const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,pages=[],lines=[];
    for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),tc=await pg.getTextContent(),items=[];for(const it of tc.items||[]){const v=text(it.str);if(!v)continue;items.push({v,x:Number(it.transform?.[4]||0),y:Number(it.transform?.[5]||0),w:Number(it.width||0),h:Number(it.height||0)})}const rows=groupRows(items);pages.push({page:p,rows});for(const r of rows){const l=rowText(r.items);if(l)lines.push(l)}}
    return{pages,lines}
  }
  function buildMappings(sig,parsed){
    const targets=appSections().filter(s=>Number(s.grade)===Number(sig.grade)&&s.program==="C Batch").map(s=>s.section),out=[];
    for(const sec of targets)for(const sub of parsed.subjects){if(!subjectsFor(sec).includes(canon(sub)))continue;out.push({section:sec,subject:canon(sub),teacher:teacherFor(sec,sub),topics:uniq(parsed.topics.get(sub)||[]),source:`PDF ${parsed.layout}`})}
    return out
  }

  function setMsg(msg,bad=false){const x=q("#examAutoMsg");if(x){x.textContent=msg;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}}
  function renderScanning(sig){const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(sum)sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(sig.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>Detecting…</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>—</strong></div>`;if(host)host.innerHTML='<div class="exam-auto-empty"><strong>Reading each subject column separately…</strong><br>Text cannot cross from one subject column into another.</div>';if(btn){btn.disabled=true;btn.onclick=null}}
  function renderResult(){
    if(!state)return;const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;
    sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(state.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(state.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${state.mappings.length}</strong></div>`;
    if(!state.mappings.length){host.innerHTML='<div class="exam-auto-empty">No reliable subject-wise syllabus mapping was detected. Nothing has been auto-added.</div>';btn.disabled=true;return}
    host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Detected syllabus</th><th>Detection</th></tr></thead><tbody>${state.mappings.map((m,i)=>`<tr><td><input class="exam-v12-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td><strong>${escHtml(m.subject)}</strong></td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length?`<strong>${m.topics.length} topic(s)</strong><details><summary style="cursor:pointer;color:#345f91">View syllabus</summary><div style="max-width:330px;white-space:normal;margin-top:5px">${m.topics.map(t=>`• ${escHtml(t)}`).join("<br>")}</div></details>`:'<span style="color:#a43c36;font-weight:700">No syllabus text detected for this subject</span>'}</td><td>${escHtml(m.source)}</td></tr>`).join("")}</tbody></table></div>`;
    const missing=uniq(state.mappings.filter(m=>!m.topics.length).map(m=>m.subject));btn.disabled=missing.length>0;btn.onclick=missing.length?null:save
  }
  function syncReview(){if(!state)return;for(const[id,v]of [["#examAutoName",state.examName],["#examAutoDate",state.examDate],["#examAutoDeadline",state.examDate],["#examAutoOrientation","C Batch"],["#examName",state.examName],["#examDate",state.examDate],["#examDeadline",state.examDate]]){const x=q(id);if(x)x.value=v||""}}
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function save(){
    if(!state?.file)return;const chosen=qa(".exam-v12-use:checked").map(x=>state.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMsg("Keep at least one detected mapping selected.",true);return}
    const missing=uniq(chosen.filter(m=>!m.topics.length).map(m=>m.subject));if(missing.length){setMsg(`Cannot save. Missing syllabus text for: ${missing.join(", ")}.`,true);return}
    const mappings=chosen.map(m=>({section_id:sid(m.section),subject_id:subid(m.subject),teacher_id:tid(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id),btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";
    try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(state.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:state.examName,exam_date:state.examDate||null,completion_deadline:state.examDate||null,file_name:state.file.name,file_size:state.file.size,file_base64,mappings});setMsg(`Saved ${r.count||mappings.length} subject-wise mapping(s).`);const inp=q("#examAutoPdf");if(inp)inp.value="";q("#examRefreshBtn")?.click()}catch(e){setMsg(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}
  }
  async function process(file,sig,id){
    renderScanning(sig);
    try{const raw=await readPdf(file);if(id!==runId)return;const parsed=parseDocument(raw.pages),examDate=dateFrom(file.name,raw.lines),mappings=buildMappings(sig,parsed);state={file,examName:sig.examName,examDate,grade:sig.grade,mappings,parsed};renderResult();syncReview();const names=uniq(mappings.map(m=>m.subject)),missing=uniq(mappings.filter(m=>!m.topics.length).map(m=>m.subject));if(!mappings.length)setMsg("No reliable subject-wise syllabus mapping was found. Nothing was added.",true);else if(missing.length)setMsg(`Subjects detected: ${names.join(", ")}. Syllabus text is still missing for ${missing.join(", ")}; Save remains disabled.`,true);else setMsg(`Subject columns captured separately for ${names.join(", ")}. Review each View syllabus once, then save.`)}catch(e){if(id!==runId)return;state=null;setMsg(`Could not read this PDF reliably: ${e.message||e}`,true);const btn=q("#examAutoSave");if(btn)btn.disabled=true}
  }
  function handleChange(){const input=q("#examAutoPdf"),file=input?.files?.[0],sig=examSignals(file?.name||"");if(!file)return;if(!sig){setMsg("This automatic parser currently expects a C-Batch BIWT PDF filename with C1-C5 and BIWEEKLY TEST/BIWT.",true);return}const id=++runId;state=null;process(file,sig,id)}
  function bind(){const input=q("#examAutoPdf");if(!input||input===boundInput)return;boundInput=input;input.onchange=handleChange;const btn=q("#examAutoSave");if(btn){btn.onclick=save;btn.disabled=true}}
  const observer=new MutationObserver(bind);observer.observe(document.body,{childList:true,subtree:true});setInterval(bind,1200);bind()
})();
