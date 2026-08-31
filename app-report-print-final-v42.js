// Final weekly report print engine v42: single authority for Portrait/Landscape PDF printing.
(function(){
  const q=s=>document.querySelector(s);
  const text=v=>String(v??"").trim();
  const esc=v=>typeof reportEsc==="function"?reportEsc(v):text(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  function mode(){return q("#reportV30PageSelect")?.value||REPORT_STATE?.pageOrientation||"landscape"}
  function rowsNow(){try{return Array.isArray(REPORT_STATE?.rows)?REPORT_STATE.rows:reportFilteredRows()}catch(_){return[]}}
  function allSubjects(){return (q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS)===REPORT_ALL_SUBJECTS}
  function orientationLabel(){return text(q("#reportV30OrientationText")?.textContent)||text(REPORT_STATE?.orientation)||"All orientations"}
  function submittedAt(r){if(!r?.submitted)return"Pending";if(!r.savedAt)return"Submitted";const d=new Date(r.savedAt);if(Number.isNaN(d.getTime()))return"Submitted";return `Submitted: ${d.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`}
  function classCell(r){const code=r.batch||r.section||"—";return `<b>${esc(code)}</b>${allSubjects()?`<span class="v42-subject">${esc(r.subject||"")}</span>`:""}`}
  function rowHtml(r,index){return `<tr><td>${index}</td><td>${classCell(r)}</td><td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td><td class="left">${esc(r.plannedTopic||"—")}</td><td class="left">${esc(r.currentTopic||"Not submitted")}</td><td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td class="left">${esc(r.reason||"—")}</td><td><b>${esc(r.teacher||"—")}</b><small>${esc(submittedAt(r))}</small></td></tr>`}
  function colgroup(){return `<colgroup><col style="width:3.5%"><col style="width:8%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:20.5%"><col style="width:20.5%"><col style="width:6%"><col style="width:12.5%"><col style="width:10.5%"></colgroup>`}
  function headHtml(){
    const subject=q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS;
    const week=typeof reportWeekLabel==="function"?reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd):"";
    const today=typeof reportDateNumeric==="function"?reportDateNumeric():"";
    return `<thead><tr><th colspan="10" class="v42-school">Sri Chaitanya School: Khalsa CBSE Branch</th></tr><tr><th colspan="10" class="v42-status">Weekly syllabus status</th></tr><tr><th colspan="10" class="v42-meta-wrap"><table class="v42-meta"><tr><td><b>Subject:</b> ${esc(subject)}</td><td><b>Week:</b> ${esc(week)}<br><b>Orientation:</b> ${esc(orientationLabel())}</td><td><b>Date:</b> ${today}</td></tr></table></th></tr><tr class="v42-cols"><th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th><th>Topic in Year Plan</th><th>Topic currently being taught</th><th>Lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher / Submitted</th></tr></thead>`
  }
  function tableHtml(indices,rows){return `<table class="v42-table">${colgroup()}${headHtml()}<tbody>${indices.length?indices.map(i=>rowHtml(rows[i],i+1)).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table>`}
  function css(m,pageW,pageH){return `
    @page{size:A4 ${m};margin:5mm}
    *{box-sizing:border-box}html,body{margin:0!important;padding:0!important;background:#fff!important;font-family:Arial,sans-serif;color:#000}
    .v42-pages{width:100%;margin:0;padding:0}.v42-page{width:100%;margin:0!important;padding:0!important;break-after:auto!important;page-break-after:auto!important}.v42-page+.v42-page{break-before:page!important;page-break-before:always!important}
    .v42-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}.v42-table th,.v42-table td{border:1px solid #333;white-space:normal;overflow-wrap:anywhere;word-break:normal}
    .v42-school,.v42-status,.v42-meta-wrap{border:0!important;background:#fff!important}.v42-school{font-family:Georgia,serif;font-weight:700;font-size:15pt;line-height:1.08;text-align:center!important;padding:0 0 .6mm!important}.v42-status{font-weight:400!important;font-size:9.5pt!important;line-height:1.1;text-align:center!important;padding:0 0 1.4mm!important}.v42-meta-wrap{padding:0!important}
    .v42-meta{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}.v42-meta td{border:1px solid #333;padding:1.05mm 1.15mm;font-size:8pt;line-height:1.16;vertical-align:middle;text-align:left}.v42-meta td:nth-child(1){width:33%}.v42-meta td:nth-child(2){width:43%}.v42-meta td:nth-child(3){width:24%}
    .v42-cols th{font-size:7.5pt;line-height:1.12;padding:.75mm .45mm;text-align:center;vertical-align:middle;font-weight:700}.v42-table tbody td{font-size:7.9pt;line-height:1.16;padding:.76mm .48mm;text-align:center;vertical-align:top}.v42-table tbody td.left{text-align:left}.v42-table tbody td small{display:block;font-size:6.4pt;line-height:1.1;margin-top:.3mm}.v42-subject{display:block;font-size:6.7pt;line-height:1.08;font-weight:700;margin-top:.3mm}
    body.portrait .v42-school{font-size:14pt}body.portrait .v42-status{font-size:9pt!important}body.portrait .v42-meta td{font-size:7.1pt;padding:.85mm}body.portrait .v42-cols th{font-size:6.15pt;padding:.55mm .25mm}body.portrait .v42-table tbody td{font-size:6.35pt;line-height:1.07;padding:.45mm .24mm}body.portrait .v42-table tbody td small{font-size:5.1pt}body.portrait .v42-subject{font-size:5.5pt}
    .v42-table tbody tr,.v42-table tbody td{break-inside:avoid!important;page-break-inside:avoid!important}
    #v42Measure{position:absolute;left:-20000px;top:0;visibility:hidden;width:${pageW-10}mm;height:${pageH-10}mm;overflow:hidden;pointer-events:none}
    #v42MeasureBox{width:100%;height:100%;overflow:hidden}
    @media print{#v42Measure{display:none!important}}
  `}
  function splitRows(d,rows,m){
    if(!rows.length)return [[]];
    // Subject reports of this normal branch size should remain a single A4 page.
    if(rows.length<=22)return [rows.map((_,i)=>i)];
    const host=d.getElementById("v42Measure"),box=d.getElementById("v42MeasureBox");if(!host||!box)return [rows.map((_,i)=>i)];
    const groups=[];let current=[];
    const reset=()=>{box.innerHTML=`<table id="v42MeasureTable" class="v42-table">${colgroup()}${headHtml()}<tbody></tbody></table>`;return d.getElementById("v42MeasureTable")};
    let table=reset();
    for(let i=0;i<rows.length;i++){
      table.tBodies[0].insertAdjacentHTML("beforeend",rowHtml(rows[i],i+1));
      if(table.scrollHeight>box.clientHeight+1&&current.length){table.tBodies[0].lastElementChild?.remove();groups.push(current);current=[];table=reset();table.tBodies[0].insertAdjacentHTML("beforeend",rowHtml(rows[i],i+1))}
      current.push(i)
    }
    if(current.length)groups.push(current);box.innerHTML="";return groups
  }
  function printFinal(){
    const m=mode(),rows=rowsNow(),pageW=m==="portrait"?210:297,pageH=m==="portrait"?297:210;
    const w=window.open("","_blank");if(!w){alert("Please allow pop-ups for this site to print the report.");return}
    const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly Syllabus Report</title><style>${css(m,pageW,pageH)}</style></head><body class="${m}"><div id="v42Measure"><div id="v42MeasureBox"></div></div><main id="v42Pages" class="v42-pages"></main></body></html>`;
    try{
      w.document.open();w.document.write(html);w.document.close();try{w.opener=null}catch(_){}
      const prepare=()=>{try{const d=w.document,pages=d.getElementById("v42Pages");const groups=splitRows(d,rows,m);pages.innerHTML=groups.map(g=>`<section class="v42-page">${tableHtml(g,rows)}</section>`).join("");setTimeout(()=>{try{w.focus();w.print()}catch(e){console.error(e)}},180)}catch(e){console.error("Final print prepare",e);try{w.close()}catch(_){}alert("Could not prepare the A4 report. Please refresh once and try again.")}};
      if(w.document.fonts?.ready)w.document.fonts.ready.then(()=>w.requestAnimationFrame(()=>w.requestAnimationFrame(prepare))).catch(prepare);else setTimeout(prepare,80)
    }catch(e){try{w.close()}catch(_){}alert("Could not prepare the print report. Please refresh once and try again.")}
  }
  function bind(){
    const b=q("#printReportPdf");if(!b||b.dataset.finalV42)return;
    const clone=b.cloneNode(true);clone.removeAttribute("onclick");clone.dataset.finalV42="1";b.replaceWith(clone);
    clone.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();printFinal()},true)
  }
  function install(){
    bind();
    const obs=new MutationObserver(()=>bind());
    try{obs.observe(document.body,{childList:true,subtree:true})}catch(_){}
    if(typeof renderReports==="function"){const previous=renderReports;renderReports=function(){const out=previous.apply(this,arguments);queueMicrotask(bind);setTimeout(bind,0);return out}}
    window.__REPORT_PRINT_FINAL_V42__=true
  }
  setTimeout(install,0)
})();