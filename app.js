(async()=>{
  const BUILD="112";
  const RECOVERY_KEY="syllabus_startup_recovery_v112";
  const files=["legacy-data.js","app-base-secure.js","app-plans.js","app-tracking.js","app-admin.js","app-finalize.js","app-remote.js","app-smart-plans.js","app-pdf-plan-parser.js","app-yearplan-recapture-v2.js","app-plan-fixes.js","app-old-plan-migration.js","app-weekly-source-lock.js","app-yearplan-integrity-fix.js","app-teacher-scope.js","app-hod-viewonly.js","app-report-print.js","app-login-clean.js","app-public-url.js","app-session-report-fix.js","app-weekly-entry-control.js","app-weekly-edit-rules.js","app-completed-week-request.js","app-report-filing-layout.js","app-report-top-punch.js","app-excel-export-style.js","app-report-readable-print.js","app-user-password-admin.js","app-auth-selfservice-v37.js","app-superadmin-impersonate.js","app-data-integrity-audit.js","app-week-calendar-v2.js","app-yearplan-week-engine.js","app-recapture-review.js","app-full-yearplan-data.js","app-bulk-recapture.js","app-autofill-hardening.js","app-my-yearplan.js","app-dashboard-actions.js","app-exam-syllabus-lagging.js","app-exam-auto-ui-v11.js","app-exam-column-parser-v13.js","app-exam-orientation-router-v14.js","app-exam-editable-meta-v21.js","app-exam-cbatch-cot-v22.js","app-exam-cot-syllabus-clean-v23.js","app-exam-compact-detect-v25.js","app-exam-multipage-router-v26.js","app-exam-subject-cards-v10.js","app-exam-exams-hub-v18.js","app-exam-entry-report-v20.js","app-exam-default-completion-date-v28.js","app-exam-syllabus-auto-init.js","app-exam-syllabus-navigation-fix.js","app-multibranch-ui.js","app-branch-onboarding.js","app-grade-section-display.js","app-report-orientation-filter.js","app-weekly-controller.js","app-objective-exams.js","app-objective-exam-entry.js","app-objective-exam-planning.js","app-print-pagination-fix.js","app-report-safe-controls-v34.js","app-report-a4-native-v35.js"];
  const optional=new Set(["app-branch-onboarding.js","app-grade-section-display.js","app-report-orientation-filter.js","app-objective-exams.js","app-objective-exam-entry.js","app-objective-exam-planning.js","app-auth-selfservice-v37.js","app-report-safe-controls-v34.js","app-report-a4-native-v35.js"]);
  const skipped=[];
  window.__SYLLABUS_BUILD__=BUILD;
  window.__SYLLABUS_LOAD_DIAGNOSTICS__={build:BUILD,loaded:[],skipped:[],failed:null};

  async function loadScript(src){
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      let done=false;
      const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);fn(value)};
      const timer=setTimeout(()=>finish(reject,new Error("Timed out loading "+src)),20000);
      s.src=src+"?v="+BUILD;
      s.async=false;
      s.onload=()=>{window.__SYLLABUS_LOAD_DIAGNOSTICS__.loaded.push(src);finish(resolve)};
      s.onerror=()=>finish(reject,new Error("Failed to load "+src));
      document.head.appendChild(s);
    })
  }

  for(const src of files){
    try{await loadScript(src)}
    catch(e){
      if(optional.has(src)){
        console.warn(e);skipped.push(src);window.__SYLLABUS_LOAD_DIAGNOSTICS__.skipped.push(src);continue
      }
      window.__SYLLABUS_LOAD_DIAGNOSTICS__.failed=src;
      throw e
    }
  }

  init();
  sessionStorage.removeItem(RECOVERY_KEY);
  if(skipped.length)console.warn("Optional app modules skipped:",skipped.join(", "));
})().catch(async err=>{
  console.error("Syllabus Tracker startup error",err);
  const RECOVERY_KEY="syllabus_startup_recovery_v112";
  const detail=String(err?.message||err||"Unknown startup error");
  const failed=window.__SYLLABUS_LOAD_DIAGNOSTICS__?.failed||"";
  if(!sessionStorage.getItem(RECOVERY_KEY)){
    sessionStorage.setItem(RECOVERY_KEY,"1");
    try{
      if("serviceWorker" in navigator&&navigator.serviceWorker.getRegistrations){
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.filter(r=>!r.scope||r.scope.startsWith(location.origin)).map(r=>r.unregister()))
      }
      if("caches" in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(k=>k.startsWith("khalsa-syllabus-")).map(k=>caches.delete(k)))
      }
    }catch(recoveryError){console.warn("Startup cache recovery",recoveryError)}
    location.reload();
    return
  }
  const target=document.getElementById("loginError");
  if(target){target.textContent=`App startup failed${failed?` at ${failed}`:""}: ${detail}. Please refresh once; if it repeats, share this exact message.`;target.classList.remove("hidden")}
});