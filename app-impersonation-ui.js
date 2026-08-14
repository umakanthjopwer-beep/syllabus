// Persistent UI controls for an already-active Super Admin staff view.
(function(){
  const HEIGHT=52;
  function active(){try{return typeof impersonationActive==="function"&&impersonationActive()}catch(e){return false}}
  function applyOffset(on){
    const px=on?`${HEIGHT}px`:"";
    const shell=document.getElementById("appShell");if(shell)shell.style.marginTop=px;
    document.querySelectorAll(".topbar,.mobile-header").forEach(el=>el.style.top=px);
    const side=document.querySelector(".sidebar");if(side){side.style.top=px;side.style.height=on?`calc(100vh - ${HEIGHT}px)`:""}
  }
  function ensure(){
    let bar=document.getElementById("superAdminStaffViewBar");if(bar)return bar;
    bar=document.createElement("div");bar.id="superAdminStaffViewBar";
    bar.style.cssText=`display:none;position:fixed;top:0;left:0;right:0;z-index:6000;min-height:${HEIGHT}px;background:#fff3cd;border-bottom:1px solid #e2c96e;padding:7px 10px;align-items:center;gap:8px;box-shadow:0 3px 10px rgba(0,0,0,.08);color:#654f0b`;
    bar.innerHTML=`<span id="superAdminStaffViewText" style="flex:1;min-width:0;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span><div style="display:flex;gap:6px;flex-shrink:0"><button id="superAdminReturnVisible" type="button" style="border:1px solid #9a7b19;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:900;color:#654f0b">Return to Super Admin</button><button id="superAdminLogoutVisible" type="button" style="border:1px solid #654f0b;background:#654f0b;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:900;color:#fff">Logout</button></div>`;
    document.body.appendChild(bar);
    document.getElementById("superAdminReturnVisible").onclick=()=>{if(typeof returnToSuperAdmin==="function")returnToSuperAdmin()};
    document.getElementById("superAdminLogoutVisible").onclick=()=>{if(confirm("Logout from the app?"))logout()};
    return bar
  }
  function refresh(){
    const bar=ensure(),on=active(),old=document.getElementById("impersonationBar");if(old&&on)old.style.display="none";
    bar.style.display=on?"flex":"none";applyOffset(on);
    if(on){const t=document.getElementById("superAdminStaffViewText");if(t)t.innerHTML=`SUPER ADMIN VIEW · <strong>${esc(currentUser?.name||"")}</strong> (${esc(currentUser?.role||"")})`}
  }
  const oldOpen=openApp;openApp=function(){const r=oldOpen();setTimeout(refresh,0);return r};
  const oldShow=showView;showView=function(id){const r=oldShow(id);setTimeout(refresh,0);return r};
  const oldRender=renderAll;renderAll=function(){const r=oldRender();setTimeout(refresh,0);return r};
  const oldInit=init;init=function(){ensure();oldInit();refresh()};
  window.addEventListener("resize",refresh);
  window.refreshSuperAdminStaffViewBar=refresh;
})();
