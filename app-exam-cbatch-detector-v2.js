// Targeted hardening for C-Batch BIWT PDFs such as "C1 BIWEEKLY TEST - 3".
// Runs after the generic exam auto-mapper and takes over only when a clear C-Batch/C-level file is detected.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  let bound=null,pdfPromise=null;
  let SMART={active:false,file:null,examName:"",examDate:"",deadline:"",orientation:"C Batch",grade:null,mappings:[]};
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").trim();
  const escHtml=v=>typeof esc==="function"?esc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v):txt(v);
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];

  function appSections(){return Array.isArray(globalThis.SECTIONS)?SECTIONS:[]}
  function activeMappings(){return globalThis.data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}
  function subjectsFor(section){return uniq(activeMappings().filter(m=>m.section===section).map(m=>canon(m.subject)))}
  function teacherFor(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return activeMappings().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function sectionId(section){return globalThis.REMOTE?.sectionIdByName?.get(section)||null}
  function subjectId(subject){return globalThis.REMOTE?.subjectIdByName?.get(canon(subject))||null}
  function teacherId(section,subject){const n=teacherFor(section,subject);return globalThis.REMOTE?.teacherIdByName?.get(n)||null}
  function sectionLabel(section){const s=appSections().find(x=>x.section===section);return s?[s.section,s.batch,s.program].filter(Boolean).join(" · "):section}

  function fileSignals(name){
    const s=txt(name).replace(/\.[^.]+$/," ");
    const cb=/\bc\s*[- ]?batch\b/i.test(s)||/\bbiweekly\s+test\b/i.test(s)||/\bbiwt\b/i.test(s);
    const level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i);
    const test=s.match(/\b(?:BIWEEKLY\s+TEST|BIWT)\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    const grade=level?11-Number(level[1]):null;
    const examName=test?`C Batch BIWT ${Number(test[1])}`:"";
    return{isC:cb&&!!level,grade,examName}
  }
  function detectDate(name,lines){
    const all=[txt(name),...(lines||[])];
    for(const line of all){
      let m=line.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);if(!m)continue;
      let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);
      if(y>=2020&&y<=2035&&mo>=1&&mo<=12&&d>=1&&d<=31)return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`
    }
    return""
  }

  const RULES=[
    ["Track A",/(?:\bTRACK\s*[-:]?\s*A\b|\bMAT(?:H|HS|HEMATICS)?\s*[-:]?\s*A\b|\bMATH(?:S|EMATICS)?\s*[-:]?\s*A\b)/i],
    ["Track B",/(?:\bTRACK\s*[-:]?\s*B\b|\bMAT(?:H|HS|HEMATICS)?\s*[-:]?\s*B\b|\bMATH(?:S|EMATICS)?\s*[-:]?\s*B\b)/i],
    ["Reasoning",/(?:\bA\s*&\s*R\b|\bARITH(?:METIC)?\s*(?:&|AND)\s*REASONING\b|\bREASONING\b)/i],
    ["Physics",/\b(?:PHY|PHYS|PHYSICS)\b/i],
    ["Chemistry",/\b(?:CHEM|CHEMISTRY)\b/i],
    ["Biology",/\b(?:BIO|BIOLOGY)\b/i],
    ["English",/\b(?:ENG|ENGLISH)\b/i],
    ["Social",/\b(?:SOC|SOCIAL(?:\s+STUDIES|\s+SCIENCE)?)\b/i],
    ["SL Telugu",/\b(?:SL|SECOND\s+LANGUAGE)\s*[-:]?\s*TELUGU\b/i],
    ["TL Telugu",/\b(?:TL|THIRD\s+LANGUAGE)\s*[-:]?\s*TELUGU\b/i],
    ["SL Hindi",/\b(?:SL|SECOND\s+LANGUAGE)\s*[-:]?\s*HINDI\b/i],
    ["TL Hindi",/\b(?:TL|THIRD\s+LANGUAGE)\s*[-:]?\s*HINDI\b/i],
    ["IT",/\b(?:IT|INFORMATION\s+TECHNOLOGY|COMPUTER(?:\s+SCIENCE)?)\b/i]
  ];
  function detectedSubjects(line){return RULES.filter(([,re])=>re.test(line)).map(([name])=>name).filter(x=>!!subjectId(x))}
  function stripSubject(line){let x=txt(line);for(const[,re]of RULES)x=x.replace(re," ");return x.replace(/\b(?:SYLLABUS|PORTION|TOPICS?|CHAPTERS?|C\s*[- ]?BATCH|BIWEEKLY\s+TEST\s*[-:]?\s*\d+|BIWT\s*[-:]?\s*\d+|C[1-5][AB]?)\b/ig," ").replace(/^[\s|,:;\-–—]+|[\s|,:;\-–—]+$/g,"").replace(/\s+/g," ").trim()}
  function usableTopic(x){return x.length>=3&&x.length<=400&&!/^(date|exam date|time|marks|total marks|page\s*\d+)$/i.test(x)&&!/sri\s+chaitanya|north\s+india|cbse/i.test(x)}

  async function pdfLib(){
    if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfPromise)return pdfPromise;
    pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfPromise
  }
  async function pdfLines(file){
    const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
    for(let p=1;p<=pdf.numPages;p++){
      const pg=await pdf.getPage(p),tc=await pg.getTextContent(),groups=new Map();
      for(const it of tc.items||[]){const y=Math.round(it.transform?.[5]||0),v=txt(it.str);if(!v)continue;if(!groups.has(y))groups.set(y,[]);groups.get(y).push({x:Number(it.transform?.[4]||0),v})}
      for(const[,items]of[...groups.entries()].sort((a,b)=>b[0]-a[0])){const line=items.sort((a,b)=>a.x-b.x).map(z=>z.v).join(" ").replace(/\s+/g," ").trim();if(line)out.push(line)}
    }
    return out
  }
  function buildMappings(lines,grade){
    const topicMap=new Map(),seenSubjects=new Set();let current=[];
    for(const raw of lines){
      const found=detectedSubjects(raw);if(found.length){current=found;found.forEach(s=>seenSubjects.add(s))}
      const clean=stripSubject(raw);if(!usableTopic(clean))continue;
      if(current.length)for(const sub of current){if(!topicMap.has(sub))topicMap.set(sub,[]);const a=topicMap.get(sub);if(!a.some(x=>x.toLowerCase()===clean.toLowerCase()))a.push(clean)}
    }
    // If the PDF says only "Maths" without A/B, C-Batch uses both Track A and Track B.
    const full=lines.join("\n");if(/\bMATH(?:S|EMATICS)?\b/i.test(full)&&![...seenSubjects].some(x=>x==="Track A"||x==="Track B")){if(subjectId("Track A"))seenSubjects.add("Track A");if(subjectId("Track B"))seenSubjects.add("Track B")}
    const sections=appSections().filter(s=>Number(s.grade)===Number(grade)&&s.program==="C Batch").map(s=>s.section),out=[];
    for(const section of sections)for(const subject of seenSubjects){if(!subjectsFor(section).includes(canon(subject)))continue;out.push({section,subject:canon(subject),teacher:teacherFor(section,subject),topics:uniq(topicMap.get(subject)||[]).slice(0,150)})}
    return out
  }

  function setMessage(message,bad=false){const x=q("#examAutoMsg");if(!x)return;x.textContent=message;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}
  function render(){
    const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;
    sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(SMART.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(SMART.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${SMART.mappings.length}</strong></div>`;
    if(!SMART.mappings.length){host.innerHTML=`<div class="exam-auto-empty">C${11-SMART.grade} was identified as Class ${SMART.grade} C Batch, but no subject heading was readable from this PDF.</div>`;btn.disabled=true;return}
    host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Topics</th><th>Detection</th></tr></thead><tbody>${SMART.mappings.map((m,i)=>`<tr><td><input class="exam-smart-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td>${escHtml(m.subject)}</td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length}</td><td>Auto · C${11-SMART.grade}</td></tr>`).join("")}</tbody></table></div>`;btn.disabled=false
  }
  function syncReview(){
    const name=q("#examAutoName"),date=q("#examAutoDate"),deadline=q("#examAutoDeadline"),ori=q("#examAutoOrientation");if(name)name.value=SMART.examName;if(date)date.value=SMART.examDate;if(deadline)deadline.value=SMART.deadline;if(ori)ori.value="C Batch";
    const mn=q("#examName"),md=q("#examDate"),mdl=q("#examDeadline");if(mn)mn.value=SMART.examName;if(md)md.value=SMART.examDate;if(mdl)mdl.value=SMART.deadline
  }
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function smartSave(){
    if(!SMART.active||!SMART.file)return;
    const chosen=qa(".exam-smart-use:checked").map(x=>SMART.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMessage("Keep at least one mapping selected.",true);return}
    const name=txt(q("#examAutoName")?.value)||SMART.examName,date=q("#examAutoDate")?.value||SMART.examDate||null,deadline=q("#examAutoDeadline")?.value||date||null;
    const mappings=chosen.map(m=>({section_id:sectionId(m.section),subject_id:subjectId(m.subject),teacher_id:teacherId(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id);
    const btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";
    try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(SMART.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:name,exam_date:date,completion_deadline:deadline,file_name:SMART.file.name,file_size:SMART.file.size,file_base64,mappings});setMessage(`Saved ${r.count||mappings.length} mappings for ${name}. C-level, subjects and handling teachers were auto-mapped.`);q("#examAutoPdf").value="";SMART={active:false,file:null,examName:"",examDate:"",deadline:"",orientation:"C Batch",grade:null,mappings:[]};q("#examRefreshBtn")?.click()}catch(e){setMessage(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}
  }

  async function process(file){
    const sig=fileSignals(file?.name||"");if(!file||!sig.isC||!sig.grade)return;
    try{
      const lines=await pdfLines(file),examDate=detectDate(file.name,lines),mappings=buildMappings(lines,sig.grade);
      SMART={active:true,file,examName:sig.examName||`C Batch BIWT`,examDate,deadline:examDate,orientation:"C Batch",grade:sig.grade,mappings};
      // Let the generic parser finish first, then replace its weak C-level result with this stronger mapping.
      for(let i=0;i<30;i++){if(!/Reading PDF/i.test(q("#examAutoMsg")?.textContent||""))break;await new Promise(r=>setTimeout(r,150))}
      render();syncReview();
      const btn=q("#examAutoSave");if(btn)btn.onclick=smartSave;
      if(mappings.length)setMessage(`Identified ${sig.examName} · C${11-sig.grade} = Class ${sig.grade} C Batch · mapped ${mappings.length} class-subject-teacher combination(s).`);
      else setMessage(`Identified ${sig.examName} and C${11-sig.grade} = Class ${sig.grade} C Batch, but subject headings were not readable.`,true)
    }catch(e){setMessage(`C-Batch detector could not read this PDF: ${e.message||e}`,true)}
  }
  function bind(){const input=q("#examAutoPdf");if(!input||input===bound)return;bound=input;input.addEventListener("change",()=>{const f=input.files?.[0];if(f)setTimeout(()=>process(f),0)});const remap=q("#examAutoRemapBtn");remap?.addEventListener("click",()=>{if(SMART.active)setTimeout(()=>{render();syncReview();const b=q("#examAutoSave");if(b)b.onclick=smartSave},250)})}
  new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});bind();setTimeout(bind,300);setTimeout(bind,1000)
})();