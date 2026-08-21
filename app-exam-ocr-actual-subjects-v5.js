// Visual/OCR recovery for exam syllabus PDFs.
// Hard rule: never invent BIWT core subjects. Detect only subjects actually present in the PDF.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  let boundInput=null,tesseractLoading=null,pdfLoading=null;
  let state={running:false,file:null,examName:"",examDate:"",grade:null,level:"",mappings:[],subjects:[],topicsBySubject:new Map(),source:""};
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").trim();
  const escHtml=v=>typeof esc==="function"?esc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v):txt(v);
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];

  function appSections(){try{return Array.isArray(SECTIONS)?SECTIONS:[]}catch(_){return[]}}
  function mappingsMaster(){try{return data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}catch(_){return[]}}
  function subjectsFor(section){return uniq(mappingsMaster().filter(m=>m.section===section).map(m=>canon(m.subject)))}
  function teacherFor(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return mappingsMaster().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function sectionId(section){try{return REMOTE?.sectionIdByName?.get(section)||null}catch(_){return null}}
  function subjectId(subject){try{return REMOTE?.subjectIdByName?.get(canon(subject))||null}catch(_){return null}}
  function teacherId(section,subject){const name=teacherFor(section,subject);try{return REMOTE?.teacherIdByName?.get(name)||null}catch(_){return null}}
  function sectionLabel(section){const s=appSections().find(x=>x.section===section);return s?[s.section,s.batch,s.program].filter(Boolean).join(" · "):section}

  function fileSignals(name){
    const s=txt(name).replace(/\.[^.]+$/," ");
    const level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i),test=s.match(/\b(?:BIWEEKLY\s+TEST|BIWT)\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    const isC=/\bC\s*[- ]?BATCH\b|\bBIWEEKLY\s+TEST\b|\bBIWT\b/i.test(s);
    if(!isC||!level||!test)return null;
    const n=Number(level[1]);return{grade:11-n,level:`C${n}`,examName:`C Batch BIWT ${Number(test[1])}`}
  }
  function detectDate(name,lines=[]){
    for(const line of [name,...lines]){const m=txt(line).match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);if(!m)continue;let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);if(y>=2020&&y<=2035&&mo>=1&&mo<=12&&d>=1&&d<=31)return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}
    return""
  }

  const SUBJECTS=[
    ["Track A",[/\bTRACK\s*A\b/i,/\bMAT(?:H|HS|HEMATICS)?\s*[-:]?\s*A\b/i,/\bMATH(?:S|EMATICS)?\s*[-:]?\s*A\b/i]],
    ["Track B",[/\bTRACK\s*B\b/i,/\bMAT(?:H|HS|HEMATICS)?\s*[-:]?\s*B\b/i,/\bMATH(?:S|EMATICS)?\s*[-:]?\s*B\b/i]],
    ["Physics",[/\bPHYSICS\b/i,/\bPHYS\b/i,/\bPHY\b/i]],
    ["Chemistry",[/\bCHEMISTRY\b/i,/\bCHEM\b/i]],
    ["Biology",[/\bBIOLOGY\b/i,/\bBIO\b/i]],
    ["Reasoning",[/\bREASONING\b/i,/\bA\s*&\s*R\b/i,/\bARITH(?:METIC)?\s*(?:&|AND)\s*REASONING\b/i]],
    ["English",[/\bENGLISH\b/i,/\bENG\b/i]],
    ["Social",[/\bSOCIAL(?:\s+STUDIES|\s+SCIENCE)?\b/i,/\bSOC\b/i]],
    ["SL Telugu",[/\b(?:SL|SECOND\s+LANGUAGE)\s*[-:]?\s*TELUGU\b/i]],
    ["TL Telugu",[/\b(?:TL|THIRD\s+LANGUAGE)\s*[-:]?\s*TELUGU\b/i]],
    ["SL Hindi",[/\b(?:SL|SECOND\s+LANGUAGE)\s*[-:]?\s*HINDI\b/i]],
    ["TL Hindi",[/\b(?:TL|THIRD\s+LANGUAGE)\s*[-:]?\s*HINDI\b/i]],
    ["IT",[/\bINFORMATION\s+TECHNOLOGY\b/i,/\bCOMPUTER(?:\s+SCIENCE)?\b/i,/\bIT\b/i]]
  ];
  function subjectHits(line){const out=[];for(const[name,rules]of SUBJECTS){if(!subjectId(name))continue;if(rules.some(re=>re.test(line)))out.push(name)}return uniq(out)}
  function compactLine(line){return txt(line).replace(/([A-Za-z])\s+(?=[A-Za-z](?:\s|$))/g,"$1").replace(/\s+/g," ").trim()}
  function isMeta(line){return !line||/sri\s+chaitanya|north\s+india|cbse|c\s*[- ]?batch|biweekly\s+test|\bbiwt\b|exam\s*date|date\s*[:.-]|total\s*marks|duration|instructions?|page\s*\d+|academic\s+year|syllabus\s*for/i.test(line)}
  function isTableNoise(line){return /^(s\.?\s*no\.?|sl\.?\s*no\.?|subject|syllabus|portion|chapters?|topics?|remarks?|date|marks?)$/i.test(txt(line))}
  function cleanTopic(line){return txt(line).replace(/^[|,:;\-–—\s]+|[|,:;\-–—\s]+$/g,"").replace(/\s+/g," ").trim()}

  function parseSubjectTopics(lines){
    const topics=new Map(),subjects=new Set(),general=[];let current=[];
    for(const raw0 of lines){
      const raw=compactLine(raw0),hits=subjectHits(raw);
      if(hits.length){current=hits;hits.forEach(s=>subjects.add(s));continue}
      const c=cleanTopic(raw);if(!c||c.length<3||c.length>500||isMeta(c)||isTableNoise(c))continue;
      if(current.length===1){const sub=current[0];if(!topics.has(sub))topics.set(sub,[]);const a=topics.get(sub);if(!a.some(x=>x.toLowerCase()===c.toLowerCase()))a.push(c)}else general.push(c)
    }
    // If exactly one actual subject was found, attach otherwise-unassigned syllabus lines to that subject.
    if(subjects.size===1){const sub=[...subjects][0];if(!topics.has(sub))topics.set(sub,[]);const a=topics.get(sub);for(const c of general){if(!a.some(x=>x.toLowerCase()===c.toLowerCase()))a.push(c)}}
    return{subjects:[...subjects],topics}
  }

  async function loadPdf(){
    if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfLoading)return pdfLoading;
    pdfLoading=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfLoading
  }
  async function loadTesseract(){
    if(globalThis.Tesseract)return globalThis.Tesseract;if(tesseractLoading)return tesseractLoading;
    tesseractLoading=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";s.onload=()=>resolve(globalThis.Tesseract);s.onerror=()=>reject(new Error("Visual text reader could not load"));document.head.appendChild(s)});return tesseractLoading
  }
  async function normalPdfLines(file){
    const lib=await loadPdf(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,lines=[];
    for(let p=1;p<=pdf.numPages;p++){
      const pg=await pdf.getPage(p),tc=await pg.getTextContent(),groups=new Map();
      for(const it of tc.items||[]){const y=Math.round(it.transform?.[5]||0),x=Number(it.transform?.[4]||0),v=txt(it.str);if(!v)continue;if(!groups.has(y))groups.set(y,[]);groups.get(y).push({x,v})}
      for(const[,items]of[...groups.entries()].sort((a,b)=>b[0]-a[0])){const line=items.sort((a,b)=>a.x-b.x).map(z=>z.v).join(" ").replace(/\s+/g," ").trim();if(line)lines.push(line)}
    }
    return{pdf,lines}
  }
  async function ocrPages(pdf){
    const T=await loadTesseract(),lines=[];
    for(let p=1;p<=pdf.numPages;p++){
      setMessage(`Normal PDF text was incomplete. Visually scanning page ${p} of ${pdf.numPages} for the actual subject and syllabus…`);
      const pg=await pdf.getPage(p),vp=pg.getViewport({scale:1.65}),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
      canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;
      const out=await T.recognize(canvas,"eng",{logger:m=>{if(m?.status==="recognizing text"&&typeof m.progress==="number")setMessage(`Visual scan page ${p}/${pdf.numPages}: ${Math.round(m.progress*100)}%`)}});
      for(const l of String(out?.data?.text||"").split(/\r?\n/)){const c=txt(l);if(c)lines.push(c)}
    }
    return lines
  }

  function buildMappings(grade,subjects,topics){
    const targets=appSections().filter(s=>Number(s.grade)===Number(grade)&&s.program==="C Batch").map(s=>s.section),out=[];
    for(const sec of targets)for(const sub of subjects){if(!subjectsFor(sec).includes(canon(sub)))continue;out.push({section:sec,subject:canon(sub),teacher:teacherFor(sec,sub),topics:uniq(topics.get(sub)||[]).slice(0,180),source:"Actual PDF · visual/text detection"})}
    return out
  }
  function setMessage(msg,bad=false){const x=q("#examAutoMsg");if(!x)return;x.textContent=msg;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}
  function render(){
    const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;
    sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(state.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(state.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${state.mappings.length}</strong></div>`;
    if(!state.mappings.length){host.innerHTML='<div class="exam-auto-empty">No actual subject could be detected from this PDF. Nothing has been auto-added. Open Review / Correct only if needed.</div>';btn.disabled=true;return}
    host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Detected syllabus</th><th>Detection</th></tr></thead><tbody>${state.mappings.map((m,i)=>`<tr><td><input class="exam-ocr-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td><strong>${escHtml(m.subject)}</strong></td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length?`<strong>${m.topics.length} item(s)</strong><details><summary style="cursor:pointer;color:#345f91">View syllabus</summary><div style="max-width:260px;white-space:normal;margin-top:4px">${m.topics.map(t=>`• ${escHtml(t)}`).join("<br>")}</div></details>`:'<span style="color:#a65d24">Heading detected; syllabus text needs review</span>'}</td><td>${escHtml(m.source)}</td></tr>`).join("")}</tbody></table></div>`;btn.disabled=false
  }
  function syncReview(){const vals=[["#examAutoName",state.examName],["#examAutoDate",state.examDate],["#examAutoDeadline",state.examDate],["#examAutoOrientation","C Batch"],["#examName",state.examName],["#examDate",state.examDate],["#examDeadline",state.examDate]];for(const[id,v]of vals){const x=q(id);if(x)x.value=v||""}}
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function saveActual(){
    if(state.running||!state.file)return;const chosen=qa(".exam-ocr-use:checked").map(x=>state.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMessage("Keep at least one detected mapping selected.",true);return}
    const examName=txt(q("#examAutoName")?.value)||state.examName,examDate=q("#examAutoDate")?.value||state.examDate||null,deadline=q("#examAutoDeadline")?.value||examDate||null;
    const mappings=chosen.map(m=>({section_id:sectionId(m.section),subject_id:subjectId(m.subject),teacher_id:teacherId(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id),btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";
    try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(state.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:examName,exam_date:examDate,completion_deadline:deadline,file_name:state.file.name,file_size:state.file.size,file_base64,mappings});setMessage(`Saved ${r.count||mappings.length} mapping(s) using only the subject(s) actually detected in the PDF.`);q("#examAutoPdf").value="";state={running:false,file:null,examName:"",examDate:"",grade:null,level:"",mappings:[],subjects:[],topicsBySubject:new Map(),source:""};q("#examRefreshBtn")?.click()}catch(e){setMessage(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}
  }

  async function process(file){
    const sig=fileSignals(file?.name||"");if(!sig)return;
    state={running:true,file,examName:sig.examName,examDate:"",grade:sig.grade,level:sig.level,mappings:[],subjects:[],topicsBySubject:new Map(),source:""};
    const saveBtn=q("#examAutoSave");if(saveBtn)saveBtn.disabled=true;setMessage("Checking the actual PDF content. Inferred BIWT subjects will not be used…");
    try{
      const normal=await normalPdfLines(file);state.examDate=detectDate(file.name,normal.lines);let parsed=parseSubjectTopics(normal.lines),source="PDF text";
      const topicCount=[...parsed.topics.values()].reduce((n,a)=>n+a.length,0);
      if(!parsed.subjects.length||topicCount===0){const ocr=await ocrPages(normal.pdf),ocrParsed=parseSubjectTopics(ocr);if(ocrParsed.subjects.length){parsed=ocrParsed;source="Visual OCR"}}
      state.subjects=parsed.subjects;state.topicsBySubject=parsed.topics;state.source=source;state.mappings=buildMappings(sig.grade,parsed.subjects,parsed.topics);state.running=false;
      // Let older recovery layers finish, then replace their inferred rows with the actual-PDF result.
      await new Promise(r=>setTimeout(r,1100));render();syncReview();const btn=q("#examAutoSave");if(btn)btn.onclick=saveActual;
      if(state.mappings.length){const names=uniq(state.mappings.map(m=>m.subject));const tc=state.mappings.reduce((n,m)=>n+m.topics.length,0);setMessage(`Detected from the actual PDF: ${names.join(", ")}. Mapped ${state.mappings.length} class-subject-teacher row(s) with ${tc} syllabus item(s). No extra BIWT subjects were invented.`)}else setMessage("The PDF was scanned visually, but no reliable subject could be identified. Nothing was auto-added.",true)
    }catch(e){state.running=false;state.mappings=[];render();setMessage(`Could not visually read this PDF: ${e.message||e}. No subjects were auto-added.`,true)}
  }
  function guardSave(e){if(state.running){e.preventDefault();e.stopImmediatePropagation();setMessage("Please wait for the PDF visual scan to finish before saving.",true)}}
  function bind(){
    const input=q("#examAutoPdf");if(input&&input!==boundInput){boundInput=input;input.addEventListener("change",()=>{const f=input.files?.[0];if(f)process(f)})}
    const btn=q("#examAutoSave");if(btn&&!btn.dataset.ocrGuard){btn.dataset.ocrGuard="1";btn.addEventListener("click",guardSave,true)}
  }
  function watch(){bind();new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});setInterval(bind,1000)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});else watch()
})();