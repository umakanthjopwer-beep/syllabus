const CACHE="khalsa-syllabus-v87";
const CORE=[
  "./","./index.html","./branch-setup.html","./styles.css","./app.js","./legacy-data.js","./app-base-secure.js","./app-plans.js","./app-tracking.js","./app-admin.js","./app-finalize.js","./app-remote.js","./app-smart-plans.js","./app-pdf-plan-parser.js","./app-yearplan-recapture-v2.js","./app-plan-fixes.js","./app-old-plan-migration.js","./app-weekly-source-lock.js","./app-yearplan-integrity-fix.js","./app-teacher-scope.js","./app-hod-viewonly.js","./app-report-print.js","./app-login-clean.js","./app-public-url.js","./app-session-report-fix.js","./app-weekly-entry-control.js","./app-weekly-edit-rules.js","./app-completed-week-request.js","./app-report-filing-layout.js","./app-report-top-punch.js","./app-excel-export-style.js","./app-user-password-admin.js","./app-superadmin-impersonate.js","./app-data-integrity-audit.js","./app-week-calendar-v2.js","./app-yearplan-week-engine.js","./app-recapture-review.js","./app-full-yearplan-data.js","./app-bulk-recapture.js","./app-autofill-hardening.js","./app-my-yearplan.js","./app-dashboard-actions.js","./app-exam-syllabus-lagging.js","./app-exam-auto-ui-v11.js","./app-exam-column-parser-v13.js","./app-exam-orientation-router-v14.js","./app-exam-editable-meta-v21.js","./app-exam-cbatch-cot-v22.js","./app-exam-cot-syllabus-clean-v23.js","./app-exam-compact-detect-v25.js","./app-exam-multipage-router-v26.js","./app-exam-subject-cards-v10.js","./app-exam-exams-hub-v18.js","./app-exam-entry-report-v20.js","./app-exam-default-completion-date-v28.js","./app-exam-syllabus-auto-init.js","./app-exam-syllabus-navigation-fix.js","./app-multibranch-ui.js","./app-branch-onboarding.js","./app-grade-section-display.js","./app-report-orientation-filter.js","./app-weekly-controller.js","./app-objective-exams.js","./app-objective-exam-entry.js","./app-objective-exam-planning.js","./app-teacher-weekly-repair.js","./app-weekly-entry-stability.js","./app-report-safe-controls-v34.js","./app-report-print-final-v42.js","./app-auth-session-password-v38.js","./manifest.webmanifest","./icon.svg"
];
self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(CORE.map(async url=>{try{const response=await fetch(url,{cache:"reload"});if(response.ok)await cache.put(url,response)}catch(e){console.warn("Precache skipped",url,e)}}));
  await self.skipWaiting()
})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith("khalsa-syllabus-")).map(k=>caches.delete(k)));await self.clients.claim()
})()));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith((async()=>{
    try{const response=await fetch(event.request);if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}return response}
    catch(e){const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==="navigate"){const shell=await caches.match("./index.html");if(shell)return shell}return Response.error()}
  })())
});