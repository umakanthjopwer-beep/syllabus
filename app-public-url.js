const PUBLIC_APP_URL="https://syllabuslagging.pages.dev";
appLink=function(){return PUBLIC_APP_URL};

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js?v=41",{updateViaCache:"none"}).catch(err=>console.warn("Service worker registration skipped",err));
}

window.yearPlanRepairReady=(async()=>{
  for(const src of ["app-pdf-week-repair.js?v=38","app-week-source-verify.js?v=38"]){
    await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error("Failed to load "+src));document.head.appendChild(s)})
  }
  return true
})().catch(err=>{console.error("Year Plan repair engine",err);return false});

(function(){
  function inject(){
    if(typeof currentUser==="undefined"||currentUser?.role!=="Super Admin")return;
    const actions=document.querySelector("#dataIntegrityAudit .panel-head .smart-actions");
    if(!actions||document.getElementById("bulkRecaptureAllBtn"))return;
    const b=document.createElement("button");b.id="bulkRecaptureAllBtn";b.type="button";b.textContent="Re-capture All Issues";b.onclick=run;actions.prepend(b)
  }
  async function run(){
    const ready=await window.yearPlanRepairReady;if(!ready){alert("Year Plan repair engine could not load. Refresh once and try again.");return}
    const search=document.getElementById("auditSearch"),filter=document.getElementById("auditFilter");
    if(search){search.value="";search.dispatchEvent(new Event("input"))}
    if(filter){filter.value="issues";filter.dispatchEvent(new Event("change"))}
    await new Promise(r=>setTimeout(r,80));
    const ids=[...new Set([...document.querySelectorAll("#auditTable button")].map(b=>(b.getAttribute("onclick")||"").match(/reprocessStoredPlan\('([^']+)'\)/)?.[1]).filter(Boolean))];
    if(!ids.length){alert("No Year Plan capture issues need Re-capture.");return}
    if(!confirm(`Re-capture all ${ids.length} affected Year Plan file(s) now?\n\nEvery source date will be normalized into Monday-Saturday weeks. Split date rows in the same week will be merged with their syllabus. Existing non-blank Year Plan data is protected. Weekly Status and Lagging Report status will not be changed.`))return;
    const oldConfirm=window.confirm,oldAlert=window.alert,box=document.createElement("div");
    box.style.cssText="position:fixed;left:16px;right:16px;bottom:20px;z-index:99999;background:#173f78;color:#fff;padding:14px;border-radius:12px;font-weight:700;box-shadow:0 8px 28px #0005";document.body.appendChild(box);
    try{window.confirm=()=>true;window.alert=()=>{};for(let i=0;i<ids.length;i++){box.textContent=`Re-capturing Year Plans: ${i+1} of ${ids.length}…`;await reprocessStoredPlan(ids[i])}}
    finally{window.confirm=oldConfirm;window.alert=oldAlert;box.remove()}
    alert(`Bulk Re-capture completed for ${ids.length} affected Year Plan file(s). The audit has been refreshed; any remaining issue is now a source-specific row that needs review.`)
  }
  new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});setTimeout(inject,0)
})();
