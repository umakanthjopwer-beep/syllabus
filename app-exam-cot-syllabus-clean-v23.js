// C-Batch COT syllabus cleaner v23: removes exam-pattern/footer text from detected syllabus and preserves only actual topics.
(function(){
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const nativeFetch=window.fetch.bind(window);
  let active=null,lastKey="";
  function txt(v){return String(v??"").replace(/\s+/g," ").trim()}
  function isCot(name){return /\bC\s*[1-5](?:[AB])?\b/i.test(name||"")&&/\b(?:COT|CUMULATIVE\s+OBJECTIVE\s+TEST)\b/i.test(name||"")&&!/\bTECHNO\b/i.test(name||"")}
  function score(s){return (s.match(/[A-Za-z]{3,}/g)||[]).join("").length}
  function bestNumbered(s){
    const ms=[...s.matchAll(/(?:^|\s)(\d+\))/g)];if(ms.length<2)return s;
    const starts=ms.map(m=>m.index+(m[0].startsWith(" ")?1:0)),parts=[];
    for(let i=0;i<starts.length;i++)parts.push(s.slice(starts[i],starts[i+1]??s.length).trim());
    return parts.sort((a,b)=>score(b)-score(a))[0]||s
  }
  function cleanTopic(v){
    let s=txt(v).replace(/^•\s*/,"");if(!s)return"";
    if(/\b(?:NOTE|ALL QUESTIONS|OBJECTIVE TYPE|MAX\.?\s*MARKS|TIME\s*:|CONDUCT EXAM|OMR\s*SHEET|TECHNO\/INTEGRATED)\b/i.test(s))return"";
    if(/\b(?:MATH|PHYSICS|CHEMISTRY)\s*:\s*\d+\s*Q\b/i.test(s)||/\b\d+\s*Q\b/i.test(s))return"";
    s=bestNumbered(s);
    s=s.replace(/\bP\s+[Il1]\b(?=\s*\()/gi,"")
       .replace(/\s*:\s*[A-Za-z]\s*$/i,"")
       .replace(/\s+[A-Za-z]\s+[A-Za-z]\s*$/i,"")
       .replace(/\s+(?:Ph|Ch|Pi|Pl|Il)\s*$/i,"")
       .replace(/\s*[:;,]\s*$/g,"")
       .replace(/\s+/g," ").trim();
    if(!s||/^SRP\s*:?$/i.test(s)||/^\(?\s*Aim\s*:/i.test(s)||score(s)<4)return"";
    return s
  }
  function cleanList(list){const out=[];for(const x of list||[]){const s=cleanTopic(x);if(s&&!out.some(y=>y.toLowerCase()===s.toLowerCase()))out.push(s)}return out}
  async function pdfText(file){
    try{
      let lib=globalThis.pdfjsLib;
      if(!lib){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});lib=globalThis.pdfjsLib;lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"}
      const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,parts=[];
      for(let p=1;p<=pdf.numPages;p++){const tc=await (await pdf.getPage(p)).getTextContent();parts.push((tc.items||[]).map(x=>x.str||"").join(" "))}
      return txt(parts.join(" "))
    }catch(_){return""}
  }
  function verifiedOverrides(raw,name){
    const m=new Map();
    if(!/CUMULATIVE\s+OBJECTIVE\s+TEST/i.test(raw))return m;
    const aim=raw.match(/\b([A-Za-z][A-Za-z ]{2,45}?)\s*\(\s*Aim\s*:\s*(\d+)\s*to\s*(\d+)\s*\)/i);
    if(aim){let chapter=txt(aim[1]).replace(/^(?:CLASS|MATHEMATICS|TRACK\s*-?\s*A)\s+/i,"").trim();const bits=chapter.split(/\s+/);if(bits.length>6)chapter=bits.slice(-6).join(" ");if(score(chapter)>=4)m.set("Track A",[`${chapter} (Aim: ${aim[2]} to ${aim[3]})`])}
    if(/\bC4\b/i.test(raw)&&/03[.\/-]09[.\/-]26/.test(raw)){
      if(/Polynomials/i.test(raw)&&/Aim\s*:\s*3\s*to\s*6/i.test(raw))m.set("Track A",["Polynomials (Aim: 3 to 6)"]);
      if(/Arithmetic\s+Expressions/i.test(raw)&&/A\s+Peek\s+Beyond\s+the\s+Point/i.test(raw))m.set("Track B",["1) Arithmetic Expressions","2) A Peek Beyond the Point"]);
      if(/Basic\s+Mechanics/i.test(raw)&&/Electricity/i.test(raw)&&/Units\s+and\s+Conversions/i.test(raw))m.set("Physics",["1) Basic Mechanics","2) Electricity","3) Units and Conversions"]);
      if(/Changes\s+around\s+us/i.test(raw)&&/Physical\s+and\s+Chemical/i.test(raw)&&/Concepts\s+of\s+SRP/i.test(raw)&&/Goal\s+1\s+to\s+4/i.test(raw))m.set("Chemistry",["1) Changes around us - Physical and Chemical","2) Concepts of SRP - Goal 1 to 4"])
    }
    return m
  }
  function subjectNameById(id){try{return canonicalSubject(REMOTE?.subjectById?.get(id)?.name||"")||""}catch(_){return""}}
  function renderTopics(cell,topics){cell.innerHTML="";const strong=document.createElement("strong");strong.textContent=`${topics.length} topic(s)`;const d=document.createElement("details"),sum=document.createElement("summary"),box=document.createElement("div");sum.textContent="View syllabus";sum.style.cssText="cursor:pointer;color:#345f91";box.style.cssText="max-width:330px;white-space:normal;margin-top:5px";topics.forEach((t,i)=>{if(i)box.appendChild(document.createElement("br"));box.appendChild(document.createTextNode("• "+t))});d.append(sum,box);cell.append(strong,d)}
  function patchDisplay(){
    if(!active)return;active.overridePromise.then(overrides=>{
      let invalid=false;
      qa("#examAutoMappings tbody tr").forEach(tr=>{
        const tds=tr.querySelectorAll("td");if(tds.length<5)return;const sub=txt(tds[2].textContent),cell=tds[4],details=cell.querySelector("details");
        let topics=overrides.get(sub)||[];
        if(!topics.length&&details){const div=details.querySelector("div");if(div)topics=cleanList([...div.childNodes].map(n=>n.textContent).filter(Boolean))}
        if(topics.length)renderTopics(cell,topics);else{invalid=true;cell.innerHTML='<span style="color:#a43c36;font-weight:700">No clean syllabus topic detected — review/re-upload required</span>'}
      });
      const btn=q("#examAutoSave");if(btn&&invalid)btn.disabled=true;
      const msg=q("#examAutoMsg");if(msg&&/C Batch COT/i.test(q("#examAutoName")?.value||"")){msg.textContent=invalid?"C-Batch COT detected, but at least one subject has no clean syllabus topic. Save is disabled until the PDF is read correctly.":"C-Batch COT syllabus cleaned: NOTE, question-count, marks and OMR instructions are excluded. Review View syllabus before save.";msg.classList.toggle("exam-auto-bad",invalid);msg.classList.toggle("exam-auto-good",!invalid)}
    })
  }
  function watchFile(){const input=q("#examAutoPdf"),f=input?.files?.[0];if(!f||!isCot(f.name))return;const key=[f.name,f.size,f.lastModified].join("|");if(key!==lastKey){lastKey=key;active={file:f,name:f.name,overridePromise:pdfText(f).then(raw=>verifiedOverrides(raw,f.name))};[250,600,1200,2200,3500].forEach(ms=>setTimeout(patchDisplay,ms))}else patchDisplay()}
  window.fetch=async function(input,init){
    try{
      const url=typeof input==="string"?input:(input?.url||"");
      if(active&&url.includes("/functions/v1/exam-syllabus-api")&&init?.method?.toUpperCase()==="POST"&&typeof init.body==="string"){
        const body=JSON.parse(init.body);
        if((body?.action==="document_batch_save"||body?.action==="document_save")&&Array.isArray(body.mappings)){
          const overrides=await active.overridePromise;
          body.mappings=body.mappings.map(m=>{const sub=subjectNameById(m.subject_id),topics=overrides.get(sub)||cleanList(m.topics||[]);return{...m,topics}});
          init={...init,body:JSON.stringify(body)}
        }
      }
    }catch(e){console.warn("COT syllabus cleaner skipped",e)}
    return nativeFetch(input,init)
  };
  new MutationObserver(watchFile).observe(document.body,{childList:true,subtree:true});setInterval(watchFile,500);watchFile()
})();
