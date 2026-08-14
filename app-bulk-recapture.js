// One-click full-year source re-capture for Super Admin.
// Processes every enabled Year Plan once with the latest parser, so future-week gaps are repaired now.
(function(){
  function inject(){
    if(currentUser?.role!=="Super Admin")return;
    const actions=document.querySelector("#dataIntegrityAudit .panel-head .smart-actions");
    if(!actions||document.getElementById("bulkRecaptureAllBtn"))return;
    const b=document.createElement("button");
    b.id="bulkRecaptureAllBtn";b.type="button";b.textContent="Full Year Re-capture";
    b.title="Re-read every enabled Year Plan once and verify all future Monday-Saturday weeks";
    b.onclick=run;actions.prepend(b)
  }
  async function run(){
    const ids=[...new Set((data.plans||[]).filter(p=>p.enabled!==false).map(p=>p.id).filter(Boolean))];
    if(!ids.length){alert("No enabled Year Plans are available.");return}
    if(!confirm(`Full Year Re-capture will re-read all ${ids.length} enabled Year Plan file(s) with the latest parser.\n\nThis is designed to recover future syllabus weeks now, not only current-week issues. Existing Weekly Status records and Lagging Report status will not be changed.\n\nProceed?`))return;
    const oldConfirm=window.confirm,oldAlert=window.alert,box=document.createElement("div"),fail=[];
    box.style.cssText="position:fixed;left:16px;right:16px;bottom:72px;z-index:99999;background:#173f78;color:white;padding:14px;border-radius:12px;font-weight:700;box-shadow:0 8px 28px #0005";document.body.appendChild(box);
    try{
      window.confirm=()=>true;window.alert=()=>{};
      for(let i=0;i<ids.length;i++){
        const p=(data.plans||[]).find(x=>x.id===ids[i]);box.textContent=`Full Year Re-capture: ${i+1} of ${ids.length} · ${p?.fileName||"Year Plan"}`;
        try{await reprocessStoredPlan(ids[i])}catch(e){fail.push(p?.fileName||ids[i])}
      }
    }finally{window.confirm=oldConfirm;window.alert=oldAlert;box.remove()}
    try{await reloadRemote();renderAll()}catch(e){}
    alert(fail.length?`Full Year Re-capture finished. ${fail.length} file(s) still need source-specific review.`:`Full Year Re-capture completed for all ${ids.length} enabled Year Plan file(s). Future-week rows have been rechecked with the latest parser.`)
  }
  new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});setTimeout(inject,0)
})();