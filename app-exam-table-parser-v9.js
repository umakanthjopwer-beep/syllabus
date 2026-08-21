// Single authoritative Exam Syllabus PDF parser.
// Reads subject-wise syllabus by PDF geometry. No legacy exam detector should run with this module.
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
  function sectionName(id){try{return REMOTE?.sectionById?.get(id)?.section||id||""}catch(_){return id||""}}
  function subjectName(id){try{return canon(REMOTE?.subjectById?.get(id)?.name||"")||id||""}catch(_){return id||""}}
  function teacherName(id){try{return REMOTE?.teacherById?.get(id)?.name||""}catch(_){return""}}

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
  const aliasMap=new Map();for(const[name,aliases]of SUBJECTS)for(const a of aliases)aliasMap.set(compact(a),name);
  function exactSubject(v){const name=aliasMap.get(compact(v))||null;return name&&subid(name)?name:null}

  function examSignals(fileName){
    const s=text(fileName).replace(/\.[^.]+$/," "),level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i),test=s.match(/\b(?:BIWEEKLY\s+TEST|BIWT)\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    if(!level||!test||!/\bC\s*[- ]?BATCH\b|\bBIWEEKLY\s+TEST\b|\bBIWT\b/i.test(s))return null;
    const n=Number(level[1]);return{grade:11-n,level:`C${n}`,examName:`C Batch BIWT ${Number(test[1])}`}
  }
  function dateFrom(fileName,lines=[]){for(const v of [fileName,...lines]){const m=text(v).match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);if(!m)continue;let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);if(y>=2020&&y<=2035&&mo>=1&&mo<=12&&d>=1&&d<=31)return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}return""}

  function isPattern(v){
    const s=words(v);
    return /\b(PAPER\s+PATTERN|MATHEMATICS\s+PATTERN|PHYSICS\s+PATTERN|CHEMISTRY\s+PATTERN|BIOLOGY\s+PATTERN|OBJECTIVE\s+TEST|STRAIGHT\s+OBJECTIVE|OBJECTIVE\s+TYPE|QUESTION(?:S)?|NO\s+OF\s+QUESTIONS|TOTAL\s+QUESTIONS|TOTAL\s+MARKS|EACH\s+QUESTION|MARKS?|CORRECT\s+ANSWER|WRONG\s+ANSWER|NEGATIVE\s+MARK|MULTIPLE\s+CHOICE|SINGLE\s+CORRECT|MULTI\s+CORRECT|INTEGER\s+TYPE|MATRIX\s+MATCH|ASSERTION|PASSAGE|DURATION|TIME\s+ALLOWED|INSTRUCTIONS?|ALL\s+THE\s+BEST)\b/.test(s)||/\b\d+\s*(?:TO|-)\s*\d+\b.*\b\d+\s*[X×]\s*\d+\b/.test(s)||/\b\d+\s*[X×]\s*\d+\s*=\s*\d+\b/.test(s)
  }
  function isMeta(v){const s=words(v);return !s||/SRI\s+CHAITANYA|NORTH\s+INDIA|\bCBSE\b|C\s*[- ]?BATCH|BIWEEKLY\s+TEST|\bBIWT\b|EXAM\s+DATE|ACADEMIC\s+YEAR|SYLLABUS\s+FOR|PAGE\s+\d+/.test(s)}
  function isHeader(v){return /^(S\.?\s*NO\.?|SL\.?\s*NO\.?|SUBJECT|SYLLABUS|PORTION|CHAPTERS?|TOPICS?|REMARKS?|DATE|MARKS?)$/i.test(text(v))}
  function clean(v){return text(v).replace(/^[|,:;\-–—\s]+|[|,:;\-–—\s]+$/g,"").replace(/\s+/g," ").trim()}
  function validTopic(v){const s=clean(v);if(s.length<2||s.length>350||isMeta(s)||isPattern(s)||isHeader(s)||exactSubject(s))return false;return /[A-Za-z]/.test(s)}
  function addTopic(map,subject,v){const s=clean(v);if(!validTopic(s))return;if(!map.has(subject))map.set(subject,[]);const a=map.get(subject);if(!a.some(x=>x.toLowerCase()===s.toLowerCase()))a.push(s)}

  function groupRows(items){
    const rows=[];for(const it of items){let row=rows.find(r=>Math.abs(r.y-it.y)<=2.8);if(!row){row={y:it.y,items:[]};rows.push(row)}row.items.push(it)}
    rows.sort((a,b)=>b.y-a.y);for(const r of rows)r.items.sort((a,b)=>a.x-b.x);return rows
  }
  function rowText(rowOrItems){const items=Array.isArray(rowOrItems)?rowOrItems:rowOrItems.items;return clean(items.map(z=>z.v).join(" "))}
  function subjectWindows(row){
    const a=row.items,out=[];for(let i=0;i<a.length;i++)for(let j=i;j<Math.min(a.length,i+12);j++){
      const slice=a.slice(i,j+1),joined=slice.map(z=>z.v).join(" "),tight=slice.map(z=>z.v).join(""),name=exactSubject(joined)||exactSubject(tight);if(!name)continue;
      if(compact(tight).length>28)continue;const x1=slice[0].x,x2=slice[slice.length-1].x+(slice[slice.length-1].w||0);out.push({name,i,j,x1,x2,cx:(x1+x2)/2,y:row.y})
    }
    out.sort((u,v)=>(u.j-u.i)-(v.j-v.i)||u.i-v.i);const keep=[];for(const h of out){if(keep.some(k=>k.name===h.name&&Math.abs(k.cx-h.cx)<20))continue;keep.push(h)}return keep.sort((u,v)=>u.cx-v.cx)
  }
  function allAnchors(page){const out=[];page.rows.forEach((row,ri)=>subjectWindows(row).forEach(h=>out.push({...h,ri})));return out}
  function mergeWrapped(lines){
    const out=[];for(const raw of lines){const s=clean(raw);if(!validTopic(s))continue;if(!out.length){out.push(s);continue}const prev=out[out.length-1];
      const continuation=/^(AND|OR|OF|THE|IN|ON|WITH|TO)\b/i.test(s)||/\b(OF|AND|OR|WITH|IN|ON|TO|FOR)$/i.test(prev)||(/^[A-Za-z][A-Za-z\s-]{1,24}$/.test(s)&&/^\s*\d+[.)-]/.test(prev));
      if(continuation)out[out.length-1]=`${prev} ${s}`.replace(/\s+/g," ").trim();else out.push(s)
    }return uniq(out)
  }

  function parseHorizontal(page,anchors){
    const byRow=new Map();for(const a of anchors){if(!byRow.has(a.ri))byRow.set(a.ri,[]);byRow.get(a.ri).push(a)}
    const candidates=[...byRow.entries()].map(([ri,as])=>({ri,as:uniq(as.map(x=>x.name)).length,anchors:as})).filter(x=>x.as>=2).sort((a,b)=>b.as-a.as||a.ri-b.ri);
    if(!candidates.length)return null;const header=candidates[0],heads=header.anchors.sort((a,b)=>a.cx-b.cx),topics=new Map(),subjects=uniq(heads.map(h=>h.name));
    const centers=heads.map(h=>h.cx),bounds=heads.map((h,i)=>({subject:h.name,left:i===0?-Infinity:(centers[i-1]+centers[i])/2,right:i===heads.length-1?Infinity:(centers[i]+centers[i+1])/2}));
    const linesBySub=new Map(subjects.map(s=>[s,[]]));
    for(let ri=header.ri+1;ri<page.rows.length;ri++){
      const row=page.rows[ri],whole=rowText(row);if(!whole)continue;if(isPattern(whole))break;
      const rowHeads=subjectWindows(row);if(rowHeads.length>=2)break;
      for(const b of bounds){const cells=row.items.filter(z=>{const c=z.x+(z.w||0)/2;return c>b.left&&c<=b.right});const t=rowText(cells);if(t&&validTopic(t))linesBySub.get(b.subject).push(t)}
    }
    for(const s of subjects){for(const t of mergeWrapped(linesBySub.get(s)||[]))addTopic(topics,s,t)}
    return{layout:"columns",subjects,topics,score:scoreResult(subjects,topics)}
  }

  function syllabusX(page){const xs=[];for(const row of page.rows)for(const it of row.items){const w=words(it.v);if(/^(SYLLABUS|PORTION|CHAPTERS?|TOPICS?)$/.test(w))xs.push(it.x)}return xs.length?Math.min(...xs):null}
  function parseVertical(page,anchors){
    if(!anchors.length)return null;const ordered=[...anchors].sort((a,b)=>a.ri-b.ri||a.cx-b.cx),topics=new Map(),subjects=uniq(ordered.map(a=>a.name)),sx=syllabusX(page);
    for(let ai=0;ai<ordered.length;ai++){
      const a=ordered[ai],next=ordered.slice(ai+1).find(x=>x.ri>a.ri),endRi=next?next.ri:page.rows.length,lines=[];
      const sameRow=page.rows[a.ri];let cells=sameRow.items.filter(z=>z.x>a.x2+4&&(sx==null||z.x>=sx-8));let t=rowText(cells);if(t&&validTopic(t))lines.push(t);
      for(let ri=a.ri+1;ri<endRi;ri++){const row=page.rows[ri],whole=rowText(row);if(!whole)continue;if(isPattern(whole))break;if(subjectWindows(row).length)break;cells=row.items.filter(z=>sx!=null?z.x>=sx-8:z.x>a.x2+4);t=rowText(cells);if(t&&validTopic(t))lines.push(t)}
      for(const x of mergeWrapped(lines))addTopic(topics,a.name,x)
    }
    return{layout:"rows",subjects,topics,score:scoreResult(subjects,topics)}
  }
  function scoreResult(subjects,topics){const withTopics=subjects.filter(s=>(topics.get(s)||[]).length>0).length,total=[...topics.values()].reduce((n,a)=>n+a.length,0);return withTopics*100+subjects.length*10+Math.min(total,30)}
  function parsePage(page){const anchors=allAnchors(page);if(!anchors.length)return null;const h=parseHorizontal(page,anchors),v=parseVertical(page,anchors);if(h&&v)return h.score>=v.score?h:v;return h||v}
  function parseDocument(pages){
    const subjects=[],topics=new Map(),layouts=[];for(const page of pages){const p=parsePage(page);if(!p)continue;layouts.push(p.layout);for(const s of p.subjects){if(!subjects.includes(s))subjects.push(s);for(const t of p.topics.get(s)||[])addTopic(topics,s,t)}}
    for(const s of subjects)topics.set(s,mergeWrapped(topics.get(s)||[]));return{subjects,topics,layout:uniq(layouts).join(" + ")||"geometry"}
  }

  async function pdfLib(){if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfPromise)return pdfPromise;pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfPromise}
  async function readPdf(file){const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,pages=[],lines=[];for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),tc=await pg.getTextContent(),items=[];for(const it of tc.items||[]){const v=text(it.str);if(!v)continue;items.push({v,x:Number(it.transform?.[4]||0),y:Number(it.transform?.[5]||0),w:Number(it.width||0),h:Number(it.height||0)})}const rows=groupRows(items);pages.push({page:p,rows});for(const r of rows){const t=rowText(r);if(t)lines.push(t)}}return{pages,lines}}

  function buildMappings(sig,parsed){const targets=appSections().filter(s=>Number(s.grade)===Number(sig.grade)&&s.program==="C Batch").map(s=>s.section),out=[];for(const sec of targets)for(const sub of parsed.subjects){if(!subjectsFor(sec).includes(canon(sub)))continue;out.push({section:sec,subject:canon(sub),teacher:teacherFor(sec,sub),topics:parsed.topics.get(sub)||[],source:`PDF table ${parsed.layout}`})}return out}
  function setMsg(msg,bad=false){const x=q("#examAutoMsg");if(x){x.textContent=msg;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}}
  function renderScanning(sig){const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(sum)sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(sig.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>Detecting…</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>—</strong></div>`;if(host)host.innerHTML='<div class="exam-auto-empty"><strong>Reading the PDF as a subject table…</strong><br>Each subject gets only text from its own row/column. Exam-pattern text is excluded.</div>';if(btn){btn.disabled=true;btn.onclick=null}}
  function renderResult(){if(!state)return;const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(state.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(state.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${state.mappings.length}</strong></div>`;
    if(!state.mappings.length){host.innerHTML='<div class="exam-auto-empty">No reliable subject-wise syllabus was detected. Nothing has been auto-added.</div>';btn.disabled=true;return}
    host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Detected syllabus</th><th>Detection</th></tr></thead><tbody>${state.mappings.map((m,i)=>`<tr><td><input class="exam-v9-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td><strong>${escHtml(m.subject)}</strong></td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length?`<strong>${m.topics.length} topic(s)</strong><details><summary style="cursor:pointer;color:#345f91">View syllabus</summary><div style="max-width:330px;white-space:normal;margin-top:5px">${m.topics.map(t=>`• ${escHtml(t)}`).join("<br>")}</div></details>`:'<span style="color:#a43c36;font-weight:700">No syllabus text detected for this subject</span>'}</td><td>${escHtml(m.source)}</td></tr>`).join("")}</tbody></table></div>`;
    const missing=uniq(state.mappings.filter(m=>!m.topics.length).map(m=>m.subject));btn.disabled=missing.length>0;btn.onclick=missing.length?null:save;
  }
  function syncReview(){if(!state)return;for(const[id,v]of [["#examAutoName",state.examName],["#examAutoDate",state.examDate],["#examAutoDeadline",state.examDate],["#examAutoOrientation","C Batch"],["#examName",state.examName],["#examDate",state.examDate],["#examDeadline",state.examDate]]){const x=q(id);if(x)x.value=v||""}}
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function save(){if(!state?.file)return;const chosen=qa(".exam-v9-use:checked").map(x=>state.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMsg("Keep at least one detected mapping selected.",true);return}const missing=uniq(chosen.filter(m=>!m.topics.length).map(m=>m.subject));if(missing.length){setMsg(`Cannot save. Missing syllabus text for: ${missing.join(", ")}.`,true);return}const mappings=chosen.map(m=>({section_id:sid(m.section),subject_id:subid(m.subject),teacher_id:tid(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id),btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(state.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:state.examName,exam_date:state.examDate||null,completion_deadline:state.examDate||null,file_name:state.file.name,file_size:state.file.size,file_base64,mappings});setMsg(`Saved ${r.count||mappings.length} correct subject-wise mapping(s). Previous zero-topic versions remain only in history.`);const inp=q("#examAutoPdf");if(inp)inp.value="";q("#examRefreshBtn")?.click()}catch(e){setMsg(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}}

  async function process(file,sig,id){renderScanning(sig);try{const raw=await readPdf(file);if(id!==runId)return;const parsed=parseDocument(raw.pages),examDate=dateFrom(file.name,raw.lines),mappings=buildMappings(sig,parsed);state={file,examName:sig.examName,examDate,grade:sig.grade,mappings,parsed};renderResult();syncReview();const names=uniq(mappings.map(m=>m.subject)),missing=uniq(mappings.filter(m=>!m.topics.length).map(m=>m.subject));if(!mappings.length)setMsg("No reliable subject-wise syllabus mapping was found. Nothing was added.",true);else if(missing.length)setMsg(`Subjects detected: ${names.join(", ")}. Syllabus text is still missing for ${missing.join(", ")}; Save remains disabled.`,true);else setMsg(`Subject-wise syllabus captured correctly for ${names.join(", ")}. Review each View syllabus once, then save.`)}catch(e){if(id!==runId)return;state=null;setMsg(`Could not read this PDF reliably: ${e.message||e}`,true);const btn=q("#examAutoSave");if(btn)btn.disabled=true}}
  function handleChange(){const input=q("#examAutoPdf"),file=input?.files?.[0],sig=examSignals(file?.name||"");if(!file)return;if(!sig){setMsg("This automatic parser currently expects a C-Batch BIWT PDF filename with C1-C5 and BIWEEKLY TEST/BIWT.",true);return}const id=++runId;state=null;process(file,sig,id)}

  function renderSubjectCards(){
    const table=q("#examDocsTable");if(!table||!table.closest(".panel"))return;const panel=table.closest(".panel");let host=q("#examSubjectCards");if(!host){host=document.createElement("div");host.id="examSubjectCards";host.style.cssText="display:grid;gap:10px;margin:12px 0";panel.querySelector(".table-wrap")?.before(host)}
    if(typeof examState==="undefined"||!Array.isArray(examState.documents)){host.innerHTML="";return}const docs=examState.documents.filter(d=>d.is_current!==false),groups=new Map();for(const d of docs){const key=[d.exam_name,subjectName(d.subject_id)].join("|");if(!groups.has(key))groups.set(key,{exam:d.exam_name,subject:subjectName(d.subject_id),docs:[]});groups.get(key).docs.push(d)}
    host.innerHTML=[...groups.values()].map(g=>{const topics=uniq(g.docs.flatMap(d=>Array.isArray(d.topics)?d.topics:[])),classes=uniq(g.docs.map(d=>sectionName(d.section_id))),teachers=uniq(g.docs.map(d=>teacherName(d.teacher_id)).filter(Boolean));return `<div style="border:1px solid #dfe6ef;border-radius:12px;padding:12px;background:#fff"><div style="font-size:11px;color:#66788d;font-weight:800">${escHtml(g.exam)}</div><div style="font-size:17px;font-weight:800;margin:2px 0 6px">${escHtml(g.subject)}</div><div style="font-size:12px;margin-bottom:6px"><strong>Class:</strong> ${escHtml(classes.join(", "))} &nbsp; <strong>Teacher:</strong> ${escHtml(teachers.join(", ")||"—")}</div>${topics.length?`<details><summary style="cursor:pointer;color:#275c94;font-weight:700">View syllabus · ${topics.length} topic(s)</summary><div style="margin-top:7px;line-height:1.45">${topics.map(t=>`• ${escHtml(t)}`).join("<br>")}</div></details>`:'<div style="color:#a43c36;font-weight:700">No syllabus topics stored in this version</div>'}</div>`}).join("")
  }
  function bind(){const input=q("#examAutoPdf");if(!input||input===boundInput)return;boundInput=input;input.onchange=handleChange;const btn=q("#examAutoSave");if(btn){btn.onclick=save;btn.disabled=true}renderSubjectCards()}
  const observer=new MutationObserver(()=>{bind();renderSubjectCards()});observer.observe(document.body,{childList:true,subtree:true});setInterval(()=>{bind();renderSubjectCards()},1200);bind()
})();
