// C-Batch COT bridge v22: routes C1-C5 COT PDFs through the proven C-Batch column parser.
(function(){
  const q=s=>document.querySelector(s);
  const nativeFetch=window.fetch.bind(window);
  let active=null;

  function txt(v){return String(v??"").trim()}
  function minusDays(iso,days=3){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||"")))return"";
    const [y,m,d]=iso.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));
    dt.setUTCDate(dt.getUTCDate()-days);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`
  }
  function detect(name){
    const s=txt(name).replace(/\.[^.]+$/," ");
    const level=s.match(/\bC\s*([1-5])(?:[AB])?\b/i);
    const cot=s.match(/\bCOT\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i)||s.match(/\bCUMULATIVE\s+OBJECTIVE\s+TEST\s*(?:NO\.?\s*)?[-–:]?\s*(\d{1,2})\b/i);
    if(!level||!cot||/\bTECHNO\b/i.test(s))return null;
    const n=Number(level[1]),test=Number(cot[1]);
    return{level:n,grade:11-n,test,examName:`C Batch COT ${test}`}
  }
  function fakeBiwtName(file,sig){
    const dm=file.name.match(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/)?.[0]||"";
    return `AP & TG CBSE C-BATCH C${sig.level} BIWT ${sig.test} SYLLABUS${dm?` (${dm})`:""}.pdf`
  }
  function fixUi(sig){
    if(!active||active.sig.examName!==sig.examName)return;
    const name=q("#examAutoName"),orient=q("#examAutoOrientation"),date=q("#examAutoDate"),deadline=q("#examAutoDeadline");
    if(name&&(!name.value||/C\s*Batch\s*BIWT/i.test(name.value)))name.value=sig.examName;
    if(orient)orient.value="C Batch";
    if(date&&deadline){const auto=minusDays(date.value,3);if(auto&&(!deadline.value||deadline.value===date.value))deadline.value=auto}
    const chips=[...document.querySelectorAll("#examAutoSummary .exam-auto-chip")];
    for(const c of chips){const label=txt(c.querySelector("small")?.textContent).toLowerCase(),strong=c.querySelector("strong");if(!strong)continue;if(label==="exam"&&/BIWT/i.test(strong.textContent))strong.textContent=sig.examName;if(label==="orientation")strong.textContent="C Batch"}
  }
  function scheduleFix(sig){[80,220,500,900,1500,2400].forEach(ms=>setTimeout(()=>fixUi(sig),ms))}

  document.addEventListener("change",e=>{
    const input=e.target;if(input?.id!=="examAutoPdf")return;
    const original=input.files?.[0],sig=detect(original?.name||"");if(!original||!sig)return;
    const handler=input.onchange;if(typeof handler!=="function")return;
    e.stopImmediatePropagation();
    const originalName=original.name,originalList=input.files;
    active={sig,originalName};
    const fake=new File([original],fakeBiwtName(original,sig),{type:original.type||"application/pdf",lastModified:original.lastModified});
    const dt=new DataTransfer();dt.items.add(fake);input.files=dt.files;
    try{handler.call(input,{target:input,currentTarget:input,type:"change"})}finally{
      try{Object.defineProperty(fake,"name",{value:originalName,configurable:true})}catch(_){}
      try{input.files=originalList}catch(_){const back=new DataTransfer();back.items.add(original);input.files=back.files}
    }
    scheduleFix(sig)
  },true);

  window.fetch=async function(input,init){
    try{
      const url=typeof input==="string"?input:(input?.url||"");
      if(active&&url.includes("/functions/v1/exam-syllabus-api")&&init?.method?.toUpperCase()==="POST"&&typeof init.body==="string"){
        const body=JSON.parse(init.body);
        if(body?.action==="document_batch_save"||body?.action==="document_save"){
          body.exam_name=(q("#examAutoName")?.value||active.sig.examName).trim()||active.sig.examName;
          body.file_name=active.originalName;
          const d=q("#examAutoDate")?.value||body.exam_date||null;
          body.exam_date=d;
          body.completion_deadline=q("#examAutoDeadline")?.value||minusDays(d,3)||body.completion_deadline||null;
          init={...init,body:JSON.stringify(body)}
        }
      }
    }catch(err){console.warn("C-Batch COT metadata rewrite skipped",err)}
    return nativeFetch(input,init)
  }
})();