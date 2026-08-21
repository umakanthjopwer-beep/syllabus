// Ensures the upload-first Exam Syllabus auto mapper initializes after login.
// The auto-map module observes child-list changes; this creates one harmless marker after openApp.
(function(){
  const previous=globalThis.openApp;
  if(typeof previous!=="function")return;
  globalThis.openApp=function(){
    const out=previous.apply(this,arguments);
    setTimeout(()=>{
      try{const marker=document.createComment("exam-auto-init");document.body.appendChild(marker);marker.remove()}catch(_){}
    },0);
    return out
  };
})();
