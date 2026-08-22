// Generic multi-page exam PDF router v27 — rotation-aware page-content detection.
// Reads exam name/date/class from each PDF page, groups pages into separate exams, and saves each exam independently.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").replace(/\s+/g," ").trim();
  const norm=v=>txt(v).toUpperCase().replace(/[^A-Z0-9&]+/g," ").replace(/\s+/g," ").trim();
  const compact=v=>txt(v).toUpperCase().replace(/[^A-Z0-9&]+/g,"");
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const escHtml=v=>typeof esc==="function"?esc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let bound=null,legacyChange=null,pdfPromise=null,runId=0,state=null;

  function canon(v){try{return typeof canonicalSubject==="function"?canonicalSubject(v):txt(v)}catch(_){return txt(v)}}
  function appSections(){try{return Array.isArray(SECTIONS)?SECTIONS:[]}catch(_){return[]}}
  function activeMappings(){try{return data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}catch(_){return[]}}
  function sectionId(name){try{return REMOTE?.sectionIdByName?.get(name)||null}catch(_){return null}}
  function subjectId(name){try{return REMOTE?.subjectIdByName?.get(canon(name))||null}catch(_){return null}}
  function teacherName(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return activeMappings().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function teacherId(section,subject){const n=teacherName(section,subject);try{return REMOTE?.teacherIdByName?.get(n)||null}catch(_){return null}}
  function sectionLabel(section){const s=appSections().find(x=>x.section===section);return s?[s.section,s.batch||s.internal_batch,s.program||s.orientation].filter(Boolean).join(" · "):section}
  function subjectList(section){return uniq(activeMappings().filter(m=>m.section===section).map(m=>canon(m.subject)))}
  function minusDays(iso,days=3){if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||""))return"";const [y,m,d]=iso.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));dt.setUTCDate(dt.getUTCDate()-days);return`${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`}

  const SUBJECTS=[
    ["Track A",["TRACK A","TRACK - A","MATH A","MATHS A"]],
    ["Track B",["TRACK B","TRACK - B","MATH B","MATHS B"]],
    ["Physics",["PHYSICS","PHY"]],
    ["Chemistry",["CHEMISTRY","CHEM"]],
    ["Biology",["BIOLOGY","BIO"]]
  ];
  const aliases=new Map();
  for(const[name,list]of SUBJECTS)for(const a of list)aliases.set(compact(a),name);
  function exactSubject(v){const s=aliases.get(compact(v))||null;return s&&subjectId(s)?s:null}

  function shouldUseContentRouter(fileName){
    const s=norm(fileName);
    if(!s||/^(ILOVEPDF|MERGED|COMBINED|EXAM SYLLABUS|SYLLABUS MERGED)/.test(s))return true;
    // Named Lead/Techno/single C-batch files continue through their dedicated parsers.
    if(/\bLEAD\b|\bTECHNO\b|\bC\s*[1-5]\b|\bC[1-5]\b|\bBIWT\b|\bBIWEEKLY\b|\bCOT\b/.test(s))return false;
    return true
  }

  function dateFrom(v){const m=txt(v).match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);if(!m)return"";let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);if(!d||!mo||mo>12||d>31)return"";return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}
  function pageMeta(page){
    const joined=txt(page?.rawText||((page?.lines||[]).join(" ")));
    const level=(joined.match(/\bC\s*([1-5])\b/i)||[])[1];
    if(!level)return null;
    let examName="",examType="";
    let m=joined.match(/CUMULATIVE\s+OBJECTIVE\s+TEST\s*[–—-]?\s*(\d{1,2})/i)||joined.match(/\bCOT\s*[–—-]?\s*(\d{1,2})/i);
    if(m){examName=`C Batch COT ${Number(m[1])}`;examType="COT"}
    if(!examName){m=joined.match(/BIWEEKLY\s+TEST\s*[–—-]?\s*(\d{1,2})/i)||joined.match(/\bBIWT\s*[–—-]?\s*(\d{1,2})/i);if(m){examName=`C Batch BIWT ${Number(m[1])}`;examType="BIWT"}}
    if(!examName||!/(C\s*BATCH|C-BATCH|CBSE)/i.test(joined))return null;
    const n=Number(level),grade=11-n,date=dateFrom(joined);
    return{level:`C${n}`,grade,examName,examType,date,orientation:"C Batch"}
  }

  function groupRows(items){const rows=[];for(const it of items){let r=rows.find(x=>Math.abs(x.y-it.y)<=4.2);if(!r){r={y:it.y,items:[]};rows.push(r)}r.items.push(it)}rows.sort((a,b)=>b.y-a.y);for(const r of rows)r.items.sort((a,b)=>a.x-b.x);return rows}
  function rowText(items){return txt(items.map(x=>x.v).join(" "))}
  function subjectWindows(row){
    const a=row.items,out=[];
    for(let i=0;i<a.length;i++)for(let j=i;j<Math.min(a.length,i+8);j++){
      const slice=a.slice(i,j+1),joined=slice.map(z=>z.v).join(" "),tight=slice.map(z=>z.v).join(""),name=exactSubject(joined)||exactSubject(tight);if(!name)continue;
      if(compact(tight).length>26)continue;const x1=slice[0].x,x2=slice[slice.length-1].x+(slice[slice.length-1].w||0);out.push({name,i,j,x1,x2,cx:(x1+x2)/2,y:row.y})
    }
    out.sort((u,v)=>(u.j-u.i)-(v.j-v.i)||u.i-v.i);const keep=[];for(const h of out){if(keep.some(k=>k.name===h.name&&Math.abs(k.cx-h.cx)<18))continue;keep.push(h)}return keep.sort((a,b)=>a.cx-b.cx)
  }
  function anchors(page){const out=[];page.rows.forEach((r,ri)=>subjectWindows(r).forEach(h=>out.push({...h,ri})));return out}
  function headerCluster(page,all){if(!all.length)return null;const first=Math.min(...all.map(a=>a.ri)),near=all.filter(a=>a.ri<=first+3),by=new Map();for(const a of near){const p=by.get(a.name);if(!p||a.ri<p.ri||(a.ri===p.ri&&(a.j-a.i)<(p.j-p.i)))by.set(a.name,a)}const heads=[...by.values()].sort((a,b)=>a.cx-b.cx);return heads.length>=2?{heads,endRi:Math.max(...heads.map(h=>h.ri))}:null}
  function bounds(heads){const cs=heads.map(h=>h.cx);return heads.map((h,i)=>({subject:h.name,left:i?((cs[i-1]+cs[i])/2):(cs[0]-(cs[1]-cs[0])/2),right:i===heads.length-1?(cs[i]+(cs[i]-cs[i-1])/2):((cs[i]+cs[i+1])/2)}))}
  function isStop(v){const s=norm(v);return /^NOTE\b/.test(s)||/OBJECTIVE TEST \d+ PAPER PATTERN/.test(s)||/TOTAL MARKS/.test(s)||/S NO QUESTION NO NO OF QUESTIONS MARKS/.test(s)||/ALL THE BEST/.test(s)}
  function isNoise(v){const s=norm(v);return !s||/SRI CHAITANYA|NORTH INDIA|\bCBSE\b|C BATCH|CUMULATIVE OBJECTIVE TEST|BIWEEKLY TEST|\bBIWT\b|DATE OF EXAMINATION|ACADEMIC YEAR|\bCLASS\b|MATHEMATICS|^TRACK A$|^TRACK B$|^PHYSICS$|^CHEMISTRY$|^NCERT$/.test(s)||/\b(QUESTION|MARKS|OMR|MAX MARKS|TIME|OBJECTIVE TYPE|PAPER PATTERN)\b/.test(s)||/\b\d+Q\b/.test(s)}
  function cleanTopic(v){let s=txt(v).replace(/^[|,:;\-–—\s]+|[|,:;\-–—\s]+$/g,"");if(!s||isNoise(s)||isStop(s))return"";s=s.replace(/\bSRP\s*:\s*/i,"SRP: ").replace(/\s+/g," ").trim();if(!/[A-Za-z]/.test(s)||s.length<2)return"";return s}
  function mergeTopics(lines){const out=[];for(const raw of lines){const s=cleanTopic(raw);if(!s)continue;if(!out.length){out.push(s);continue}const prev=out[out.length-1];const cont=/^(AND|OR|OF|THE|IN|ON|WITH|TO|FOR|GOAL)\b/i.test(s)||/\b(OF|AND|OR|WITH|IN|ON|TO|FOR)\s*$/i.test(prev)||(/^\(?Aim\b/i.test(s));if(cont)out[out.length-1]=`${prev} ${s}`.replace(/\s+/g," ").trim();else out.push(s)}return uniq(out)}
  function parsePageTopics(page){
    const all=anchors(page),header=headerCluster(page,all);if(!header)return{subjects:[],topics:new Map()};const bs=bounds(header.heads),lines=new Map(header.heads.map(h=>[h.name,[]]));
    for(let ri=header.endRi+1;ri<page.rows.length;ri++){
      const r=page.rows[ri],whole=rowText(r.items);if(isStop(whole))break;
      const later=subjectWindows(r);if(later.length>=2&&ri>header.endRi+1)break;
      for(const b of bs){const cells=r.items.filter(z=>{const c=z.x+(z.w||0)/2;return c>b.left&&c<=b.right});if(!cells.length)continue;const t=rowText(cells);if(t)lines.get(b.subject).push(t)}
    }
    const topics=new Map();for(const h of header.heads)topics.set(h.name,mergeTopics(lines.get(h.name)||[]));return{subjects:header.heads.map(h=>h.name),topics}
  }

  async function pdfLib(){if(globalThis.pdfjsLib)return globalThis.pdfjsLib;if(pdfPromise)return pdfPromise;pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(pdfjsLib)};s.onerror=()=>reject(new Error("PDF reader could not load"));document.head.appendChild(s)});return pdfPromise}
  async function readPages(file){const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,pages=[];for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),tc=await pg.getTextContent(),viewport=pg.getViewport({scale:1}),items=[],rawText=txt((tc.items||[]).map(it=>it.str||"").join(" "));for(const it of tc.items||[]){const v=txt(it.str);if(!v)continue;let x=Number(it.transform?.[4]||0),y=Number(it.transform?.[5]||0);try{const m=lib.Util.transform(viewport.transform,it.transform);x=Number(m[4]||0);y=Number(viewport.height-m[5]||0)}catch(_){}items.push({v,x,y,w:Number(it.width||0)*Number(viewport.scale||1),h:Number(it.height||0)*Number(viewport.scale||1)})}const rows=groupRows(items),lines=rows.map(r=>rowText(r.items)).filter(Boolean);pages.push({page:p,rotation:Number(pg.rotate||0),rows,lines,rawText})}return pages}

  function mappingsFor(meta,parsed,pageNo){
    const targets=appSections().filter(s=>Number(s.grade)===meta.grade&&txt(s.program||s.orientation).toLowerCase()==="c batch").map(s=>s.section),out=[];
    for(const sec of targets)for(const sub of parsed.subjects){if(!subjectList(sec).includes(canon(sub)))continue;const topics=parsed.topics.get(sub)||[];if(!topics.length)continue;out.push({section:sec,subject:canon(sub),teacher:teacherName(sec,sub),topics,page:pageNo,level:meta.level})}
    return out
  }
  function makeGroups(pages){
    const groups=new Map();
    for(const page of pages){const meta=pageMeta(page);if(!meta)continue;const parsed=parsePageTopics(page),mappings=mappingsFor(meta,parsed,page.page);if(!mappings.length)continue;const key=`${meta.examName}|${meta.date}`;if(!groups.has(key))groups.set(key,{key,...meta,pages:[],levels:[],mappings:[]});const g=groups.get(key);g.pages.push(page.page);g.levels.push(meta.level);g.mappings.push(...mappings)}
    for(const g of groups.values()){const dedup=new Map();for(const m of g.mappings)dedup.set(`${m.section}|${m.subject}`,m);g.mappings=[...dedup.values()];g.levels=uniq(g.levels);g.deadline=minusDays(g.date,3);g.editName=g.examName;g.editDeadline=g.deadline}
    return [...groups.values()]
  }

  function setMsg(v,bad=false){const x=q("#examAutoMsg");if(x){x.textContent=v;x.className=`exam-auto-msg ${bad?"exam-auto-bad":"exam-auto-good"}`}}
  function css(){if(q("#multiExamCss"))return;const s=document.createElement("style");s.id="multiExamCss";s.textContent=`.multi-exams{display:grid;gap:9px}.multi-exam-card{border:1px solid #dce6f1;border-radius:12px;background:#fff;padding:11px}.multi-exam-head{display:flex;gap:9px;align-items:center}.multi-exam-e{width:34px;height:34px;border-radius:10px;background:#eaf3fd;color:#245d9b;display:grid;place-items:center;font-weight:900}.multi-exam-name{font-weight:850}.multi-exam-meta{font-size:10px;color:#6d7d8f;margin-top:2px}.multi-exam-card details{margin-top:8px}.multi-exam-card summary{cursor:pointer;color:#315f91;font-weight:750;font-size:12px}.multi-edit{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:8px}.multi-edit label{font-size:10px;font-weight:700}.multi-edit input{width:100%}@media(max-width:680px){.multi-edit{grid-template-columns:1fr}}`;document.head.appendChild(s)}
  function render(groups,file){
    css();state={groups,file};const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave"),review=q("#examAutoUiV11 .exam-auto-fallback");
    if(review)review.style.display="none";
    if(sum)sum.innerHTML=`<div class="exam-auto-chip"><small>Detected exams</small><strong>${groups.length}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>PDF Pages</small><strong>${uniq(groups.flatMap(g=>g.pages)).length}</strong></div><div class="exam-auto-chip"><small>Mappings</small><strong>${groups.reduce((n,g)=>n+g.mappings.length,0)}</strong></div>`;
    if(host)host.innerHTML=`<div class="multi-exams">${groups.map((g,gi)=>`<div class="multi-exam-card"><div class="multi-exam-head"><div class="multi-exam-e">E</div><div><div class="multi-exam-name">${escHtml(g.examName)}</div><div class="multi-exam-meta">${escHtml(g.levels.join(", "))} · ${escHtml(g.date||"Date not found")} · ${g.mappings.length} mappings · page${g.pages.length>1?"s":""} ${g.pages.join(", ")}</div></div></div><div class="multi-edit"><label>Exam Name<input class="multi-name" data-gi="${gi}" value="${escHtml(g.editName)}"></label><label>Completion Deadline<input class="multi-deadline" data-gi="${gi}" type="date" value="${escHtml(g.editDeadline)}"></label></div><details><summary>View detected syllabus</summary>${g.mappings.map(m=>`<div style="font-size:11px;padding:5px 0;border-bottom:1px solid #eef2f6"><strong>${escHtml(sectionLabel(m.section))} · ${escHtml(m.subject)}</strong> · ${escHtml(m.teacher||"Unmapped")}<br>${m.topics.map(t=>`• ${escHtml(t)}`).join("<br>")}</div>`).join("")}</details></div>`).join("")}</div>`;
    qa(".multi-name").forEach(x=>x.oninput=()=>{groups[Number(x.dataset.gi)].editName=x.value});qa(".multi-deadline").forEach(x=>x.onchange=()=>{groups[Number(x.dataset.gi)].editDeadline=x.value});
    if(btn){btn.disabled=!groups.length;btn.onclick=groups.length?()=>saveAll():null}
  }
  function renderDetecting(){const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave"),review=q("#examAutoUiV11 .exam-auto-fallback");if(review)review.style.display="none";if(sum)sum.innerHTML="";if(host)host.innerHTML='<div class="exam-detect-mini"><span class="exam-detect-dot"></span><span>Detecting exams and syllabus…</span></div>';if(btn)btn.disabled=true}
  function fileToB64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.onerror=reject;r.readAsDataURL(file)})}
  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function saveAll(){if(!state?.groups?.length)return;const btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";try{const file_base64=await fileToB64(state.file);let total=0;for(const g of state.groups){const mappings=g.mappings.map(m=>({section_id:sectionId(m.section),subject_id:subjectId(m.subject),teacher_id:teacherId(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id);if(!mappings.length)continue;const name=txt(g.editName)||g.examName,deadline=g.editDeadline||minusDays(g.date,3);const r=await api("document_batch_save",{exam_name:name,exam_date:g.date||null,completion_deadline:deadline||null,file_name:state.file.name,file_size:state.file.size,file_base64,mappings});total+=Number(r.count||mappings.length)}setMsg(`Saved ${state.groups.length} detected exam(s) with ${total} class-subject mapping(s).`);q("#examRefreshBtn")?.click();window.dispatchEvent(new CustomEvent("exam-syllabus-updated"))}catch(e){setMsg(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}}
  async function process(file,id){renderDetecting();setMsg("Reading exam headings from each PDF page…");try{const pages=await readPages(file);if(id!==runId)return;const groups=makeGroups(pages);if(!groups.length){setMsg("No supported exam headings were found inside this merged PDF. Trying the standard parser…",true);if(typeof legacyChange==="function")return legacyChange.call(bound,{target:bound,currentTarget:bound,type:"change"});return}render(groups,file);setMsg(`Detected ${groups.length} exam(s) from the PDF contents: ${groups.map(g=>g.examName+" ("+g.levels.join(", ")+")").join("; ")}.`)}catch(e){if(id!==runId)return;setMsg(`Could not read merged PDF: ${e.message||e}`,true);if(typeof legacyChange==="function")legacyChange.call(bound,{target:bound,currentTarget:bound,type:"change"})}}

  function bind(){const input=q("#examAutoPdf");if(!input||input===bound)return;bound=input;legacyChange=input.onchange;input.onchange=function(ev){const file=input.files?.[0];if(!file)return;if(!shouldUseContentRouter(file.name)){return typeof legacyChange==="function"?legacyChange.call(input,ev):undefined}state=null;const id=++runId;process(file,id)}}
  new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});setInterval(bind,900);bind()
})();
