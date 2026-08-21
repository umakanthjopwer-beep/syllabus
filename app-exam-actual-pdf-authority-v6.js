// Authoritative detector for C-Batch BIWT exam-syllabus PDFs.
// Hard rule: for a detected C-Batch BIWT PDF, only subjects actually found in the PDF may be auto-mapped.
// This capture-phase handler prevents older/generic inference handlers from inventing subjects.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  let pdfPromise=null,tessPromise=null,runId=0,state=null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v):txt(v);
  const escHtml=v=>typeof esc==="function"?esc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  function appSections(){try{return Array.isArray(SECTIONS)?SECTIONS:[]}catch(_){return[]}}
  function master(){try{return data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}catch(_){return[]}}
  function subjectsFor(section){return uniq(master().filter(m=>m.section===section).map(m=>canon(m.subject)))}
  function teacherFor(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return master().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function sid(section){try{return REMOTE?.sectionIdByName?.get(section)||null}catch(_){return null}}
  function subid(subject){try{return REMOTE?.subjectIdByName?.get(canon(subject))||null}catch(_){return null}}
  function tid(section,subject){const n=teacherFor(section,subject);try{return REMOTE?.teacherIdByName?.get(n)||null}catch(_){return null}}
  function sectionLabel(section){const s=appSections().find(x=>x.section===section);return s?[s.section,s.batch,s.program].filter(Boolean).join(" · "):section}

  function signals(name){
    const s=txt(name).replace(/\.[^.]+$/," ");
    const level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i),test=s.match(/\b(?:BIWEEKLY\s+TEST|BIWT)\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    if(!level||!test||!/\bC\s*[- ]?BATCH\b|\bBIWEEKLY\s+TEST\b|\bBIWT\b/i.test(s))return null;
    const n=Number(level[1]);return{grade:11-n,level:`C${n}`,examName:`C Batch BIWT ${Number(test[1])}`}
  }
  function dateFrom(name,lines=[]){for(const v of [name,...lines]){const m=txt(v).match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);if(!m)continue;let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);if(y>=2020&&y<=2035&&mo>=1&&mo<=12&&d>=1&&d<=31)return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}return""}

  const RULES=[
    ["Track A",[/\bTRACK\s*A\b/i,/\bMAT(?:H|HS|HEMATICS)?\s*[-:]?\s*A\b/i,/\bMATH(?:S|EMATICS)?\s*[-:]?\s*A\b/i]],
    ["Track B",[/\bTRACK\s*B\b/i,/\bMAT(?:H|HS|HEMATICS)?\s*[-:]?\s*B\b/i,/\bMATH(?:S|EMATICS)?\s*[-:]?\s*B\b/i]],
    ["Physics",[/\bPHYSICS\b/i,/\bPHYS\b/i,/\bPHY\b/i]],
    ["Chemistry",[/\bCHEMISTRY\b/i,/\bCHEM\b/i]],
    ["Biology",[/\bBIOLOGY\b/i,/\bBIO\b/i]],
    ["Reasoning",[/\bREASONING\b/i,/\bA\s*&\s*R\b/i]],
    ["English",[/\bENGLISH\b/i,/\bENG\b/i]],
    ["Social",[/\bSOCIAL(?:\s+STUDIES|\s+SCIENCE)?\b/i,/\bSOC\b/i]],
    ["SL Telugu",[/\b(?:SL|SECOND\s+LANGUAGE)\s*[-:]?\s*TELUGU\b/i]],
    ["TL Telugu",[/\b(?:TL|THIRD\s+LANGUAGE)\s*[-:]?\s*TELUGU\b/i]],
    ["SL Hindi",[/\b(?:SL|SECOND\s+LANGUAGE)\s*[-:]?\s*HINDI\b/i]],
    ["TL Hindi",[/\b(?:TL|THIRD\s+LANGUAGE)\s*[-:]?\s*HINDI\b/i]],
    ["IT",[/\bINFORMATION\s+TECHNOLOGY\b/i,/\bCOMPUTER(?:\s+SCIENCE)?\b/i,/\bIT\b/i]]
  ];
  function compact(v){return txt(v).toUpperCase().replace(/[^A-Z0-9&]+/g,"")}
  function hits(line){
    const normal=txt(line),c=compact(line),out=[];
    for(const[name,rs]of RULES){if(!subid(name))continue;let ok=rs.some(r=>r.test(normal));
      if(!ok){if(name==="Biology")ok=/BIOLOGY|\bBIO\b/.test(c);else if(name==="Physics")ok=/PHYSICS|PHYS/.test(c);else if(name==="Chemistry")ok=/CHEMISTRY|CHEM/.test(c);else if(name==="Track A")ok=/TRACKA|MATHSA|MATA/.test(c);else if(name==="Track B")ok=/TRACKB|MATHSB|MATB/.test(c)}
      if(ok)out.push(name)
    }
    return uniq(out)
  }
  function meta(v){return /sri\s+chaitanya|north\s+india|cbse|c\s*[- ]?batch|biweekly\s+test|\bbiwt\b|exam\s*date|date\s*[:.-]|total\s*marks|duration|instructions?|page\s*\d+|academic\s+year|syllabus\s*for/i.test(v)}
  function noise(v){return /^(s\.?\s*no\.?|sl\.?\s*no\.?|subject|syllabus|portion|chapters?|topics?|remarks?|date|marks?)$/i.test(txt(v))}
  function clean(v){return txt(v).replace(/^[|,:;\-–—\s]+|[|,:;\-–—\s]+$/g,"").replace(/\s+/g," ").trim()}
  function parse(lines,rawPages=[]){
    const subjects=new Set(),topics=new Map(),general=[];let current=[];
    for(const raw0 of lines){const raw=clean(raw0),h=hits(raw);if(h.length){current=h;h.forEach(s=>subjects.add(s));continue}if(!raw||raw.length<3||raw.length>500||meta(raw)||noise(raw))continue;if(current.length===1){const s=current[0];if(!topics.has(s))topics.set(s,[]);const a=topics.get(s);if(!a.some(x=>x.toLowerCase()===raw.toLowerCase()))a.push(raw)}else general.push(raw)}
    // Search whole-page compact glyph streams too. This catches large headings split into many PDF text fragments/coordinates.
    for(const page of rawPages){const c=compact(page);for(const[name]of RULES){if(!subid(name))continue;let ok=false;if(name==="Biology")ok=c.includes("BIOLOGY");else if(name==="Physics")ok=c.includes("PHYSICS");else if(name==="Chemistry")ok=c.includes("CHEMISTRY");else if(name==="Track A")ok=/TRACKA|MATHSA|MATA/.test(c);else if(name==="Track B")ok=/TRACKB|MATHSB|MATB/.test(c);if(ok)subjects.add(name)}}
    if(subjects.size===1){const s=[...subjects][0];if(!topics.has(s))topics.set(s,[]);const a=topics.get(s);for(const g of general){if(!a.some(x=>x.toLowerCase()===g.toLowerCase()))a.push(g)}}
    return{subjects:[...subjects],topics}
  }

  async function pdfLib(){if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfPromise)return pdfPromise;pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfPromise}
  async function readPdf(file){const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,lines=[],rawPages=[];for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),tc=await pg.getTextContent(),groups=new Map(),raw=[];for(const it of tc.items||[]){const v=txt(it.str);if(!v)continue;raw.push(v);const y=Math.round(it.transform?.[5]||0),x=Number(it.transform?.[4]||0);if(!groups.has(y))groups.set(y,[]);groups.get(y).push({x,v})}rawPages.push(raw.join(""));for(const[,items]of[...groups.entries()].sort((a,b)=>b[0]-a[0])){const l=items.sort((a,b)=>a.x-b.x).map(z=>z.v).join(" ").replace(/\s+/g," ").trim();if(l)lines.push(l)}}return{pdf,lines,rawPages}}
  async function loadTess(){if(globalThis.Tesseract)return globalThis.Tesseract;if(tessPromise)return tessPromise;const urls=["https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js","https://unpkg.com/tesseract.js@5/dist/tesseract.min.js"];tessPromise=(async()=>{let last;for(const url of urls){try{return await new Promise((resolve,reject)=>{const s=document.createElement("script");const timer=setTimeout(()=>reject(new Error("Visual reader load timeout")),20000);s.src=url;s.onload=()=>{clearTimeout(timer);globalThis.Tesseract?resolve(globalThis.Tesseract):reject(new Error("Visual reader unavailable"))};s.onerror=()=>{clearTimeout(timer);reject(new Error("Visual reader failed to load"))};document.head.appendChild(s)})}catch(e){last=e}}throw last||new Error("Visual reader unavailable")})();return tessPromise}
  async function ocr(pdf,id){const T=await loadTess(),out=[];for(let p=1;p<=pdf.numPages;p++){if(id!==runId)throw new Error("Scan replaced by a newer file");setMsg(`Visual scan page ${p}/${pdf.numPages}: preparing…`);const pg=await pdf.getPage(p),vp=pg.getViewport({scale:1.8}),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;const r=await T.recognize(canvas,"eng",{logger:m=>{if(id===runId&&m?.status==="recognizing text"&&typeof m.progress==="number")setMsg(`Visual scan page ${p}/${pdf.numPages}: ${Math.round(m.progress*100)}%`)}});for(const l of String(r?.data?.text||"").split(/\r?\n/)){const c=clean(l);if(c)out.push(c)}}return out}

  function build(sig,parsed,source){const targets=appSections().filter(s=>Number(s.grade)===Number(sig.grade)&&s.program==="C Batch").map(s=>s.section),out=[];for(const sec of targets)for(const sub of parsed.subjects){if(!subjectsFor(sec).includes(canon(sub)))continue;out.push({section:sec,subject:canon(sub),teacher:teacherFor(sec,sub),topics:uniq(parsed.topics.get(sub)||[]).slice(0,180),source})}return out}
  function setMsg(msg,bad=false){const x=q("#examAutoMsg");if(x){x.textContent=msg;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}}
  function renderScanning(sig,date){const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(sum)sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(sig.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(date||"Detecting…")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>—</strong></div>`;if(host)host.innerHTML='<div class="exam-auto-empty"><strong>Reading the actual PDF…</strong><br>No inferred BIWT subjects will be shown. Please wait for subject/topic detection to finish.</div>';if(btn){btn.disabled=true;btn.onclick=null}}
  function renderResult(){if(!state)return;const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(state.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(state.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${state.mappings.length}</strong></div>`;if(!state.mappings.length){host.innerHTML='<div class="exam-auto-empty">No reliable subject was detected from the actual PDF. Nothing has been auto-added. Use Review / Correct only if necessary.</div>';btn.disabled=true;return}host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Detected syllabus</th><th>Detection</th></tr></thead><tbody>${state.mappings.map((m,i)=>`<tr><td><input class="exam-v6-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td><strong>${escHtml(m.subject)}</strong></td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length?`<strong>${m.topics.length} item(s)</strong><details><summary style="cursor:pointer;color:#345f91">View syllabus</summary><div style="max-width:280px;white-space:normal;margin-top:5px">${m.topics.map(t=>`• ${escHtml(t)}`).join("<br>")}</div></details>`:'<span style="color:#a65d24">Subject detected; topic text needs review</span>'}</td><td>${escHtml(m.source)}</td></tr>`).join("")}</tbody></table></div>`;btn.disabled=false;btn.onclick=save}
  function syncReview(){if(!state)return;for(const[id,v]of [["#examAutoName",state.examName],["#examAutoDate",state.examDate],["#examAutoDeadline",state.examDate],["#examAutoOrientation","C Batch"],["#examName",state.examName],["#examDate",state.examDate],["#examDeadline",state.examDate]]){const x=q(id);if(x)x.value=v||""}}
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function save(){if(!state?.file)return;const chosen=qa(".exam-v6-use:checked").map(x=>state.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMsg("Keep at least one detected mapping selected.",true);return}const examName=txt(q("#examAutoName")?.value)||state.examName,examDate=q("#examAutoDate")?.value||state.examDate||null,deadline=q("#examAutoDeadline")?.value||examDate||null,mappings=chosen.map(m=>({section_id:sid(m.section),subject_id:subid(m.subject),teacher_id:tid(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id),btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(state.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:examName,exam_date:examDate,completion_deadline:deadline,file_name:state.file.name,file_size:state.file.size,file_base64,mappings});setMsg(`Saved ${r.count||mappings.length} mapping(s) using only the actual subject(s) detected in the PDF.`);q("#examAutoPdf").value="";state=null;q("#examRefreshBtn")?.click()}catch(e){setMsg(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}}

  async function process(file,sig){const id=++runId;state={file,examName:sig.examName,examDate:dateFrom(file.name),grade:sig.grade,mappings:[]};renderScanning(sig,state.examDate);setMsg("Reading the actual PDF. No BIWT core-subject inference is allowed…");try{const n=await readPdf(file);if(id!==runId)return;state.examDate=dateFrom(file.name,n.lines)||state.examDate;let parsed=parse(n.lines,n.rawPages),source="Actual PDF text";let topicCount=[...parsed.topics.values()].reduce((n,a)=>n+a.length,0);if(!parsed.subjects.length||topicCount===0){setMsg("Subject/topic text is not reliable in the PDF text layer. Starting visual scan…");try{const olines=await ocr(n.pdf,id);if(id!==runId)return;const op=parse(olines,[]),oc=[...op.topics.values()].reduce((n,a)=>n+a.length,0);if(op.subjects.length&&(op.subjects.length>parsed.subjects.length||oc>=topicCount)){parsed=op;source="Actual PDF visual scan";topicCount=oc}}catch(ocrError){if(!parsed.subjects.length)throw ocrError;setMsg(`Visual scan was unavailable, but actual PDF text identified ${parsed.subjects.join(", ")}.`,true)}}if(id!==runId)return;state.mappings=build(sig,parsed,source);renderResult();syncReview();if(state.mappings.length){const names=uniq(state.mappings.map(m=>m.subject)),tc=state.mappings.reduce((n,m)=>n+m.topics.length,0);setMsg(`Actual PDF detected: ${names.join(", ")}. ${state.mappings.length} class-subject row(s), ${tc} syllabus item(s). No extra subjects were added.`)}else setMsg("No reliable subject was detected from the actual PDF. Nothing was auto-added.",true)}catch(e){if(id!==runId)return;state.mappings=[];renderResult();setMsg(`Could not read the actual PDF: ${e.message||e}. Nothing was auto-added.`,true)}}

  // Capture phase is intentional: stop older target-level change handlers from producing inferred rows.
  document.addEventListener("change",e=>{const input=e.target;if(!(input instanceof HTMLInputElement)||input.id!=="examAutoPdf")return;const file=input.files?.[0],sig=signals(file?.name||"");if(!file||!sig)return;e.stopImmediatePropagation();e.stopPropagation();process(file,sig)},true);
})();