// Weekly Reports v41: Android-safe A4 printing without blank pages; normal subject reports stay on one page.
(function(){
  const q=s=>document.querySelector(s);
  const text=v=>String(v??"").trim();
  const esc=v=>typeof reportEsc==="function"?reportEsc(v):text(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let installed=false;

  function mode(){return q("#reportV30PageSelect")?.value||REPORT_STATE?.pageOrientation||"landscape"}
  function rowsNow(){try{return Array.isArray(REPORT_STATE?.rows)?REPORT_STATE.rows:reportFilteredRows()}catch(_){return[]}}
  function allSubjects(){return (q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS)===REPORT_ALL_SUBJECTS}
  function orientationLabel(){return text(q("#reportV30OrientationText")?.textContent)||text(REPORT_STATE?.orientation)||"All orientations"}
  function submittedAt(r){if(!r?.submitted)return"Pending";if(!r.savedAt)return"Submitted";const d=new Date(r.savedAt);if(Number.isNaN(d.getTime()))return"Submitted";return `Submitted: ${d.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`}
  function classCell(r){const code=r.batch||r.section||"—";return `<b>${esc(code)}</b>${allSubjects()?`<span class="v41-subject">${esc(r.subject||"")}</span>`:""}`}
  function rowHtml(r,index){return `<tr><td>${index}</td><td>${classCell(r)}</td><td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td><td class="left">${esc(r.plannedTopic||"—")}</td><td class="left">${esc(r.currentTopic||"Not submitted")}</td><td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td class="left">${esc(r.reason||"—")}</td><td><b>${esc(r.teacher||"—")}</b><small>${esc(submittedAt(r))}</small></td></tr>`}
  function colgroup(){return `<colgroup><col style="width:3.5%"><col style="width:8%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:20.5%"><col style="width:20.5%"><col style="width:6%"><col style="width:12.5%"><col style="width:10.5%"></colgroup>`}
  function headHtml(){
    const subject=q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS;
    const week=typeof reportWeekLabel==="function"?reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd):"";
    const today=typeof reportDateNumeric==="function"?reportDateNumeric():"";
    return `<thead><tr><th colspan="10" class="v41-school">Sri Chaitanya School: Khalsa CBSE Branch</th></tr><tr><th colspan="10" class="v41-status">Weekly syllabus status</th></tr><tr><th colspan="10" class="v41-meta-wrap"><table class="v41-meta"><tr><td><b>Subject:</b> ${esc(subject)}</td><td><b>Week:</b> ${esc(week)}<br><b>Orientation:</b> ${esc(orientationLabel())}</td><td><b>Date:</b> ${today}</td></tr></table></th></tr><tr class="v41-cols"><th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th><th>Topic in Year Plan</th><th>Topic currently being taught</th><th>Lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher / Submitted</th></tr></thead>`
  }
  function tableHtml(indices,rows){return `<table class="v41-table">${colgroup()}${headHtml()}<tbody>${indices.length?indices.map(i=>rowHtml(rows[i],i+1)).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table>`}

  function css(m,pageW,pageH){return `
    @page{size:A4 ${m};margin:5mm}
    *{box-sizing:border-box}html,body{margin:0!important;padding:0!important;background:#fff!important;font-family:Arial,sans-serif;color:#000}
    .v41-pages{margin:0;padding:0;width:100%}.v41-page{width:100%;margin:0!important;padding:0!important;break-after:auto!important;page-break-after:auto!important}.v41-page+.v41-page{break-before:page!important;page-break-before:always!important}
    .v41-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}.v41-table th,.v41-table td{border:1px solid #333;white-space:normal;overflow-wrap:anywhere;word-break:normal}
    .v41-school,.v41-status,.v41-meta-wrap{border:0!important;background:#fff!important}.v41-school{font-family:Georgia,serif;font-weight:700;font-size:15pt;line-height:1.08;text-align:center!important;padding:0 0 .6mm!important}.v41-status{font-weight:400!important;font-size:9.5pt!important;line-height:1.1;text-align:center!important;padding:0 0 1.4mm!important}.v41-meta-wrap{padding:0!important}
    .v41-meta{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}.v41-meta td{border:1px solid #333;padding:1.05mm 1.15mm;font-size:8pt;line-height:1.16;vertical-align:middle;text-align:left}.v41-meta td:nth-child(1){width:33%}.v41-meta td:nth-child(2){width:43%}.v41-meta td:nth-child(3){width:24%}
    .v41-cols th{font-size:7.5pt;line-height:1.12;padding:.75mm .45mm;text-align:center;vertical-align:middle;font-weight:700}.v41-table tbody td{font-size:7.9pt;line-height:1.16;padding:.76mm .48mm;text-align:center;vertical-align:top}.v41-table tbody td.left{text-align:left}.v41-table tbody td small{display:block;font-size:6.4pt;line-height:1.1;margin-top:.3mm}.v41-subject{display:block;font-size:6.7pt;line-height:1.08;font-weight:700;margin-top:.3mm}
    body.portrait .v41-school{font-size:14pt}body.portrait .v41-status{font-size:9pt!important}body.portrait .v41-meta td{font-size:7.1pt;padding:.85mm}body.portrait .v41-cols th{font-size:6.15pt;padding:.55mm .25mm}body.portrait .v41-table tbody td{font-size:6.45pt;line-height:1.08;padding:.48mm .25mm}body.portrait .v41-table tbody td small{font-size:5.2pt}body.portrait .v41-subject{font-size:5.6pt}
    .v41-table tbody tr,.v41-table tbody td{break-inside:avoid!important;page-break-inside:avoid!important}
    #v41MeasureHost{position:absolute;left:-20000px;top:0;visibility:hidden;pointer-events:none;width:${pageW-10}mm;height:${pageH-10}mm;overflow:hidden}
    #v41MeasureHost .v41-measure{width:100%;height:100%;overflow:hidden}
    @media print{#v41MeasureHost{display:none!important}.v41-page{display:block!important}}
  `}
  }

  function splitRows(d,rows){
    if(!rows.length)return [[]];
    // Normal one-subject branch reports are intentionally kept together.
    // The print font is compact enough for these reports and this avoids Android orphan-page bugs.
    if(rows.length<=22)return [rows.map((_,i)=>i)];
    const host=d.getElementById("v41MeasureHost");if(!host)throw new Error("Measurement host missing");
    const groups=[];let current=[];
    const reset=()=>{host.innerHTML=`<div class="v41-measure"><table id="v41MeasureTable" class="v41-table">${colgroup()}${headHtml()}<tbody></tbody></table></div>`;return {table:d.getElementById("v41MeasureTable"),box:host.querySelector(".v41-measure")}};
    let m=reset();
    for(let i=0;i<rows.length;i++){
      m.table.tBodies[0].insertAdjacentHTML("beforeend",rowHtml(rows[i],i+1));
      const overflow=m.table.scrollHeight>m.box.clientHeight+1;
      if(overflow&&current.length){m.table.tBodies[0].lastElementChild?.remove();groups.push(current);current=[];m=reset();m.table.tBodies[0].insertAdjacentHTML("beforeend",rowHtml(rows[i],i+1))}
      current.push(i)
    }
    if(current.length)groups.push(current);host.innerHTML="";return groups
  }

  function print41(){
    const m=mode(),rows=rowsNow(),pageW=m==="portrait"?210:297,pageH=m==="portrait"?297:210;
    const w=window.open("","_blank");if(!w){alert("Please allow pop-ups for this site to print the report.");return}
    const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly Syllabus Report</title><style>${css(m,pageW,pageH)}</style></head><body class="${m}"><div id="v41MeasureHost"></div><main id="v41Pages" class="v41-pages"></main></body></html>`;
    try{
      w.document.open();w.document.write(html);w.document.close();try{w.opener=null}catch(_){}
      const prepare=()=>{try{
        const d=w.document,pages=d.getElementById("v41Pages");if(!pages)throw new Error("Print pages container missing");
        const groups=splitRows(d,rows);
        pages.innerHTML=groups.map(g=>`<section class="v41-page">${tableHtml(g,rows)}</section>`).join("");
        setTimeout(()=>{try{w.focus();w.print()}catch(e){console.error("Print failed",e)}},180)
      }catch(e){console.error("A4 preparation failed",e);try{w.close()}catch(_){}alert("Could not prepare the A4 report. Please refresh once and try again.")}};
      if(w.document.fonts?.ready)w.document.fonts.ready.then(()=>w.requestAnimationFrame(()=>w.requestAnimationFrame(prepare))).catch(prepare);else setTimeout(prepare,80)
    }catch(e){console.error("Print document failed",e);try{w.close()}catch(_){}alert("Could not prepare the print report. Please refresh once and try again.")}
  }

  function bind(){const b=q("#printReportPdf");if(!b||b.dataset.v41)return;const clone=b.cloneNode(true);clone.dataset.v41="1";b.replaceWith(clone);clone.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();print41()},true)}
  function install(){if(installed)return;installed=true;try{bind()}catch(_){}if(typeof renderReports==="function"){const prev=renderReports;renderReports=function(){const out=prev.apply(this,arguments);setTimeout(bind,0);return out}}window.__REPORT_A4_ANDROID_V41__=true}
  setTimeout(install,0);
})();