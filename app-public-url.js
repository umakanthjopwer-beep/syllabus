const PUBLIC_APP_URL="https://syllabuslagging.pages.dev";
appLink=function(){return PUBLIC_APP_URL};

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js?v=11",{updateViaCache:"none"}).catch(err=>console.warn("Service worker registration skipped",err));
}
