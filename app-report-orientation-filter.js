// Branch-aware Orientation / Programme filter for Weekly Reports.
(function(){
  const ALL_ORIENTATIONS="All orientations";
  function txt(v){return String(v??"").trim()}
  function orientationForSection(section){
    try{const m=sectionMeta(section);return txt(m?.program||m?.orientation)}catch(e){return""}
  }
  function reportOrientations(){
    const values=new Set();
    try{for(const m of reportAccessibleMappings()){
      const o=orientationForSection(m.section);if(o)values.add(o)
    }}catch(e){}
    return[...values].sort((a,b)=>a.localeCompare(b))
  }
  function ensureOrientationFilter(){
    const filter=document.querySelector("#reports .print-report-filter");
    if(!filter||document.getElementById("printReportOrientation"))return;
    const label=document.createElement("label");
    label.id="printReportOrientationLabel";
    label.append(document.createTextNode("Orientation / Programme"));
    const select=document.createElement("select");select.id="printReportOrientation";label.appendChild(select);
    const count=filter.querySelector(".record-count-box");filter.insertBefore(label,count||null);
    select.onchange=()=>{REPORT_STATE.orientation=select.value||ALL_ORIENTATIONS;renderReports()};
    if(!document.getElementById("reportOrientationStyles")){
      const s=document.createElement("style");s.id="reportOrientationStyles";
      s.textContent=".print-report-filter{grid-template-columns:1.1fr 1.1fr 1.1fr 1.1fr 110px!important}@media(max-width:760px){.print-report-filter{grid-template-columns:1fr!important}}";
      document.head.appendChild(s)
    }
  }
  function populateOrientationFilter(){
    ensureOrientationFilter();const sel=document.getElementById("printReportOrientation");if(!sel)return;
    const values=[ALL_ORIENTATIONS,...reportOrientations()];
    const old=REPORT_STATE.orientation||sel.value||ALL_ORIENTATIONS;
    sel.innerHTML=values.map(v=>`<option value="${typeof reportEsc==="function"?reportEsc(v):v}">${typeof reportEsc==="function"?reportEsc(v):v}</option>`).join("");
    sel.value=values.includes(old)?old:ALL_ORIENTATIONS;REPORT_STATE.orientation=sel.value
  }

  if(typeof reportFilteredRows==="function"){
    const previous=reportFilteredRows;
    reportFilteredRows=function(){
      let rows=previous();const sel=document.getElementById("printReportOrientation"),orientation=sel?.value||REPORT_STATE.orientation||ALL_ORIENTATIONS;
      if(orientation!==ALL_ORIENTATIONS)rows=rows.filter(r=>txt(r.program)===orientation||orientationForSection(r.section)===orientation);
      REPORT_STATE={...REPORT_STATE,orientation,rows};return rows
    }
  }
  if(typeof renderReports==="function"){
    const previous=renderReports;
    renderReports=function(){populateOrientationFilter();return previous()}
  }
  if(typeof reportSheetHtml==="function"){
    const previous=reportSheetHtml;
    reportSheetHtml=function(rows){
      let html=previous(rows),orientation=REPORT_STATE.orientation||ALL_ORIENTATIONS;
      if(orientation!==ALL_ORIENTATIONS){
        const safe=typeof reportEsc==="function"?reportEsc(orientation):orientation;
        html=String(html).replace(/(<b>Subject:<\/b>[^<]*)(<\/td>)/,`$1 &nbsp; <b>Orientation:</b> ${safe}$2`)
      }
      return html
    }
  }
  if(typeof ensureStyledExcelEngine==="function"){
    const previous=ensureStyledExcelEngine;
    ensureStyledExcelEngine=async function(){
      const XL=await previous();
      if(!XL.__orientationReportPatched){
        const original=XL.utils.aoa_to_sheet.bind(XL.utils);
        XL.utils.aoa_to_sheet=function(rows,...args){
          let next=rows,orientation=REPORT_STATE?.orientation||ALL_ORIENTATIONS;
          if(orientation!==ALL_ORIENTATIONS&&Array.isArray(rows)&&Array.isArray(rows[2])&&String(rows[2][0]||"").startsWith("Subject:")){
            next=rows.map((r,i)=>i===2?[...r]:r);next[2][0]=`${next[2][0]} | Orientation: ${orientation}`
          }
          return original(next,...args)
        };
        XL.__orientationReportPatched=true
      }
      return XL
    }
  }
})();
