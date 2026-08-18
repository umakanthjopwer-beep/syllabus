// Backward-compatibility shim.
// Historical cached app versions may still request this filename.
// Weekly Status logic now lives in app-weekly-controller.js.
(function(){
  window.__SYLLABUS_COMPAT_SHIMS__=window.__SYLLABUS_COMPAT_SHIMS__||{};
  window.__SYLLABUS_COMPAT_SHIMS__["app-teacher-weekly-repair.js"]=true;
})();
