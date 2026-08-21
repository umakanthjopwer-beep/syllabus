// Strict authoritative parser for C-Batch BIWT exam-syllabus PDFs.
// Only heading-like subject labels may create mappings. Exam pattern/instruction text is never syllabus.
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

  const SUBJECT_PATTERNS=[
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
  const compact=v=>txt(v).toUpperCase().replace(/[^A-Z0-9&]+/g," ").replace(/\s+/g," ").trim();
  const stripLead=v=>compact(v).replace(/^(?:S\.?\s*NO\.?|SL\.?\s*NO\.?|\d{1,2})\s*[-.:)]?\s*/,"").trim();
  function isInstruction(v){
    const s=compact(v);
    return /\b(STRAIGHT\s+OBJECTIVE|OBJECTIVE\s+TYPE|QUESTION(?:S)?|NO\.?\s+OF\s+QUESTIONS|TOTAL\s+QUESTIONS|MARKS?|TOTAL\s+MARKS|EACH\s+QUESTION|CORRECT\s+ANSWER|WRONG\s+ANSWER|NEGATIVE\s+MARK|MULTIPLE\s+CHOICE|SINGLE\s+CORRECT|MULTI\s+CORRECT|INTEGER\s+TYPE|MATRIX\s+MATCH|ASSERTION|PASSAGE|DURATION|TIME\s+ALLOWED|INSTRUCTIONS?|ALL\s+THE\s+BEST|EXAM\s+PATTERN|TEST\s+PATTERN)\b/.test(s)||/\b\d+\s*(?:TO|-)\s*\d+\b.*\b\d+\s*[X×]\s*\d+\b/.test(s)||/\b\d+\s*[X×]\s*\d+\s*=\s*\d+\b/.test(s)
  }
  function isMeta(v){const s=compact(v);return !s||/SRI\s+CHAITANYA|NORTH\s+INDIA|\bCBSE\b|C\s*[- ]?BATCH|BIWEEKLY\s+TEST|\bBIWT\b|EXAM\s+DATE|ACADEMIC\s+YEAR|SYLLABUS\s+FOR|PAGE\s+\d+/.test(s)}
  function isColumnHeader(v){return /^(S\.?\s*NO\.?|SL\.?\s*NO\.?|SUBJECT|SYLLABUS|PORTION|CHAPTERS?|TOPICS?|REMARKS?|DATE|MARKS?)$/i.test(txt(v))}
  function cleanTopic(v){return txt(v).replace(/^[|,:;\-–—\s]+|[|,:;\-–—\s]+$/g,"").replace(/\s+/g," ").trim()}
  function looksLikeTopic(v){const s=cleanTopic(v);if(s.length<3||s.length>350||isMeta(s)||isInstruction(s)||isColumnHeader(s))return false;const c=compact(s);if(/^\d+(?:[.)-]|$)/.test(c)&&c.split(" ").length<=2)return false;return true}

  function headingMatch(line){
    if(isInstruction(line)||isMeta(line))return null;
    const s=stripLead(line);
    for(const[name,aliases]of SUBJECT_PATTERNS){if(!subid(name))continue;for(const alias0 of aliases){const a=compact(alias0);if(s===a||s===`${a} SYLLABUS`||s===`${a} PORTION`||s===`${a} TOPICS`)return{name,tail:"",confidence:"heading"};
        if(s.startsWith(a+" :")||s.startsWith(a+" -")||s.startsWith(a+" –")){const tail=s.slice(a.length).replace(/^\s*[:\-–]\s*/,"").trim();if(!isInstruction(tail))return{name,tail,confidence:"row"}}
      }
    }
    return null
  }

  function parse(lines){
    const subjects=new Set(),topics=new Map(),evidence=new Map();let current=null,seenHeading=false;
    for(const line0 of lines){const line=cleanTopic(line0);if(!line)continue;
      const h=headingMatch(line);if(h){current=h.name;seenHeading=true;subjects.add(h.name);evidence.set(h.name,(evidence.get(h.name)||0)+2);if(h.tail&&looksLikeTopic(h.tail)){if(!topics.has(h.name))topics.set(h.name,[]);topics.get(h.name).push(h.tail)}continue}
      if(isInstruction(line)){current=null;continue}
      if(!looksLikeTopic(line))continue;
      if(current){if(!topics.has(current))topics.set(current,[]);const a=topics.get(current);if(!a.some(x=>x.toLowerCase()===line.toLowerCase()))a.push(line);evidence.set(current,(evidence.get(current)||0)+1)}
    }
    const reliable=[...subjects].filter(s=>(evidence.get(s)||0)>=2);
    const filteredTopics=new Map();for(const s of reliable)filteredTopics.set(s,uniq((topics.get(s)||[]).filter(looksLikeTopic)).slice(0,180));
    return{subjects:reliable,topics:filteredTopics,seenHeading}
  }

  async function pdfLib(){if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfPromise)return pdfPromise;pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfPromise}
  async function readPdf(file){
    const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,lines=[];
    for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),tc=await pg.getTextContent(),groups=new Map();for(const it of tc.items||[]){const v=txt(it.str);if(!v)continue;const y=Math.round(it.transform?.[5]||0),x=Number(it.transform?.[4]||0);if(!groups.has(y))groups.set(y,[]);groups.get(y).push({x,v})}for(const[,items]of[...groups.entries()].sort((a,b)=>b[0]-a[0])){const l=items.sort((a,b)=>a.x-b.x).map(z=>z.v).join(" ").replace(/\s+/g," ").trim();if(l)lines.push(l)}}return{pdf,lines}}
  async function loadTess(){if(globalThis.Tesseract)return globalThis.Tesseract;if(tessPromise)return tessPromise;const urls=["https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js","https://unpkg.com/tesseract.js@5/dist/tesseract.min.js"];tessPromise=(async()=>{let last;for(const url of urls){try{return await new Promise((resolve,reject)=>{const s=document.createElement("script");const timer=setTimeout(()=>reject(new Error("Visual reader load timeout")),20000);s.src=url;s.onload=()=>{clearTimeout(timer);globalThis.Tesseract?resolve(globalThis.Tesseract):reject(new Error("Visual reader unavailable"))};s.onerror=()=>{clearTimeout(timer);reject(new Error("Visual reader failed to load"))};document.head.appendChild(s)})}catch(e){last=e}}throw last||new Error("Visual reader unavailable")})();return tessPromise}
  async function ocr(pdf,id){const T=await loadTess(),out=[];for(let p=1;p<=pdf.numPages;p++){if(id!==runId)throw new Error("Scan replaced by a newer file");setMsg(`Visual scan page ${p}/${pdf.numPages}: preparing…`);const pg=await pdf.getPage(p),vp=pg.getViewport({scale:2}),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;const r=await T.recognize(canvas,"eng",{logger:m=>{if(id===runId&&m?.status==="recognizing text"&&typeof m.progress==="number")setMsg(`Visual scan page ${p}/${pdf.numPages}: ${Math.round(m.progress*100)}%`)}});for(const l of String(r?.data?.text||"").split(/\r?\n/)){const c=cleanTopic(l);if(c)out.push(c)}}return out}

  function build(sig,parsed,source){const targets=appSections().filter(s=>Number(s.grade)===Number(sig.grade)&&s.program==="C Batch").map(s=>s.section),out=[];for(const sec of targets)for(const sub of parsed.subjects){if(!subjectsFor(sec).includes(canon(sub)))continue;out.push({section:sec,subject:canon(sub),teacher:teacherFor(sec,sub),topics:uniq(parsed.topics.get(sub)||[]).slice(0,180),source})}return out}
  function setMsg(msg,bad=false){const x=q("#examAutoMsg");if(x){x.textContent=msg;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}}
  function renderScanning(sig,date){const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(sum)sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(sig.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(date||"Detecting…")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>—</strong></div>`;if(host)host.innerHTML='<div class="exam-auto-empty"><strong>Reading actual syllabus headings…</strong><br>Question-pattern and instruction text will be ignored.</div>';if(btn){btn.disabled=true;btn.onclick=null}}
  function renderResult(){if(!state)return;const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(state.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(state.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${state.mappings.length}</strong></div>`;if(!state.mappings.length){host.innerHTML='<div class="exam-auto-empty">No reliable subject heading was detected. Nothing has been auto-added. Open Review / Correct only if necessary.</div>';btn.disabled=true;return}host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Detected syllabus</th><th>Detection</th></tr></thead><tbody>${state.mappings.map((m,i)=>`<tr><td><input class="exam-v7-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td><strong>${escHtml(m.subject)}</strong></td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length?`<strong>${m.topics.length} topic(s)</strong><details><summary style="cursor:pointer;color:#345f91">View syllabus</summary><div style="max-width:300px;white-space:normal;margin-top:5px">${m.topics.map(t=>`• ${escHtml(t)}`).join("<br>")}</div></details>`:'<span style="color:#a65d24">Subject heading detected; syllabus topics need review</span>'}</td><td>${escHtml(m.source)}</td></tr>`).join("")}</tbody></table></div>`;btn.disabled=false;btn.onclick=save}
  function syncReview(){if(!state)return;for(const[id,v]of [["#examAutoName",state.examName],["#examAutoDate",state.examDate],["#examAutoDeadline",state.examDate],["#examAutoOrientation","C Batch"],["#examName",state.examName],["#examDate",state.examDate],["#examDeadline",state.examDate]]){const x=q(id);if(x)x.value=v||""}}
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function save(){if(!state?.file)return;const chosen=qa(".exam-v7-use:checked").map(x=>state.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMsg("Keep at least one detected mapping selected.",true);return}const mappings=chosen.map(m=>({section_id:sid(m.section),subject_id:subid(m.subject),teacher_id:tid(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id),btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(state.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:state.examName,exam_date:state.examDate||null,completion_deadline:state.examDate||null,file_name:state.file.name,file_size:state.file.size,file_base64,mappings});setMsg(`Saved ${r.count||mappings.length} mapping(s) using strict subject-heading detection.`);q("#examAutoPdf").value="";q("#examRefreshBtn")?.click()}catch(e){setMsg(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}}

  async function process(file,sig,id){renderScanning(sig,"");try{const normal=await readPdf(file);if(id!==runId)return;const examDate=dateFrom(file.name,normal.lines);let parsed=parse(normal.lines),source="PDF heading detection";if(!parsed.subjects.length||[...parsed.topics.values()].reduce((n,a)=>n+a.length,0)===0){setMsg("Normal PDF text was not reliable. Running strict visual scan…");const visual=await ocr(normal.pdf,id);if(id!==runId)return;const p2=parse(visual);if(p2.subjects.length){parsed=p2;source="Visual OCR · strict heading detection"}}state={file,examName:sig.examName,examDate,grade:sig.grade,mappings:build(sig,parsed,source),subjects:parsed.subjects};renderResult();syncReview();if(state.mappings.length){const names=uniq(state.mappings.map(m=>m.subject)),tc=state.mappings.reduce((n,m)=>n+m.topics.length,0);setMsg(`Strict PDF detection: ${names.join(", ")}. ${state.mappings.length} class-subject row(s), ${tc} syllabus topic(s). Exam-pattern text was excluded.`)}else setMsg("No reliable subject heading was found in the PDF. Nothing was auto-added.",true)}catch(e){if(id!==runId)return;state={file,examName:sig.examName,examDate:"",grade:sig.grade,mappings:[],subjects:[]};renderResult();setMsg(`Could not reliably read this PDF: ${e.message||e}. Nothing was auto-added.`,true)}}

  function onChange(e){const input=e.target;if(!input||input.id!=="examAutoPdf")return;const file=input.files?.[0],sig=signals(file?.name||"");if(!file||!sig)return;e.stopImmediatePropagation();const id=++runId;state=null;process(file,sig,id)}
  document.addEventListener("change",onChange,true);
})();
