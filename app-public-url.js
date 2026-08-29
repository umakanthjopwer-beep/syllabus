const PUBLIC_APP_URL="https://syllabuslagging.pages.dev";
appLink=function(){return PUBLIC_APP_URL};

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js?v=82",{updateViaCache:"none"}).catch(err=>console.warn("Service worker registration skipped",err));
}

// Session persistence hardening.
// A stale 401 response must never delete a newer valid login token, and temporary network/startup errors must not log a user out.
(function(){
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const authMessage=/session\s*(has\s*)?expired|invalid\s*(session|token)|unauthori[sz]ed|please\s+sign\s+in\s+again/i;

  remoteCall=async function(action,payload={},needsAuth=true){
    const headers={"Content-Type":"application/json"};
    const requestToken=needsAuth?remoteToken():"";
    if(needsAuth){
      if(!requestToken){const e=new Error("Please sign in again.");e.status=401;e.authExpired=true;throw e}
      headers.Authorization=`Bearer ${requestToken}`;
    }
    let r;
    try{r=await fetch(REMOTE_API,{method:"POST",headers,body:JSON.stringify({action,...payload})})}
    catch(networkError){const e=new Error("Unable to connect. Please check the internet connection and try again.");e.networkError=true;e.cause=networkError;throw e}
    let out={};try{out=await r.json()}catch(_){}
    if(!r.ok){
      const e=new Error(out.error||`Request failed (${r.status})`);e.status=r.status;
      e.authExpired=needsAuth&&r.status===401&&authMessage.test(String(out.error||"Session expired"));
      // Only remove the exact token used by this failed request. Old requests cannot wipe a newly-created session.
      if(e.authExpired&&remoteToken()===requestToken)localStorage.removeItem(REMOTE_TOKEN_KEY);
      throw e;
    }
    return out;
  };

  async function bootstrapWithRetry(attempts=3){
    let last;
    for(let i=0;i<attempts;i++){
      try{return await reloadRemote()}
      catch(e){last=e;if(e?.authExpired||!remoteToken())throw e;if(i<attempts-1)await delay(350*(i+1))}
    }
    throw last;
  }

  restoreSession=async function(){
    if(!remoteToken())return;
    try{await bootstrapWithRetry(3);openApp()}
    catch(e){
      currentUser=null;
      if(e?.authExpired||!remoteToken()){
        localStorage.removeItem(REMOTE_TOKEN_KEY);
        try{showLoginError("Your session has expired. Please sign in again.")}catch(_){}
      }else{
        // Preserve the valid login on temporary internet/server errors.
        try{showLoginError("Could not reconnect to the server. Your login is still saved; refresh once when the connection is stable.")}catch(_){}
      }
    }
  };

  login=async function(){
    const username=norm($("#loginUsername").value),password=$("#loginPassword").value,btn=$("#loginBtn");
    if(!username||!password){showLoginError("Enter both username and password.");return}
    setBusy(btn,true,"Signing in…");
    try{
      const r=await remoteCall("login",{username,password},false);
      if(!r?.token)throw new Error("Login succeeded but no session token was returned.");
      localStorage.setItem(REMOTE_TOKEN_KEY,r.token);
      await bootstrapWithRetry(3);
      $("#loginPassword").value="";
      try{$("#loginError")?.classList.add("hidden")}catch(_){}
      openApp();
    }catch(e){
      if(e?.authExpired)localStorage.removeItem(REMOTE_TOKEN_KEY);
      showLoginError(e.message||"Unable to sign in.");
    }finally{setBusy(btn,false)}
  };

  window.__SESSION_PERSISTENCE_V29__=true;
})();

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