// Weekly Reports v34: safe page-layout controls. Never block app startup.
(function(){
  const q=s=>document.querySelector(s);
  let applying=false;

  function ensure(){
    try{
      const filter=q("#reports .print-report-filter");
      if(!filter)return false;
      let select=q("#reportV30PageSelect");
      if(!select){
        const label=document.createElement("label");
        label.id="reportV30PageLayout";
        label.className="report-v34-layout";
        label.append(document.createTextNode("Page Layout"));
        select=document.createElement("select");
        select.id="reportV30PageSelect";
        select.innerHTML='<option value="landscape">A4 Landscape</option><option value="portrait">A4 Portrait</option>';
        label.appendChild(select);
        const count=filter.querySelector(".record-count-box");
        filter.insertBefore(label,count||null);
      }
      if(!select)return false;
      const saved=(typeof REPORT_STATE!=="undefined"&&REPORT_STATE?.pageOrientation)||"landscape";
      if(select.value!==saved)select.value=saved;
      if(!select.dataset.safeV34){
        select.dataset.safeV34="1";
        select.addEventListener("change",()=>{
          try{
            if(typeof REPORT_STATE!=="undefined")REPORT_STATE.pageOrientation=select.value||"landscape";
            if(!applying&&typeof renderReports==="function"){
              applying=true;
              try{renderReports()}finally{applying=false}
            }
          }catch(e){console.warn("Report page layout change",e)}
        });
      }
      if(!q("#reportV34Styles")){
        const s=document.createElement("style");
        s.id="reportV34Styles";
        s.textContent='.report-v34-layout{display:grid;gap:7px;font-size:9px;letter-spacing:.6px;font-weight:800;color:#74839a;text-transform:uppercase}.report-v34-layout select{width:100%;border:1px solid #ccd6e4;border-radius:10px;padding:11px;background:#fff;color:#172235}@media(max-width:760px){.print-report-filter{grid-template-columns:1fr!important}}';
        document.head.appendChild(s);
      }
      return true;
    }catch(e){
      console.warn("Safe report controls",e);
      return false;
    }
  }

  const obs=new MutationObserver(()=>{try{ensure()}catch(_){}});
  try{obs.observe(document.documentElement,{childList:true,subtree:true})}catch(_){}
  setTimeout(()=>{try{ensure()}catch(_){}},0);
  window.__REPORT_SAFE_CONTROLS_V34__=true;
})();
