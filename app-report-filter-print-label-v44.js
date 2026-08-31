// Weekly Reports v44: carry multi-select labels into PDF/print metadata.
(function(){
  function sync(){
    const meta=window.__REPORT_FILTER_META_V43__;if(!meta)return;
    const subject=document.getElementById("printReportSubject");
    if(subject){
      let op=[...subject.options].find(o=>o.value===meta.subject);
      if(!op){op=document.createElement("option");op.value=meta.subject;op.textContent=meta.subject;op.dataset.v44="1";subject.appendChild(op)}
      subject.value=meta.subject
    }
    let helper=document.getElementById("reportV30OrientationText");
    if(!helper){helper=document.createElement("span");helper.id="reportV30OrientationText";helper.hidden=true;(document.getElementById("reports")||document.body).appendChild(helper)}
    const extra=[];
    if(meta.classes&&meta.classes!=="All classes")extra.push(`Class/Sec: ${meta.classes}`);
    if(meta.status&&meta.status!=="All statuses")extra.push(`Status: ${meta.status}`);
    helper.textContent=[meta.orientation||"All orientations",...extra].join(" | ")
  }
  if(typeof renderReports==="function"){
    const previous=renderReports;
    renderReports=function(){const out=previous.apply(this,arguments);queueMicrotask(sync);return out}
  }
  setTimeout(sync,0);
  window.__REPORT_FILTER_PRINT_LABEL_V44__=true
})();