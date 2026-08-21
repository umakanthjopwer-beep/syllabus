// Final exam auto-mapping fix: use the app's global lexical bindings directly.
// Earlier recovery modules used globalThis.SECTIONS/data/REMOTE, but these are declared with const/let
// in classic scripts and therefore are not window/globalThis properties.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/exam-syllabus-api";
  const CORE=["Track A","Track B","Physics","Chemistry","Biology"];
  let boundInput=null,lastFile=null,lastState=null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").trim();
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v):txt(v);
  const escHtml=v=>typeof esc==="function"?esc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];

  function appSections(){try{return Array.isArray(SECTIONS)?SECTIONS:[]}catch(_){return[]}}
  function handlingMaps(){try{return data?.setup?.handlingMappings?.filter(m=>m.activeForSyllabus)||[]}catch(_){return[]}}
  function remote(){try{return REMOTE}catch(_){return null}}
  function subjectsFor(section){return uniq(handlingMaps().filter(m=>m.section===section).map(m=>canon(m.subject)))}
  function teacherFor(section,subject){try{return handlingTeacher(section,canon(subject))||""}catch(_){return handlingMaps().find(m=>m.section===section&&canon(m.subject)===canon(subject))?.teacher||""}}
  function sectionId(section){return remote()?.sectionIdByName?.get(section)||null}
  function subjectId(subject){return remote()?.subjectIdByName?.get(canon(subject))||null}
  function teacherId(section,subject){const n=teacherFor(section,subject);return remote()?.teacherIdByName?.get(n)||null}
  function sectionLabel(section){const s=appSections().find(x=>x.section===section);return s?[s.section,s.batch,s.program].filter(Boolean).join(" · "):section}

  function signals(name){
    const s=txt(name).replace(/\.[^.]+$/," ");
    const level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i),test=s.match(/\b(?:BIWEEKLY\s+TEST|BIWT)\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    if(!level||!test||!/\bC\s*[- ]?BATCH\b|\bBIWEEKLY\s+TEST\b|\bBIWT\b/i.test(s))return null;
    return{grade:11-Number(level[1]),level:`C${Number(level[1])}`,examName:`C Batch BIWT ${Number(test[1])}`}
  }
  function examDateFromName(name){const m=txt(name).match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);if(!m)return"";let y=Number(m[3]);if(y<100)y+=2000;const d=Number(m[1]),mo=Number(m[2]);if(y<2020||y>2035||mo<1||mo>12||d<1||d>31)return"";return`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}

  function build(sig){
    const targets=appSections().filter(s=>Number(s.grade)===Number(sig.grade)&&s.program==="C Batch").map(s=>s.section);
    const mappings=[];
    for(const sec of targets){
      const available=subjectsFor(sec);
      for(const sub of CORE){
        const c=canon(sub);if(!available.includes(c))continue;
        mappings.push({section:sec,subject:c,teacher:teacherFor(sec,c),topics:[],source:"BIWT core inference — review"})
      }
    }
    return{targets,mappings}
  }

  function setMessage(msg,bad=false){const x=q("#examAutoMsg");if(!x)return;x.textContent=msg;x.classList.toggle("exam-auto-bad",bad);x.classList.toggle("exam-auto-good",!bad)}
  function syncReview(st){const vals=[["#examAutoName",st.examName],["#examAutoDate",st.examDate],["#examAutoDeadline",st.examDate],["#examAutoOrientation","C Batch"],["#examName",st.examName],["#examDate",st.examDate],["#examDeadline",st.examDate]];for(const[id,v]of vals){const x=q(id);if(x)x.value=v||""}}
  function render(st){
    const sum=q("#examAutoSummary"),host=q("#examAutoMappings"),btn=q("#examAutoSave");if(!sum||!host||!btn)return;
    sum.innerHTML=`<div class="exam-auto-chip"><small>Exam</small><strong>${escHtml(st.examName)}</strong></div><div class="exam-auto-chip"><small>Orientation</small><strong>C Batch</strong></div><div class="exam-auto-chip"><small>Exam date</small><strong>${escHtml(st.examDate||"Not found")}</strong></div><div class="exam-auto-chip"><small>Mapped class-subjects</small><strong>${st.mappings.length}</strong></div>`;
    if(!st.mappings.length){host.innerHTML=`<div class="exam-auto-empty">${escHtml(st.level)} = Class ${st.grade} was identified, but the live C-Batch Handling Classes mapping is not available yet. Tap Refresh once and retry.</div>`;btn.disabled=true;return}
    host.innerHTML=`<div class="exam-auto-wrap"><table class="exam-auto-table"><thead><tr><th>Use</th><th>Class / Batch</th><th>Subject</th><th>Handling Teacher</th><th>Topics</th><th>Detection</th></tr></thead><tbody>${st.mappings.map((m,i)=>`<tr><td><input class="exam-v4-use" data-i="${i}" type="checkbox" checked></td><td><strong>${escHtml(sectionLabel(m.section))}</strong></td><td>${escHtml(m.subject)}</td><td>${escHtml(m.teacher||"Unmapped")}</td><td>${m.topics.length}</td><td>${escHtml(m.source)}</td></tr>`).join("")}</tbody></table></div>`;
    btn.disabled=false;btn.onclick=saveCurrent
  }

  async function api(action,payload={}){const t=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";if(!t)throw new Error("Please sign in again.");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Request failed (${r.status})`);return o}
  async function saveCurrent(){
    const st=lastState;if(!st?.file)return;
    const chosen=qa(".exam-v4-use:checked").map(x=>st.mappings[Number(x.dataset.i)]).filter(Boolean);if(!chosen.length){setMessage("Keep at least one mapping selected.",true);return}
    const mappings=chosen.map(m=>({section_id:sectionId(m.section),subject_id:subjectId(m.subject),teacher_id:teacherId(m.section,m.subject),topics:m.topics})).filter(m=>m.section_id&&m.subject_id);
    if(!mappings.length){setMessage("Central section/subject IDs are not loaded. Tap Refresh once and retry.",true);return}
    const examName=txt(q("#examAutoName")?.value)||st.examName,examDate=q("#examAutoDate")?.value||st.examDate||null,deadline=q("#examAutoDeadline")?.value||examDate||null,btn=q("#examAutoSave");btn.disabled=true;btn.textContent="Saving…";
    try{const file_base64=typeof fileToBase64==="function"?await fileToBase64(st.file):null;if(!file_base64)throw new Error("Could not read PDF for upload");const r=await api("document_batch_save",{exam_name:examName,exam_date:examDate,completion_deadline:deadline,file_name:st.file.name,file_size:st.file.size,file_base64,mappings});setMessage(`Saved ${r.count||mappings.length} mappings for ${examName}. Sections and handling teachers came from the live Handling Classes master.`);const input=q("#examAutoPdf");if(input)input.value="";lastFile=null;lastState=null;q("#examRefreshBtn")?.click()}catch(e){setMessage(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent="Save Detected Exam Syllabus"}
  }

  function run(file){
    const sig=signals(file?.name||"");if(!file||!sig)return;
    const built=build(sig),st={file,...sig,examDate:examDateFromName(file.name),mappings:built.mappings};lastFile=file;lastState=st;
    render(st);syncReview(st);
    if(st.mappings.length)setMessage(`Mapped ${st.mappings.length} C-Batch class-subject-teacher combinations from the live Handling Classes master. PDF subject headings were unreadable, so these BIWT core subjects are marked for review before saving.`);
    else setMessage(`Identified ${st.examName} and ${st.level} = Class ${st.grade}, but the live Handling Classes data has not loaded yet. Tap Refresh once and retry.`,true)
  }

  function schedule(file){if(!file)return;setTimeout(()=>run(file),1500);setTimeout(()=>{if(lastFile===file&&(!lastState||!lastState.mappings.length))run(file)},2600)}
  function bind(){
    const input=q("#examAutoPdf");if(input&&input!==boundInput){boundInput=input;input.addEventListener("change",()=>schedule(input.files?.[0]));}
    const remap=q("#examAutoRemapBtn");if(remap&&!remap.dataset.v4Bound){remap.dataset.v4Bound="1";remap.addEventListener("click",()=>{const f=q("#examAutoPdf")?.files?.[0]||lastFile;if(f)setTimeout(()=>run(f),150)})}
  }
  function watch(){bind();new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});setInterval(bind,1200)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});else watch()
})();
