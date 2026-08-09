(async()=>{
  const files=["legacy-data.js","app-base-secure.js","app-plans.js","app-tracking.js","app-admin.js","app-finalize.js","app-security.js"];
  for(const src of files){
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=src+"?v=7";
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
