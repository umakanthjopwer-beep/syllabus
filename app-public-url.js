const PUBLIC_APP_URL="https://syllabuslagging.umakanth-jopwer.workers.dev";
appLink=function(){return PUBLIC_APP_URL};

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js?v=10",{updateViaCache:"none"}).catch(err=>console.warn("Service worker registration skipped",err));
}
