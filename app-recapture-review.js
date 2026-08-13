(function(){
  function statusText(status){
    const s=String(status||"").trim().toUpperCase();
    if(s.includes("PARTIAL CAPTURE"))return "Only part of the dated Year Plan was captured. Review the stored source and use Re-capture to restore only missing or incomplete capture data.";
    if(s.includes("COVERAGE ENDS EARLY"))return "Captured coverage ends early. Re-capture will check the stored source for later dated rows.";
    if(s.includes("BLANK ROW"))return "One or more captured rows have no topic. Re-capture can fill a blank only when usable content is available from the stored Year Plan source.";
    if(s.includes("CURRENT WEEK MISSING"))return "The current week is not represented by a captured dated row. Review the Year Plan source for the missing week.";
    if(s.includes("CURRENT SYLLABUS BLANK"))return "The current captured week exists but its syllabus topic is blank. Re-capture can fill it from the stored source when available.";
    if(s.includes("YEAR PLAN MISSING"))return "No Year Plan is linked to this active class-subject mapping. Upload or assign the correct source plan.";
    if(s.includes("NO WEEK DATA"))return "A Year Plan is linked, but no usable dated rows are available. Review or re-capture the stored source.";
    return "Review this capture warning before making a correction."
  }
  function makeIssueDetails(tr){
    const status=String(tr.cells[6].textContent||"").trim();
    const d=document.createElement("details");d.className="capture-issue-details";
    const s=document.createElement("summary");s.textContent="View Issue";
    const p=document.createElement("div");p.className="capture-issue-note";p.textContent=status+" — "+statusText(status)+" Existing non-blank Year Plan rows are preserved during source Re-capture.";
    d.appendChild(s);d.appendChild(p);return d
  }
  function makeAllDetails(panel){
    if(panel.querySelector("#captureReviewAll"))return;
    const rows=[...panel.querySelectorAll("#auditTable tr")].filter(function(tr){return tr.cells.length>=8});
    const issues=rows.filter(function(tr){const s=String(tr.cells[6].textContent||"").trim();return s&&s!=="OK"&&s!=="NO SEPARATE YEAR PLAN"});
    const d=document.createElement("details");d.id="captureReviewAll";d.className="capture-review-all";
    const s=document.createElement("summary");s.textContent="Smart Check All Capture Issues ("+issues.length+")";
    const box=document.createElement("div");box.className="capture-review-list";
    if(!issues.length){box.textContent="No capture issues are currently listed."}
    else issues.slice(0,40).forEach(function(tr){const item=document.createElement("div");const section=String(tr.cells[0].textContent||"").trim(),subject=String(tr.cells[1].textContent||"").trim(),status=String(tr.cells[6].textContent||"").trim();item.textContent=section+" · "+subject+" · "+status+" — "+statusText(status);box.appendChild(item)});
    d.appendChild(s);d.appendChild(box);
    const head=panel.querySelector(".panel-head .smart-actions")||panel.querySelector(".panel-head");if(head)head.prepend(d)
  }
  function enhance(){
    const panel=document.getElementById("dataIntegrityAudit");if(!panel)return;
    panel.querySelectorAll("#auditTable tr").forEach(function(tr){
      if(tr.dataset.reviewReady==="1"||tr.cells.length<8)return;tr.dataset.reviewReady="1";
      const status=String(tr.cells[6].textContent||"").trim();if(status==="OK"||status==="NO SEPARATE YEAR PLAN")return;
      tr.cells[7].appendChild(makeIssueDetails(tr));
    });
    makeAllDetails(panel)
  }
  const style=document.createElement("style");style.textContent=".capture-issue-details{margin-top:5px;font-size:9px}.capture-issue-details summary,.capture-review-all summary{cursor:pointer;color:#28568f;font-weight:800}.capture-issue-note{max-width:360px;padding:8px;margin-top:5px;border:1px solid #ead79e;background:#fff8e8;border-radius:8px;line-height:1.45}.capture-review-all{font-size:9px}.capture-review-list{position:absolute;right:20px;z-index:20;width:min(620px,80vw);max-height:330px;overflow:auto;padding:10px;background:#fff;border:1px solid #dce5ef;border-radius:10px;box-shadow:0 10px 30px #0002}.capture-review-list div{padding:7px;border-bottom:1px solid #eef2f6}.capture-review-list div:last-child{border-bottom:0}";document.head.appendChild(style);
  const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(enhance,0);
})();
