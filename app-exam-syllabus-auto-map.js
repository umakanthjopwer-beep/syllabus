// Upload-first Exam Syllabus auto detection and mapping.
// Keeps the existing manual form only as a fallback; Year Plan/Weekly Status remain untouched.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  const ADMIN=new Set(["Super Admin","Principal","Admin"]);
  let pdfLibLoading=null;
  let S={file:null,lines:[],analysis:null,mappings:[]};
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").trim();
  const escHtml=v=>typeof esc==="function"?esc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v):txt(v);
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const slug=v=>txt(v).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const escapeRe=v=>String(v).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

  async function api(action,payload={}){
    const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";
    if(!t)throw new Error("Please sign in again.");
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});
    let out={};try{out=await r.json()}catch(_){}
    if(!r.ok)throw new Error(out.error||`Request failed (${r.status})`);return out
  }

  function allSections(){return Array.isArray(globalThis.SECTIONS)?SECTIONS:[]}
  function sectionMetaByName(name){return allSections().find(x=>x.section===name)||null}
  function sectionLabel(name){const x=sectionMetaByName(name);return x?[x.section,x.batch,x.program].filter(Boolean).join(" · "):name}
  function activeMappings(){return data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}
  function subjectsForSection(section){return uniq(activeMappings().filter(m=>m.section===section).map(m=>canon(m.subject))).sort()}
  function teacherFor(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return activeMappings().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function teacherIdFor(section,subject){const name=teacherFor(section,subject);return REMOTE?.teacherIdByName?.get(name)||null}
  function sectionIdFor(section){return REMOTE?.sectionIdByName?.get(section)||null}
  function subjectIdFor(subject){return REMOTE?.subjectIdByName?.get(canon(subject))||null}
  function availableSubject(subject){return!!subjectIdFor(subject)}

  const SUBJECT_RULES=[
    {name:"Physics Practice",re:/\bphysics\s+practice\b/i},
    {name:"Chemistry Practice",re:/\bchemistry\s+practice\b/i},
    {name:"Biology Practice",re:/\bbiology\s+practice\b/i},
    {name:"English Practice",re:/\benglish\s+practice\b/i},
    {name:"Social Practice",re:/\bsocial(?:\s+studies)?\s+practice\b/i},
    {name:"Telugu Practice",re:/\btelugu\s+practice\b/i},
    {name:"Track A",re:/\b(?:math(?:s|ematics)?\s*)?(?:track\s*)?a\b|\bmaths?\s+a\b/i,guard:/track\s*a|math(?:s|ematics)?\s+(?:track\s*)?a|maths?\s+a/i},
    {name:"Track B",re:/\b(?:math(?:s|ematics)?\s*)?(?:track\s*)?b\b|\bmaths?\s+b\b/i,guard:/track\s*b|math(?:s|ematics)?\s+(?:track\s*)?b|maths?\s+b/i},
    {name:"Reasoning",re:/\barithmetic\s*(?:&|and)\s*reasoning\b|\breasoning\b|\ba\s*&\s*r\b/i},
    {name:"Vedic Maths",re:/\bvedic\s+math(?:s|ematics)?\b/i},
    {name:"Physics",re:/\bphysics\b/i},
    {name:"Chemistry",re:/\bchemistry\b/i},
    {name:"Biology",re:/\bbiology\b/i},
    {name:"English",re:/\benglish\b/i},
    {name:"Social",re:/\bsocial(?:\s+studies|\s+science)?\b/i},
    {name:"GK & CA",re:/\b(?:gk\s*(?:&|and)\s*ca|general\s+knowledge\s*(?:&|and)\s*current\s+affairs)\b/i},
    {name:"SL Telugu",re:/\b(?:sl|second\s+language)\s*telugu\b/i},
    {name:"TL Telugu",re:/\b(?:tl|third\s+language)\s*telugu\b/i},
    {name:"SL Hindi",re:/\b(?:sl|second\s+language)\s*hindi\b/i},
    {name:"TL Hindi",re:/\b(?:tl|third\s+language)\s*hindi\b/i},
    {name:"IT",re:/\b(?:information\s+technology|computer(?:\s+science)?|it)\b/i}
  ];

  function detectSubjects(line){
    const found=[];
    for(const r of SUBJECT_RULES){if(r.guard?!r.guard.test(line):!r.re.test(line))continue;if(r.re.test(line)&&availableSubject(r.name))found.push(r.name)}
    const specific=found.filter(x=>x==="Track A"||x==="Track B");
    if(!specific.length&&/\bmath(?:s|ematics)\b/i.test(line)){
      if(availableSubject("Track A"))found.push("Track A");
      if(availableSubject("Track B"))found.push("Track B")
    }
    return uniq(found)
  }

  const ROMAN={vi:6,vii:7,viii:8,ix:9,x:10};
  function gradeFromToken(v){const s=txt(v).toLowerCase();if(ROMAN[s])return ROMAN[s];const n=Number(s.replace(/\D/g,""));return n>=6&&n<=10?n:null}
  function gradesInLine(line){
    const out=[];let m;
    const re=/(?:class|grade)\s*[-:]?\s*(vi{1,3}|ix|x|10|[6-9])\b/ig;while((m=re.exec(line)))out.push(gradeFromToken(m[1]));
    const re2=/\b(6th|7th|8th|9th|10th)\b/ig;while((m=re2.exec(line)))out.push(gradeFromToken(m[1]));
    const t=txt(line).toLowerCase();if(ROMAN[t])out.push(ROMAN[t]);
    const re3=/\b([cl])([1-5])(?:a|b)?\b/ig;while((m=re3.exec(line))){const level=Number(m[2]);const g=11-level;if(g>=6&&g<=10)out.push(g)}
    return uniq(out)
  }
  function sectionHintsInLine(line){
    const low=slug(line),out=[];
    for(const s of allSections()){
      const batch=slug(s.batch);if(batch&&batch.length>=3&&new RegExp(`(?:^|\\s)${escapeRe(batch)}(?:$|\\s)`).test(low))out.push(s.section);
      const sec=slug(s.section);if(sec&&new RegExp(`\\b(?:class|section)\\s*${escapeRe(sec)}\\b`,"i").test(line))out.push(s.section)
    }
    return uniq(out)
  }
  function orientationFromText(text){
    if(/\bbiwt\b|\bc\s*batch\b/i.test(text))return"C Batch";
    if(/\blead\b|\biit\s*ot\b/i.test(text))return"Lead";
    if(/\btechno\b/i.test(text))return"Techno";
    return""
  }
  function detectExamName(text,fileName,orientation){
    let m=text.match(/(?:c\s*batch\s*)?biwt\s*(?:no\.?\s*|[-–:]\s*)?(\d{1,2})\b/i);if(m)return`C Batch BIWT ${Number(m[1])}`;
    m=text.match(/(?:lead(?:\s*batch)?\s*)?(?:iit\s*)?ot\s*(?:no\.?\s*|[-–:]\s*)?(\d{1,2})\b/i);if(m)return`${orientation==="Lead"?"Lead IIT ":""}OT ${Number(m[1])}`.trim();
    m=text.match(/\b(?:fat|formative\s+assessment\s+test)\s*[-–:]?\s*(\d{1,2})\b/i);if(m)return`FAT ${Number(m[1])}`;
    if(/\bpre[-\s]*mid[-\s]*term\b/i.test(text))return"Pre-Mid Term";
    if(/\bmid[-\s]*term\b/i.test(text))return"Mid-Term";
    if(/\bpre[-\s]*final\b/i.test(text))return"Pre-Final";
    m=text.match(/\bterm\s*[-:]?\s*(1|2)\b/i);if(m)return`Term ${m[1]}`;
    const clean=txt(fileName).replace(/\.[^.]+$/," ").replace(/[_-]+/g," ").replace(/\s+/g," ").trim();return clean||"Exam Syllabus"
  }
  function toISODate(d,m,y){const dd=Number(d),mm=Number(m),yy=Number(y);if(yy<2020||yy>2035||mm<1||mm>12||dd<1||dd>31)return"";return`${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`}
  function detectDate(lines){
    const priority=[...lines.filter(x=>/exam\s*date|date\s*of\s*exam|test\s*date/i.test(x)),...lines];
    for(const line of priority){let m=line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);if(m){const iso=toISODate(m[3],m[2],m[1]);if(iso)return iso}m=line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);if(m){const iso=toISODate(m[1],m[2],m[3]);if(iso)return iso}}
    return""
  }
  function stripKnown(line){
    let x=txt(line);
    x=x.replace(/(?:class|grade)\s*[-:]?\s*(vi{1,3}|ix|x|10|[6-9])\b/ig," ").replace(/\b(6th|7th|8th|9th|10th)\b/ig," ").replace(/\b[CL][1-5][AB]?\b/ig," ");
    for(const r of SUBJECT_RULES)x=x.replace(r.re," ");
    x=x.replace(/\b(?:c\s*batch|lead\s*batch|lead|techno|biwt\s*\d*|iit\s*ot\s*\d*|exam\s*syllabus|syllabus|portion|topic(?:s)?|subject)\b/ig," ");
    return x.replace(/^[\s|:;,\-–—]+|[\s|:;,\-–—]+$/g,"").replace(/\s+/g," ").trim()
  }
  function topicCandidate(line,clean){
    if(!clean||clean.length<3||clean.length>450)return false;
    if(/^(page\s*\d+|date|exam date|time|duration|marks|total marks)$/i.test(clean))return false;
    if(/sri\s+chaitanya|cbse|school|branch|academic\s+year|instructions?/i.test(line)&&clean.length<80)return false;
    return true
  }

  async function loadPdfLib(){
    if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfLibLoading)return pdfLibLoading;
    pdfLibLoading=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfLibLoading
  }
  async function pdfLines(file){
    const lib=await loadPdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
    for(let p=1;p<=pdf.numPages;p++){
      const pg=await pdf.getPage(p),tc=await pg.getTextContent(),groups=new Map();
      for(const it of tc.items||[]){const y=Math.round(it.transform?.[5]||0),v=txt(it.str);if(!v)continue;if(!groups.has(y))groups.set(y,[]);groups.get(y).push({x:Number(it.transform?.[4]||0),v})}
      for(const [,items] of [...groups.entries()].sort((a,b)=>b[0]-a[0])){const line=items.sort((a,b)=>a.x-b.x).map(z=>z.v).join(" ").replace(/\s+/g," ").trim();if(line)out.push(line)}
    }
    return out
  }

  function analyse(lines,fileName,orientationOverride=""){
    const full=[fileName,...lines.slice(0,120)].join("\n"),orientation=orientationOverride||orientationFromText(full),examName=detectExamName(full,fileName,orientation),examDate=detectDate(lines);
    const blocks=new Map(),globalGrades=new Set(),globalSubjects=new Set(),genericTopics=[];
    let currentGrades=[],currentSections=[],currentSubjects=[];
    function ensure(g,sub,secs=[],confidence="Detected"){
      if(!g||!sub)return null;const key=`${g}|${sub}`;let b=blocks.get(key);if(!b){b={grade:g,subject:sub,sectionHints:new Set(),topics:[],confidence};blocks.set(key,b)}secs.forEach(s=>b.sectionHints.add(s));return b
    }
    for(const raw of lines){
      const secHints=sectionHintsInLine(raw),grades=gradesInLine(raw),subjects=detectSubjects(raw);
      if(secHints.length){currentSections=secHints;currentGrades=uniq(secHints.map(s=>sectionMetaByName(s)?.grade).filter(Boolean))}
      else if(grades.length){currentGrades=grades;currentSections=[]}
      if(subjects.length)currentSubjects=subjects;
      currentGrades.forEach(g=>globalGrades.add(g));subjects.forEach(s=>globalSubjects.add(s));
      if(currentGrades.length&&currentSubjects.length)for(const g of currentGrades)for(const sub of currentSubjects)ensure(g,sub,currentSections,"Detected");
      const clean=stripKnown(raw);if(!topicCandidate(raw,clean))continue;
      if(currentGrades.length&&currentSubjects.length){for(const g of currentGrades)for(const sub of currentSubjects){const b=ensure(g,sub,currentSections,"Detected");if(b&&!b.topics.some(t=>t.toLowerCase()===clean.toLowerCase()))b.topics.push(clean)}}else genericTopics.push(clean)
    }
    if(!blocks.size&&globalGrades.size&&globalSubjects.size){for(const g of globalGrades)for(const sub of globalSubjects){const b=ensure(g,sub,[],"Review");b.topics=genericTopics.slice(0,120)}}
    if(blocks.size===1&&genericTopics.length){const b=[...blocks.values()][0];for(const t of genericTopics){if(!b.topics.some(x=>x.toLowerCase()===t.toLowerCase()))b.topics.push(t)}}
    const mappings=[];
    for(const b of blocks.values()){
      let targets=b.sectionHints.size?[...b.sectionHints]:allSections().filter(s=>Number(s.grade)===Number(b.grade)&&(!orientation||s.program===orientation)).map(s=>s.section);
      if(!targets.length)targets=allSections().filter(s=>Number(s.grade)===Number(b.grade)).map(s=>s.section);
      for(const section of targets){
        if(!subjectsForSection(section).includes(canon(b.subject)))continue;
        const teacher=teacherFor(section,b.subject);mappings.push({id:`${section}|${canon(b.subject)}`,section,grade:b.grade,orientation:sectionMetaByName(section)?.program||orientation,subject:canon(b.subject),teacher,topics:uniq(b.topics).slice(0,120),confidence:b.confidence})
      }
    }
    const inferredOrientation=orientation||uniq(mappings.map(x=>x.orientation))[0]||"";
    return{examName,examDate,deadline:examDate,orientation:inferredOrientation,mappings:uniq(mappings.map(x=>x.id)).map(id=>mappings.find(x=>x.id===id)),lineCount:lines.length}
  }

  function addCss(){if(q("#examAutoMapStyles"))return;const st=document.createElement("style");st.id="examAutoMapStyles";st.textContent=`
    .exam-auto-upload{border:1px solid #d9e5f4;background:#f8fbff;border-radius:14px;padding:14px;margin:10px 0 14px}.exam-auto-upload input[type=file]{width:100%;padding:12px;border:1px dashed #a9bdd6;border-radius:10px;background:#fff}.exam-auto-msg{font-size:11px;color:#49647f;margin:8px 0}.exam-auto-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.exam-auto-chip{border:1px solid #dce7f3;background:#fff;border-radius:11px;padding:10px}.exam-auto-chip small{display:block;font-size:8px;color:#77889b;font-weight:800;text-transform:uppercase}.exam-auto-chip strong{display:block;margin-top:4px;font-size:12px}.exam-auto-table{width:100%;border-collapse:collapse;min-width:720px}.exam-auto-table th,.exam-auto-table td{padding:8px;border-bottom:1px solid #e8eef5;font-size:9px;text-align:left;vertical-align:top}.exam-auto-table th{background:#f1f6fb;color:#60738a;text-transform:uppercase;font-size:8px}.exam-auto-wrap{overflow:auto;border:1px solid #e1e8f0;border-radius:11px;background:#fff}.exam-auto-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}.exam-auto-review{margin-top:10px;border-top:1px solid #e2eaf3;padding-top:10px}.exam-auto-review summary{cursor:pointer;font-weight:800;color:#345f91;font-size:10px}.exam-auto-review-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:10px}.exam-auto-review-grid label{font-size:9px;font-weight:800;color:#62738a}.exam-auto-review-grid input,.exam-auto-review-grid select{width:100%;margin-top:5px}.exam-auto-add{display:grid;grid-template-columns:1.2fr 1.2fr auto;gap:8px;align-items:end;margin-top:10px}.exam-auto-fallback{margin-top:10px}.exam-auto-fallback summary{cursor:pointer;font-size:9px;color:#73859a}.exam-auto-empty{padding:16px;text-align:center;color:#718298;font-size:10px}.exam-auto-bad{color:#a63e3e}.exam-auto-good{color:#277449}
    @media(max-width:720px){.exam-auto-summary{grid-template-columns:1fr 1fr}.exam-auto-review-grid{grid-template-columns:1fr 1fr}.exam-auto-add{grid-template-columns:1fr}.exam-auto-table{min-width:620px}}
  `;document.head.appendChild(st)}

  function renderSummary(){
    const a=S.analysis,host=q("#examAutoSummary");if(!host)return;if(!a){host.innerHTML="";return}
    host.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(a.examName||"Needs review")}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>${escHtml(a.orientation||"Needs review")}</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(a.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${S.mappings.length}</strong></div>`
  }
  function renderMappings(){
    const host=q("#examAutoMappings");if(!host)return;
    if(!S.mappings.length){host.innerHTML='<div class="exam-auto-empty">No reliable class/subject mapping was found yet. Open Review / Correct to add a missing mapping.</div>';q("#examAutoSave")&&(q("#examAutoSave").disabled=true);return}
    host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Topics</th><th>Detection</th></tr></thead><tbody>${S.mappings.map((m,i)=>`<tr><td><input class="exam-auto-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td>${escHtml(m.subject)}</td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length}</td><td>${escHtml(m.confidence)}</td></tr>`).join("")}</tbody></table></div>`;
    q("#examAutoSave").disabled=false
  }
  function syncReview(){const a=S.analysis;if(!a)return;q("#examAutoName").value=a.examName||"";q("#examAutoDate").value=a.examDate||"";q("#examAutoDeadline").value=a.deadline||a.examDate||"";q("#examAutoOrientation").value=a.orientation||"";syncManualFields()}
  function syncManualFields(){const a=S.analysis;if(!a)return;const n=q("#examName"),d=q("#examDate"),dl=q("#examDeadline");if(n)n.value=q("#examAutoName")?.value||a.examName||"";if(d)d.value=q("#examAutoDate")?.value||a.examDate||"";if(dl)dl.value=q("#examAutoDeadline")?.value||a.deadline||"";if(S.mappings.length===1){const m=S.mappings[0],sec=q("#examSection"),sub=q("#examSubject");if(sec){sec.value=m.section;sec.dispatchEvent(new Event("change"))}if(sub){sub.value=m.subject;sub.dispatchEvent(new Event("change"))}const topics=q("#examTopics");if(topics)topics.value=m.topics.join("\n")}}

  function fillAddSubjects(){const sec=q("#examAutoAddSection")?.value,sel=q("#examAutoAddSubject");if(!sel)return;const list=sec?subjectsForSection(sec):uniq(activeMappings().map(m=>canon(m.subject))).sort();sel.innerHTML=list.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
  function addManualMapping(){const section=q("#examAutoAddSection").value,subject=canon(q("#examAutoAddSubject").value);if(!section||!subject)return;const id=`${section}|${subject}`;if(S.mappings.some(x=>x.id===id))return;S.mappings.push({id,section,grade:sectionMetaByName(section)?.grade||null,orientation:sectionMetaByName(section)?.program||"",subject,teacher:teacherFor(section,subject),topics:[],confidence:"Manual review"});renderMappings();renderSummary()}
  function rerunOrientation(){if(!S.lines.length)return;S.analysis=analyse(S.lines,S.file?.name||"",q("#examAutoOrientation").value||"");S.mappings=S.analysis.mappings;renderSummary();renderMappings();syncReview();setMessage(`Re-mapped ${S.mappings.length} class-subject combination(s) using ${S.analysis.orientation||"all orientations"}.`,false)}
  function setMessage(msg,bad=false){const x=q("#examAutoMsg");if(!x)return;x.textContent=msg||"";x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad&&!!msg)}

  async function analyseSelected(){
    const file=q("#examAutoPdf")?.files?.[0];S={file:file||null,lines:[],analysis:null,mappings:[]};renderSummary();renderMappings();if(!file)return;
    if(file.size>20*1024*1024){setMessage("PDF must be 20 MB or smaller.",true);return}
    if(file.type&&file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){setMessage("Only PDF exam syllabus files are supported here.",true);return}
    setMessage("Reading PDF and identifying exam, classes, subjects and teachers…");
    try{
      const lines=await pdfLines(file);S.lines=lines;S.analysis=analyse(lines,file.name);S.mappings=S.analysis.mappings;
      renderSummary();renderMappings();syncReview();
      if(!lines.length)setMessage("The PDF looks scanned/image-only, so no readable text was found. Use Review / Correct or upload a text-readable PDF.",true);
      else if(!S.mappings.length)setMessage(`PDF read successfully (${lines.length} text lines), but class/subject mapping needs review.`,true);
      else setMessage(`Detected ${S.analysis.examName} and mapped ${S.mappings.length} class-subject-teacher combination(s). Review the preview, then save.`)
    }catch(err){setMessage(`Could not analyse the PDF: ${err.message||err}`,true)}
  }

  async function saveDetected(){
    if(!ADMIN.has(currentUser?.role)){setMessage("Only Admin/Principal/Super Admin can upload the exam syllabus PDF.",true);return}
    if(!S.file||!S.analysis){setMessage("Upload the exam syllabus PDF first.",true);return}
    const selected=qa(".exam-auto-use:checked").map(x=>S.mappings[Number(x.dataset.i)]).filter(Boolean);if(!selected.length){setMessage("Keep at least one detected mapping selected.",true);return}
    const examName=txt(q("#examAutoName")?.value)||S.analysis.examName,examDate=q("#examAutoDate")?.value||null,deadline=q("#examAutoDeadline")?.value||examDate||null;
    const payloadMappings=selected.map(m=>({section_id:sectionIdFor(m.section),subject_id:subjectIdFor(m.subject),teacher_id:teacherIdFor(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id);
    if(!examName||!payloadMappings.length){setMessage("Exam name or mapped class/subject could not be resolved. Open Review / Correct.",true);return}
    const btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";
    try{
      const file_base64=typeof fileToBase64==="function"?await fileToBase64(S.file):null;if(!file_base64)throw new Error("Could not read the PDF for upload");
      const r=await api("document_batch_save",{exam_name:examName,exam_date:examDate,completion_deadline:deadline,file_name:S.file.name,file_size:S.file.size,file_base64,mappings:payloadMappings});
      setMessage(`Saved ${r.count||payloadMappings.length} exam syllabus mapping(s) from one PDF upload. Teachers were mapped from Handling Classes.`);
      q("#examAutoPdf").value="";S={file:null,lines:[],analysis:null,mappings:[]};renderSummary();renderMappings();q("#examRefreshBtn")?.click()
    }catch(err){setMessage(err.message||String(err),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}
  }

  function enhance(){
    if(!ADMIN.has(currentUser?.role))return;const panel=q("#examUploadPanel");if(!panel||q("#examAutoUpload"))return;addCss();
    const head=panel.querySelector(".panel-head"),headTitle=head?.querySelector("h3"),headP=head?.querySelector("p");if(headTitle)headTitle.textContent="Upload once — auto identify & map";if(headP)headP.textContent="The app reads the PDF, detects the exam and syllabus, then maps suitable sections, subjects and handling teachers automatically.";
    const oldNodes=[...panel.children].filter(x=>x!==head);
    const auto=document.createElement("div");auto.id="examAutoUpload";auto.className="exam-auto-upload";auto.innerHTML=`
      <label style="font-size:10px;font-weight:800;color:#53677e">Exam Syllabus PDF<input id="examAutoPdf" type="file" accept="application/pdf,.pdf"></label>
      <div id="examAutoMsg" class="exam-auto-msg">Choose the PDF. Detection starts automatically.</div>
      <div id="examAutoSummary" class="exam-auto-summary"></div>
      <div id="examAutoMappings"></div>
      <details id="examAutoReview" class="exam-auto-review"><summary>Review / Correct detection only if needed</summary>
        <div class="exam-auto-review-grid"><label>Detected Exam Name<input id="examAutoName"></label><label>Exam Date<input id="examAutoDate" type="date"></label><label>Completion Deadline<input id="examAutoDeadline" type="date"></label><label>Orientation<select id="examAutoOrientation"><option value="">Not sure / All</option><option>C Batch</option><option>Lead</option><option>Techno</option></select></label></div>
        <div class="exam-auto-add"><label>Missing Class / Section<select id="examAutoAddSection">${allSections().map(s=>`<option value="${escHtml(s.section)}">${escHtml(sectionLabel(s.section))}</option>`).join("")}</select></label><label>Subject<select id="examAutoAddSubject"></select></label><button id="examAutoAddBtn" type="button" class="outline-btn">Add Mapping</button></div>
        <div class="exam-auto-actions"><button id="examAutoRemapBtn" type="button" class="outline-btn">Re-run Mapping</button></div>
      </details>
      <div class="exam-auto-actions"><button id="examAutoSave" type="button" class="primary" disabled>Save Detected Exam Syllabus</button></div>`;
    panel.appendChild(auto);
    const fallback=document.createElement("details");fallback.className="exam-auto-fallback";fallback.innerHTML='<summary>Manual entry fallback</summary><div id="examManualOriginal"></div>';panel.appendChild(fallback);const host=fallback.querySelector("#examManualOriginal");oldNodes.forEach(x=>host.appendChild(x));
    q("#examAutoPdf").onchange=analyseSelected;q("#examAutoSave").onclick=saveDetected;q("#examAutoAddSection").onchange=fillAddSubjects;q("#examAutoAddBtn").onclick=addManualMapping;q("#examAutoRemapBtn").onclick=rerunOrientation;q("#examAutoOrientation").onchange=()=>{};["#examAutoName","#examAutoDate","#examAutoDeadline"].forEach(id=>q(id).onchange=syncManualFields);fillAddSubjects();renderMappings()
  }

  function watch(){enhance();new MutationObserver(()=>enhance()).observe(document.body,{childList:true,subtree:true});setTimeout(enhance,100);setTimeout(enhance,700)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});else watch()
})();
