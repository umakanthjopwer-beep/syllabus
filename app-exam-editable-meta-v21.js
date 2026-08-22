// Exam metadata editor: edited exam name is authoritative; deadline defaults to 3 days before exam date.
(function(){
  const q=s=>document.querySelector(s);
  const nativeFetch=window.fetch.bind(window);
  let lastDate="",autoDeadline="";
  function minusDays(iso,days=3){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||"")))return"";
    const [y,m,d]=iso.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));
    dt.setUTCDate(dt.getUTCDate()-days);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`
  }
  function labelDeadline(){
    const x=q("#examAutoDeadline");if(!x)return;
    const l=x.closest("label");if(l&&!l.dataset.deadlineLabel){
      l.dataset.deadlineLabel="1";
      const t=[...l.childNodes].find(n=>n.nodeType===3&&n.nodeValue.trim());if(t)t.nodeValue="Syllabus Completion Deadline ";
      const s=document.createElement("small");s.textContent="Auto: 3 days before exam · editable";s.style.cssText="display:block;color:#6f7f91;font-weight:500;margin:2px 0 4px";l.insertBefore(s,x)
    }
  }
  function syncDeadline(){
    labelDeadline();
    const date=q("#examAutoDate"),deadline=q("#examAutoDeadline");if(!date||!deadline)return;
    const v=date.value||"";
    if(v&&v!==lastDate){lastDate=v;autoDeadline=minusDays(v,3);deadline.value=autoDeadline;deadline.dataset.autoValue=autoDeadline}
  }
  document.addEventListener("change",e=>{
    if(e.target?.id==="examAutoDate"){
      const d=q("#examAutoDeadline"),v=minusDays(e.target.value,3);lastDate=e.target.value||"";autoDeadline=v;if(d){d.value=v;d.dataset.autoValue=v}
    }
  },true);
  window.fetch=async function(input,init){
    try{
      const url=typeof input==="string"?input:(input?.url||"");
      if(url.includes("/functions/v1/exam-syllabus-api")&&init?.method?.toUpperCase()==="POST"&&typeof init.body==="string"){
        const body=JSON.parse(init.body);
        if(body?.action==="document_batch_save"||body?.action==="document_save"){
          const name=(q("#examAutoName")?.value||"").trim(),date=q("#examAutoDate")?.value||body.exam_date||null;
          const deadline=q("#examAutoDeadline")?.value||minusDays(date,3)||body.completion_deadline||null;
          if(name)body.exam_name=name;
          body.exam_date=date;
          body.completion_deadline=deadline;
          init={...init,body:JSON.stringify(body)}
        }
      }
    }catch(e){console.warn("Exam metadata rewrite skipped",e)}
    return nativeFetch(input,init)
  };
  new MutationObserver(syncDeadline).observe(document.body,{childList:true,subtree:true});
  setInterval(syncDeadline,300);syncDeadline();
})();
