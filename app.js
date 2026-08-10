(async()=>{
  const files=["legacy-data.js","app-base-secure.js","app-plans.js","app-tracking.js","app-admin.js","app-finalize.js","app-remote.js","app-smart-plans.js","app-pdf-plan-parser.js","app-plan-fixes.js","app-old-plan-migration.js","app-weekly-source-lock.js","app-teacher-scope.js","app-hod-viewonly.js","app-report-print.js","app-login-clean.js","app-public-url.js","app-session-report-fix.js","app-weekly-entry-control.js","app-weekly-edit-rules.js","app-report-filing-layout.js","app-report-top-punch.js"];
  for(const src of files){
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=src+"?v=27";
      s.onload=resolve;
      s.onerror=()=>reject(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }
  init();
})().catch(err=>{
  console.error(err);
  const target=document.getElementById("loginError");
  if(target){target.textContent="App failed to load. Please refresh once.";target.classList.remove("hidden")}
});