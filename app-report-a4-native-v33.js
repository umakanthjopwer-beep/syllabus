// Weekly Reports v33: continuous preview + native browser A4 pagination.
// Eliminates fake fixed-height preview pages and the blank about:blank print-tab issue.
(function(){
  const q=s=>document.querySelector(s);
  const txt=v=>String(v??"").trim();
  const esc=v=>typeof reportEsc==="function"?reportEsc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let installed=false;

  function mode(){return q("#reportV30PageSelect")?.value||REPORT_STATE?.pageOrientation||"landscape"}
  function allSubjects(){return (q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS)===REPORT_ALL_SUBJECTS}
  function orientationLabel(){return txt(q("#reportV30OrientationText")?.textContent)||"All orientations"}
  function submittedAt(r){
    if(!r?.submitted)return"Pending";
    if(!r.savedAt)return"Submitted";
    const d=new Date(r.savedAt);if(Number.isNaN(d.getTime()))return"Submitted";
    return `Submitted: ${d.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`
  }
  function classCell(r){const code=r.batch||r.section||"—";return `<b>${esc(code)}</b>${allSubjects()?`<span class="a4-v33-subject">${esc(r.subject||"")}</span>`:""}`}
  function rowHtml(r,index){return `<tr><td>${index}</td><td>${classCell(r)}</td><td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td><td class="left">${esc(r.plannedTopic||"—")}</td><td class="left">${esc(r.currentTopic||"Not submitted")}</td><td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td class="left">${esc(r.reason||"—")}</td><td><b>${esc(r.teacher||"—")}</b><small>${esc(submittedAt(r))}</small></td></tr>`}
  function colgroup(){return `<colgroup><col style="width:3.5%"><col style="width:8%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:20.5%"><col style="width:20.5%"><col style="width:6%"><col style="width:12.5%"><col style="width:10.5%"></colgroup>`}
  function head(){return `<thead><tr><th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th><th>Topic in Year Plan</th><th>Topic currently being taught</th><th>Lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher / Submitted</th></tr></thead>`}
  function header(){
    const subject=q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS;
    const week=typeof reportWeekLabel==="function"?reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd):"";
    const today=typeof reportDateNumeric==="function"?reportDateNumeric():"";
    return `<div class="a4-v33-title">Sri Chaitanya School: Khalsa CBSE Branch</div><div class="a4-v33-sub">Weekly syllabus status</div><table class="a4-v33-meta"><tr><td><b>Subject:</b> ${esc(subject)}</td><td><b>Week:</b> ${esc(week)}<br><b>Orientation:</b> ${esc(orientationLabel())}</td><td><b>Date:</b> ${today}</td></tr></table>`
  }
  function rowsNow(){try{return Array.isArray(REPORT_STATE?.rows)?REPORT_STATE.rows:reportFilteredRows()}catch(_){return[]}}
  function reportHtml(rows){return `<div class="a4-v33-report ${mode()}">${header()}<table class="a4-v33-table">${colgroup()}${head()}<tbody>${rows.length?rows.map((r,i)=>rowHtml(r,i+1)).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table></div>`}

  function baseCss(printing=false){return `
    *{box-sizing:border-box}
    .a4-v33-report{font-family:Arial,sans-serif;color:#000;background:#fff;margin:0 auto;${printing?"":"border:1px solid #ccd3dc;box-shadow:0 4px 16px rgba(0,0,0,.08);padding:7mm;"}}
    .a4-v33-report.landscape{${printing?"":"width:297mm;"}}.a4-v33-report.portrait{${printing?"":"width:210mm;"}}
    .a4-v33-title{text-align:center;font-family:Georgia,serif;font-weight:700;font-size:15pt;line-height:1.08;margin:0 0 .6mm}.a4-v33-sub{text-align:center;font-size:9.5pt;line-height:1.1;margin:0 0 1.4mm}
    .a4-v33-meta,.a4-v33-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}.a4-v33-meta{margin-bottom:0}.a4-v33-meta td{border:1px solid #333;padding:1.05mm 1.15mm;font-size:8pt;line-height:1.16;vertical-align:middle}.a4-v33-meta td:nth-child(1){width:33%}.a4-v33-meta td:nth-child(2){width:43%}.a4-v33-meta td:nth-child(3){width:24%}
    .a4-v33-table th,.a4-v33-table td{border:1px solid #333;white-space:normal;overflow-wrap:anywhere;word-break:normal}.a4-v33-table th{font-size:7.5pt;line-height:1.12;padding:.75mm .45mm;text-align:center;vertical-align:middle;font-weight:700}.a4-v33-table td{font-size:7.9pt;line-height:1.16;padding:.76mm .48mm;text-align:center;vertical-align:top}.a4-v33-table td.left{text-align:left}.a4-v33-table td small{display:block;font-size:6.4pt;line-height:1.1;margin-top:.3mm}.a4-v33-subject{display:block;font-size:6.7pt;line-height:1.08;font-weight:700;margin-top:.3mm}
    .a4-v33-report.portrait .a4-v33-title{font-size:14pt}.a4-v33-report.portrait .a4-v33-sub{font-size:9pt}.a4-v33-report.portrait .a4-v33-meta td{font-size:7.1pt;padding:.85mm}.a4-v33-report.portrait .a4-v33-table th{font-size:6.15pt;padding:.55mm .25mm}.a4-v33-report.portrait .a4-v33-table td{font-size:6.55pt;line-height:1.1;padding:.55mm .28mm}.a4-v33-report.portrait .a4-v33-table td small{font-size:5.4pt}.a4-v33-report.portrait .a4-v33-subject{font-size:5.7pt}
    .a4-v33-table thead{display:table-header-group}.a4-v33-table tfoot{display:table-footer-group}.a4-v33-table tr,.a4-v33-table td,.a4-v33-table th{break-inside:avoid;page-break-inside:avoid}
    ${printing?"":"@media(max-width:760px){#weeklyReportPreview{overflow-x:auto}.a4-v33-report{margin:0;min-width:210mm}.a4-v33-report.landscape{min-width:297mm}}"}
  `}
  function addStyles(){let s=q("#reportV33Styles");if(!s){s=document.createElement("style");s.id="reportV33Styles";document.head.appendChild(s)}s.textContent=baseCss(false)}
  function render(){const p=q("#weeklyReportPreview");if(!p)return;addStyles();p.innerHTML=reportHtml(rowsNow())}

  function print33(){
    const m=mode(),rows=rowsNow();
    // Do not request noopener in window.open: Android Chrome may return null while still opening an empty tab.
    const w=window.open("","_blank");
    if(!w){alert("Please allow pop-ups for this site to print the report.");return}
    const pageSize=m==="portrait"?"A4 portrait":"A4 landscape";
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Weekly Syllabus Report</title><style>@page{size:${pageSize};margin:19mm 7mm 8mm 7mm}html,body{margin:0!important;padding:0!important;background:#fff!important}${baseCss(true)}.a4-v33-report{width:auto!important;padding:0!important;border:0!important;box-shadow:none!important}.a4-v33-title,.a4-v33-sub,.a4-v33-meta{break-after:avoid-page;page-break-after:avoid}.a4-v33-table thead{display:table-header-group!important}.a4-v33-table tr{break-inside:avoid!important;page-break-inside:avoid!important}</style></head><body>${reportHtml(rows)}</body></html>`;
    try{
      w.document.open();w.document.write(html);w.document.close();
      try{w.opener=null}catch(_){}
      const fire=()=>setTimeout(()=>{try{w.focus();w.print()}catch(e){console.error("Print failed",e)}},220);
      if(w.document.fonts?.ready)w.document.fonts.ready.then(fire).catch(fire);else fire()
    }catch(e){console.error("Print document failed",e);try{w.close()}catch(_){}alert("Could not prepare the print report. Please refresh once and try again.")}
  }
  function bind(){const b=q("#printReportPdf");if(!b||b.dataset.v33)return;b.dataset.v33="1";b.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();print33()},true)}
  function install(){
    if(installed||typeof renderReports!=="function")return;installed=true;addStyles();
    const prev=renderReports;renderReports=function(){const out=prev.apply(this,arguments);try{render()}catch(e){console.warn("Native A4 preview",e)}bind();return out};
    bind();try{render()}catch(_){}window.__REPORT_A4_NATIVE_V33__=true
  }
  const obs=new MutationObserver(()=>{if(!installed&&q("#reports"))install();else if(installed)bind()});obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(install,0)
})();
