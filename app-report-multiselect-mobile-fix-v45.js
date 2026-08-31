// Weekly Reports v45: mobile-safe multi-select dropdown behavior.
(function(){
  const SELECTOR="details.report-v43-multi";
  let installed=false;

  function ensureStyles(){
    if(document.getElementById("reportMultiMobileFixStylesV45"))return;
    const s=document.createElement("style");
    s.id="reportMultiMobileFixStylesV45";
    s.textContent=`
      .report-v43-multi[open]>summary{border-color:#2f6fb6;box-shadow:0 0 0 2px rgba(47,111,182,.08)}
      .report-v43-options .report-v43-option:first-child{position:sticky;top:0;z-index:3;background:#fff;border-bottom:1px solid #edf1f6}
      .report-v45-done{position:sticky;bottom:0;width:100%;margin-top:6px;border:0;border-radius:9px;padding:10px 12px;background:#245ea8;color:#fff;font-weight:800;font-size:12px;cursor:pointer;z-index:4}
      @media(max-width:760px){
        .report-v43-multi{width:100%}
        .report-v43-multi>.report-v43-options{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-height:46vh!important;margin-top:6px!important;overflow:auto!important;box-shadow:0 5px 14px rgba(35,50,75,.08)!important;border-radius:10px!important}
        .report-v43-multi[open]{border-radius:12px;background:#f8fbff;padding:4px}
        .report-v43-multi[open]>summary{background:#fff}
        .report-v43-option{min-height:44px}
      }
    `;
    document.head.appendChild(s)
  }

  function closeOthers(active){
    document.querySelectorAll(SELECTOR+"[open]").forEach(d=>{if(d!==active)d.open=false})
  }
  function openCount(){return document.querySelectorAll(SELECTOR+"[open]").length}
  function updateBodyState(){document.body?.classList.toggle("report-v45-menu-open",openCount()>0)}

  function installDetail(d){
    if(!(d instanceof HTMLDetailsElement)||d.dataset.v45Installed)return;
    d.dataset.v45Installed="1";
    d.addEventListener("toggle",()=>{
      if(d.open)closeOthers(d);
      updateBodyState()
    });
  }

  function addDone(d){
    const box=d.querySelector(":scope > .report-v43-options");
    if(!box||box.querySelector(":scope > .report-v45-done"))return;
    const b=document.createElement("button");
    b.type="button";b.className="report-v45-done";b.textContent="Done";
    b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();d.open=false});
    box.appendChild(b)
  }

  function installAll(){
    ensureStyles();
    document.querySelectorAll(SELECTOR).forEach(d=>{installDetail(d);addDone(d)})
  }

  function outsideClose(e){
    const opens=[...document.querySelectorAll(SELECTOR+"[open]")];
    if(!opens.length)return;
    if(opens.some(d=>d.contains(e.target)))return;
    opens.forEach(d=>d.open=false)
  }

  function install(){
    if(installed)return;installed=true;
    installAll();
    document.addEventListener("pointerdown",outsideClose,true);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(SELECTOR+"[open]").forEach(d=>d.open=false)},true);
    if(typeof renderReports==="function"){
      const previous=renderReports;
      renderReports=function(){const out=previous.apply(this,arguments);setTimeout(installAll,0);return out}
    }
    const observer=new MutationObserver(()=>{
      if(document.querySelector(SELECTOR+":not([data-v45-installed])")||document.querySelector(SELECTOR+" .report-v43-options:not(:has(.report-v45-done))"))setTimeout(installAll,0)
    });
    try{observer.observe(document.getElementById("reports")||document.body,{childList:true,subtree:true})}catch(_){}
    window.__REPORT_MULTI_MOBILE_FIX_V45__=true
  }
  setTimeout(install,0)
})();
