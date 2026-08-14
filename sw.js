const CACHE="khalsa-syllabus-v25";
const CORE=[
  "./","./index.html","./styles.css","./app.js","./legacy-data.js","./app-base-secure.js","./app-plans.js","./app-tracking.js","./app-admin.js","./app-finalize.js","./app-remote.js","./app-smart-plans.js","./app-pdf-plan-parser.js","./app-yearplan-recapture-v2.js","./app-plan-fixes.js","./app-old-plan-migration.js","./app-weekly-source-lock.js","./app-yearplan-integrity-fix.js","./app-teacher-scope.js","./app-hod-viewonly.js","./app-report-print.js","./app-login-clean.js","./app-public-url.js","./app-session-report-fix.js","./app-weekly-entry-control.js","./app-weekly-edit-rules.js","./app-report-filing-layout.js","./app-report-top-punch.js","./app-excel-export-style.js","./app-report-readable-print.js","./app-user-password-admin.js","./app-superadmin-impersonate.js","./app-data-integrity-audit.js","./app-week-calendar-v2.js","./app-yearplan-week-engine.js","./app-recapture-review.js","./app-full-yearplan-data.js","./app-bulk-recapture.js","./app-autofill-hardening.js","./app-my-yearplan.js","./app-dashboard-actions.js","./manifest.webmanifest","./icon.svg"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html"))));
});