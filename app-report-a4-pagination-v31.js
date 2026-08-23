// Weekly Reports v31: exact A4 pagination using one shared measurement/preview/print layout.
(function(){
  const q=s=>document.querySelector(s);
  const txt=v=>String(v??"").trim();
  const escHtml=v=>typeof reportEsc==="function"?reportEsc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
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
  function classCell(r){const code=r.batch||r.section||"—";return `<b>${escHtml(code)}</b>${allSubjects()?`<span class="a4-v31-subject">${escHtml(r.subject||"")}</span>`:""}`}
  function rowHtml(r,index){return `<tr><td>${index}</td><td>${classCell(r)}</td><td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td><td class="left">${escHtml(r.plannedTopic||"—")}</td><td class="left">${escHtml(r.currentTopic||"Not submitted")}</td><td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td class="left">${escHtml(r.reason||"—")}</td><td><b>${escHtml(r.teacher||"—")}</b><small>${escHtml(submittedAt(r))}</small></td></tr>`}
  function colgroup(){return `<colgroup><col style="width:3.5%"><col style="width:8%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:20.5%"><col style="width:20.5%"><col style="width:6%"><col style="width:12.5%"><col style="width:10.5%"></colgroup>`}
  function head(){return `<thead><tr><th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th><th>Topic in Year Plan</th><th>Topic currently being taught</th><th>Lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher / Submitted</th></tr></thead>`}
  function meta(page,total){
    const subject=q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS;
    const week=typeof reportWeekLabel==="function"?reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd):"";
    const today=typeof reportDateNumeric==="function"?reportDateNumeric():"";
    return `<div class="a4-v31-title">Sri Chaitanya School: Khalsa CBSE Branch</div><div class="a4-v31-sub">Weekly syllabus status</div><table class="a4-v31-meta"><tr><td><b>Subject:</b> ${escHtml(subject)}</td><td><b>Week:</b> ${escHtml(week)}<br><b>Orientation:</b> ${escHtml(orientationLabel())}</td><td><b>Date:</b> ${today}<br><b>Page:</b> ${page} of ${total}</td></tr></table>`
  }
  function pageShell(m,page=99,total=99){
    const el=document.createElement("section");el.className=`a4-v31-page ${m} a4-v31-measure`;el.innerHTML=`${meta(page,total)}<table class="a4-v31-table">${colgroup()}${head()}<tbody></tbody></table>`;document.body.appendChild(el);return el
  }
  function paginate(rows,m){
    if(!rows?.length)return[[]];
    const groups=[];let group=[],page=pageShell(m),body=page.querySelector("tbody");
    const safetyPx=7;
    for(let i=0;i<rows.length;i++){
      const holder=document.createElement("tbody");holder.innerHTML=rowHtml(rows[i],i+1);const tr=holder.firstElementChild;body.appendChild(tr);
      void page.offsetHeight;
      const overflow=page.scrollHeight>page.clientHeight-safetyPx;
      if(overflow&&group.length){
        tr.remove();groups.push(group);page.remove();group=[];page=pageShell(m);body=page.querySelector("tbody");
        const next=document.createElement("tbody");next.innerHTML=rowHtml(rows[i],i+1);body.appendChild(next.firstElementChild);void page.offsetHeight
      }
      group.push(rows[i])
    }
    if(group.length)groups.push(group);page.remove();return groups
  }
  function onePage(rows,page,total,offset,m){return `<section class="a4-v31-page ${m}">${meta(page,total)}<table class="a4-v31-table">${colgroup()}${head()}<tbody>${rows.length?rows.map((r,i)=>rowHtml(r,offset+i+1)).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table></section>`}
  function pagesHtml(rows,m){const groups=paginate(rows||[],m),total=groups.length;let offset=0;return `<div class="a4-v31-pages ${m}">${groups.map((g,i)=>{const h=onePage(g,i+1,total,offset,m);offset+=g.length;return h}).join("")}</div>`}

  function css(printing=false){return `
    *{box-sizing:border-box}
    .a4-v31-pages{display:grid;gap:${printing?"0":"18px"};justify-items:center;background:#fff}
    .a4-v31-page{font-family:Arial,sans-serif;color:#000;background:#fff;box-sizing:border-box;overflow:hidden;padding:7mm;margin:0;${printing?"":"border:1px solid #ccd3dc;box-shadow:0 4px 16px rgba(0,0,0,.08);"}}
    .a4-v31-page.landscape{width:297mm;height:210mm}.a4-v31-page.portrait{width:210mm;height:297mm}
    .a4-v31-title{text-align:center;font-family:Georgia,serif;font-weight:700;line-height:1.08;margin:0 0 .6mm;font-size:15pt}.a4-v31-sub{text-align:center;font-size:9.5pt;line-height:1.1;margin:0 0 1.4mm}
    .a4-v31-meta,.a4-v31-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}.a4-v31-meta td{border:1px solid #333;padding:1.05mm 1.15mm;font-size:8.2pt;line-height:1.16;vertical-align:middle}.a4-v31-meta td:nth-child(1){width:33%}.a4-v31-meta td:nth-child(2){width:43%}.a4-v31-meta td:nth-child(3){width:24%}
    .a4-v31-table th,.a4-v31-table td{border:1px solid #333;white-space:normal;overflow-wrap:anywhere;word-break:normal}.a4-v31-table th{font-size:7.8pt;line-height:1.12;padding:.8mm .5mm;text-align:center;vertical-align:middle;font-weight:700}.a4-v31-table td{font-size:8.2pt;line-height:1.18;padding:.82mm .52mm;text-align:center;vertical-align:top}.a4-v31-table td.left{text-align:left}.a4-v31-table td small{display:block;font-size:6.8pt;line-height:1.12;margin-top:.36mm}.a4-v31-subject{display:block;font-size:7pt;line-height:1.1;font-weight:700;margin-top:.36mm}.a4-v31-table tr{break-inside:avoid;page-break-inside:avoid}
    .a4-v31-page.portrait .a4-v31-title{font-size:14pt}.a4-v31-page.portrait .a4-v31-sub{font-size:9pt}.a4-v31-page.portrait .a4-v31-meta td{font-size:7.6pt;padding:.95mm}.a4-v31-page.portrait .a4-v31-table th{font-size:6.9pt;padding:.7mm .36mm}.a4-v31-page.portrait .a4-v31-table td{font-size:7.4pt;line-height:1.16;padding:.72mm .38mm}.a4-v31-page.portrait .a4-v31-table td small{font-size:6.2pt}.a4-v31-page.portrait .a4-v31-subject{font-size:6.4pt}
    .a4-v31-measure{position:fixed!important;left:-30000px!important;top:0!important;visibility:hidden!important;border:0!important;box-shadow:none!important;z-index:-99999!important}
    @media(max-width:760px){.a4-v31-pages{justify-items:start;overflow:auto}}
  `}
  function addStyles(){if(q("#reportV31Styles"))return;const s=document.createElement("style");s.id="reportV31Styles";s.textContent=css(false);document.head.appendChild(s)}
  function rowsNow(){try{return REPORT_STATE?.rows?.length||REPORT_STATE?.rows?.length===0?REPORT_STATE.rows:reportFilteredRows()}catch(_){return[]}}
  function renderExact(){const preview=q("#weeklyReportPreview");if(!preview)return;addStyles();preview.innerHTML=pagesHtml(rowsNow(),mode())}
  function printExact(){
    const m=mode(),rows=rowsNow(),html=pagesHtml(rows,m),w=window.open("","_blank","noopener,noreferrer");
    if(!w){alert("Please allow pop-ups for this site to print the report.");return}
    const pageSize=m==="portrait"?"A4 portrait":"A4 landscape";
    w.document.open();w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Weekly Syllabus Report</title><style>@page{size:${pageSize};margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important}${css(true)}.a4-v31-page{break-after:page;page-break-after:always}.a4-v31-page:last-child{break-after:auto;page-break-after:auto}</style></head><body>${html}</body></html>`);w.document.close();
    const fire=()=>setTimeout(()=>{try{w.focus();w.print()}catch(e){console.error(e)}},120);
    if(w.document.fonts?.ready)w.document.fonts.ready.then(fire).catch(fire);else fire()
  }
  function install(){
    if(installed||typeof renderReports!=="function")return;installed=true;addStyles();
    const prev=renderReports;renderReports=function(){const out=prev.apply(this,arguments);try{renderExact()}catch(e){console.warn("Exact A4 preview",e)}const b=q("#printReportPdf");if(b)b.onclick=printExact;return out};
    const b=q("#printReportPdf");if(b)b.onclick=printExact;
    try{renderExact()}catch(_){}
    window.__REPORT_A4_PAGINATION_V31__=true
  }
  const obs=new MutationObserver(()=>{if(!installed&&q("#reports"))install();else if(installed){const b=q("#printReportPdf");if(b&&b.onclick!==printExact)b.onclick=printExact}});obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(install,0)
})();
