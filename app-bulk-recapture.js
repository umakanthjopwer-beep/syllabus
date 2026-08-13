// Runs the existing safe Re-capture action for all currently reported capture issues.
(function(){
  function inject(){
    if(currentUser?.role!=="Super Admin")return;
    const actions=document.querySelector("#dataIntegrityAudit .panel-head .smart-actions");
    if(!actions||document.getElementById("bulkRecaptureAllBtn"))return;
    const b=document.createElement("button");
    b.id="bulkRecaptureAllBtn";b.type="button";b.textContent="Re-capture All Issues";
    b.onclick=run;actions.prepend(b)
  }
  async function run(){
    const search=document.getElementById("auditSearch"),filter=document.getElementById("auditFilter");
    if(search){search.value="";search.dispatchEvent(new Event("input"))}
    if(filter){filter.value="issues";filter.dispatchEvent(new Event("change"))}
    await new Promise(r=>setTimeout(r,50));
    const ids=[...new Set([...document.querySelectorAll("#auditTable button")].map(b=>(b.getAttribute("onclick")||"").match(/reprocessStoredPlan\('([^']+)'\)/)?.[1]).filter(Boolean))];
    if(!ids.length){alert("No Year Plan capture issues need Re-capture.");return}
    if(!confirm(`Re-capture all ${ids.length} affected Year Plan file(s) now?\n\nEach file will be processed once. Existing non-blank Year Plan data is protected. Weekly Status and Lagging Report status will not be changed.`))return;
    const oldConfirm=window.confirm,oldAlert=window.alert,box=document.createElement("div");
    box.style.cssText="position:fixed;left:16px;right:16px;bottom:20px;z-index:99999;background:#173f78;color:white;padding:14px;border-radius:12px;font-weight:700;box-shadow:0 8px 28px #0005";document.body.appendChild(box);
    try{
      window.confirm=()=>true;window.alert=()=>{};
      for(let i=0;i<ids.length;i++){box.textContent=`Re-capturing Year Plans: ${i+1} of ${ids.length}…`;await reprocessStoredPlan(ids[i])}
    }finally{window.confirm=oldConfirm;window.alert=oldAlert;box.remove()}
    alert(`Bulk Re-capture completed for ${ids.length} affected Year Plan file(s). Please review the refreshed audit for any remaining source-specific issues.`)
  }
  new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});setTimeout(inject,0)
})();