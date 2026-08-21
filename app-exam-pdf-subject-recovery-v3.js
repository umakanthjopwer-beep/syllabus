// Stage-3 recovery for C-Batch BIWT PDFs whose subject headings are fragmented by PDF text extraction.
// Uses compact glyph text first. If a clear C-Batch BIWT + C-level is known but no subject token survives,
// it proposes only the standard C-Batch core subjects that exist in the live Handling Classes master.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  const CORE=["Track A","Track B","Physics","Chemistry","Biology"];
  let bound=null,pdfLoading=null,state=null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").trim();
  const escHtml=v=>typeof esc==="function"?esc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v):txt(v);
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];

  function sections(){return Array.isArray(globalThis.SECTIONS)?SECTIONS:[]}
  function activeMappings(){return globalThis.data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}
  function subjectsFor(section){return uniq(activeMappings().filter(m=>m.section===section).map(m=>canon(m.subject)))}
  function teacherFor(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return activeMappings().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function sectionId(section){return globalThis.REMOTE?.sectionIdByName?.get(section)||null}
  function subjectId(subject){return globalThis.REMOTE?.subjectIdByName?.get(canon(subject))||null}
  function teacherId(section,subject){const n=teacherFor(section,subject);return globalThis.REMOTE?.teacherIdByName?.get(n)||null}
  function sectionLabel(section){const s=sections().find(x=>x.section===section);return s?[s.section,s.batch,s.program].filter(Boolean).join(" · "):section}

  function fileSignals(name){
    const s=txt(name).replace(/\.[^.]+$/," ");
    const level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i),test=s.match(/\b(?:BIWEEKLY\s+TEST|BIWT)\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    if(!level||!test||!/\bC\s*[- ]?BATCH\b|\bBIWEEKLY\s+TEST\b|\bBIWT\b/i.test(s))return null;
    return{grade:11-Number(level[1]),level:`C${Number(level[1])}`,examName:`C Batch BIWT ${Number(test[1])}`}
  }
  function detectDate(name,lines){
    for(const line of [name,...lines]){const m=txt(line).match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);if(!m)continue;let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);if(y>=2020&&y<=2035&&mo>=1&&mo<=12&&d>=1&&d<=31)return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}
    return""
  }

  const COMPACT_RULES=[
    ["Track A",[/TRACKA/,/MATA(?![A-Z])/,/MATHA(?![A-Z])/,/MATHSA(?![A-Z])/,/MATHEMATICSA(?![A-Z])/]],
    ["Track B",[/TRACKB/,/MATB(?![A-Z])/,/MATHB(?![A-Z])/,/MATHSB(?![A-Z])/,/MATHEMATICSB(?![A-Z])/]],
    ["Physics",[/PHYSICS/,/PHYS(?![A-Z])/,/PHY(?![A-Z])/]],
    ["Chemistry",[/CHEMISTRY/,/CHEM(?![A-Z])/]],
    ["Biology",[/BIOLOGY/,/BIO(?![A-Z])/]],
    ["Reasoning",[/ARITHMETICANDREASONING/,/ARITHMETICREASONING/,/REASONING/,/A&R/]],
    ["English",[/ENGLISH/,/ENG(?![A-Z])/]],
    ["Social",[/SOCIALSTUDIES/,/SOCIALSCIENCE/,/SOCIAL/,/SOC(?![A-Z])/]]
  ];
  function compact(v){return txt(v).toUpperCase().replace(/[^A-Z0-9&]+/g,"")}
  function subjectHits(v){const c=compact(v),out=[];for(const[name,rs]of COMPACT_RULES){if(!subjectId(name))continue;if(rs.some(re=>re.test(c)))out.push(name)}return uniq(out)}
  function isMeta(line){return /sri\s+chaitanya|north\s+india|cbse|c\s*[- ]?batch|biweekly\s+test|biwt|syllabus|exam\s*date|total\s*marks|duration|page\s*\d+/i.test(line)}
  function cleanTopic(line){return txt(line).replace(/\s+/g," ").replace(/^[|,:;\-–—\s]+|[|,:;\-–—\s]+$/g,"")}

  async function pdfLib(){
    if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfLoading)return pdfLoading;
    pdfLoading=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfLoading
  }
  async function extract(file){
    const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,lines=[];
    for(let p=1;p<=pdf.numPages;p++){
      const pg=await pdf.getPage(p),tc=await pg.getTextContent(),groups=new Map();
      for(const it of tc.items||[]){const y=Math.round(it.transform?.[5]||0),x=Number(it.transform?.[4]||0),v=txt(it.str);if(!v)continue;if(!groups.has(y))groups.set(y,[]);groups.get(y).push({x,v})}
      for(const[,items]of[...groups.entries()].sort((a,b)=>b[0]-a[0])){
        items.sort((a,b)=>a.x-b.x);const spaced=items.map(z=>z.v).join(" ").replace(/\s+/g," ").trim(),tight=items.map(z=>z.v).join("").replace(/\s+/g,"").trim();
        if(spaced)lines.push({spaced,tight})
      }
    }
    return lines
  }

  function build(lines,grade){
    const detected=new Set(),topics=new Map();let current=[];
    for(const row of lines){
      const hits=uniq([...subjectHits(row.spaced),...subjectHits(row.tight)]);if(hits.length){current=hits;hits.forEach(s=>detected.add(s))}
      const clean=cleanTopic(row.spaced);if(!clean||clean.length<3||clean.length>450||isMeta(clean)||hits.length)continue;
      if(current.length===1){const sub=current[0];if(!topics.has(sub))topics.set(sub,[]);const a=topics.get(sub);if(!a.some(x=>x.toLowerCase()===clean.toLowerCase()))a.push(clean)}
    }
    const targets=sections().filter(s=>Number(s.grade)===Number(grade)&&s.program==="C Batch").map(s=>s.section);
    let source="PDF compact text",subjects=[...detected];
    if(!subjects.length){source="BIWT core inference — review";subjects=CORE.filter(sub=>subjectId(sub)&&targets.some(sec=>subjectsFor(sec).includes(canon(sub))))}
    const mappings=[];
    for(const sec of targets)for(const sub of subjects){if(!subjectsFor(sec).includes(canon(sub)))continue;mappings.push({section:sec,subject:canon(sub),teacher:teacherFor(sec,sub),topics:uniq(topics.get(sub)||[]).slice(0,150),source})}
    return{mappings,source,subjects}
  }

  function setMessage(msg,bad=false){const x=q("#examAutoMsg");if(!x)return;x.textContent=msg;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}
  function render(){
    if(!state)return;const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;
    sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(state.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(state.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${state.mappings.length}</strong></div>`;
    host.innerHTML=state.mappings.length?`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Topics</th><th>Detection</th></tr></thead><tbody>${state.mappings.map((m,i)=>`<tr><td><input class="exam-recovery-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td>${escHtml(m.subject)}</td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length}</td><td>${escHtml(m.source)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="exam-auto-empty">No C-Batch subject mapping could be recovered.</div>';
    btn.disabled=!state.mappings.length
  }
  function syncReview(){if(!state)return;const vals=[["#examAutoName",state.examName],["#examAutoDate",state.examDate],["#examAutoDeadline",state.examDate],["#examAutoOrientation","C Batch"],["#examName",state.examName],["#examDate",state.examDate],["#examDeadline",state.examDate]];for(const[id,v]of vals){const x=q(id);if(x)x.value=v||""}}
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function save(){
    if(!state?.file)return;const chosen=qa(".exam-recovery-use:checked").map(x=>state.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMessage("Keep at least one mapping selected.",true);return}
    const examName=txt(q("#examAutoName")?.value)||state.examName,examDate=q("#examAutoDate")?.value||state.examDate||null,deadline=q("#examAutoDeadline")?.value||examDate||null;
    const mappings=chosen.map(m=>({section_id:sectionId(m.section),subject_id:subjectId(m.subject),teacher_id:teacherId(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id),btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";
    try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(state.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:examName,exam_date:examDate,completion_deadline:deadline,file_name:state.file.name,file_size:state.file.size,file_base64,mappings});setMessage(`Saved ${r.count||mappings.length} mappings for ${examName}. Handling teachers came from the live class-subject mapping.`);q("#examAutoPdf").value="";state=null;q("#examRefreshBtn")?.click()}catch(e){setMessage(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}
  }

  async function process(file){
    const sig=fileSignals(file?.name||"");if(!sig)return;
    try{const rows=await extract(file),built=build(rows,sig.grade),examDate=detectDate(file.name,rows.map(x=>x.spaced));state={file,examName:sig.examName,examDate,grade:sig.grade,mappings:built.mappings,source:built.source};
      // Let earlier detectors finish, then replace only their zero/weak result with this stronger recovery.
      await new Promise(r=>setTimeout(r,900));render();syncReview();const btn=q("#examAutoSave");if(btn)btn.onclick=save;
      if(built.source.startsWith("PDF"))setMessage(`Recovered fragmented subject headings from the PDF and mapped ${built.mappings.length} class-subject-teacher combination(s).`);
      else setMessage(`The PDF did not expose readable subject headings. ${sig.level} was mapped using the C-Batch BIWT core subjects available in Handling Classes. Review the preview before saving.`)
    }catch(e){setMessage(`Subject recovery could not read this PDF: ${e.message||e}`,true)}
  }
  function bind(){const input=q("#examAutoPdf");if(!input||input===bound)return;bound=input;input.addEventListener("change",()=>{const f=input.files?.[0];if(f)process(f)});}
  function watch(){bind();new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});setInterval(bind,1000)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});else watch()
})();