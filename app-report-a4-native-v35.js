// Weekly Reports v40: continuous preview + actual rendered A4 overflow testing for Portrait/Landscape printing.
(function(){
  const q=s=>document.querySelector(s);
  const txt=v=>String(v??"").trim();
  const esc=v=>typeof reportEsc==="function"?reportEsc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let installed=false;

  function mode(){return q("#reportV30PageSelect")?.value||REPORT_STATE?.pageOrientation||"landscape"}
  function allSubjects(){return (q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS)===REPORT_ALL_SUBJECTS}
  function orientationLabel(){return txt(q("#reportV30OrientationText")?.textContent)||txt(REPORT_STATE?.orientation)||"All orientations"}
  function submittedAt(r){
    if(!r?.submitted)return"Pending";
    if(!r.savedAt)return"Submitted";
    const d=new Date(r.savedAt);if(Number.isNaN(d.getTime()))return"Submitted";
    return `Submitted: ${d.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`
  }
  function classCell(r){const code=r.batch||r.section||"—";return `<b>${esc(code)}</b>${allSubjects()?`<span class="a4-v35-subject">${esc(r.subject||"")}</span>`:""}`}
  function rowHtml(r,index){return `<tr><td>${index}</td><td>${classCell(r)}</td><td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td><td class="left">${esc(r.plannedTopic||"—")}</td><td class="left">${esc(r.currentTopic||"Not submitted")}</td><td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td class="left">${esc(r.reason||"—")}</td><td><b>${esc(r.teacher||"—")}</b><small>${esc(submittedAt(r))}</small></td></tr>`}
  function colgroup(){return `<colgroup><col style="width:3.5%"><col style="width:8%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:20.5%"><col style="width:20.5%"><col style="width:6%"><col style="width:12.5%"><col style="width:10.5%"></colgroup>`}
  function headerHtml(){
    const subject=q("#printReportSubject")?.value||REPORT_STATE?.subject||REPORT_ALL_SUBJECTS;
    const week=typeof reportWeekLabel==="function"?reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd):"";
    const today=typeof reportDateNumeric==="function"?reportDateNumeric():"";
    return `<thead>
      <tr class="a4-v35-school-row"><th colspan="10" class="a4-v35-school">Sri Chaitanya School: Khalsa CBSE Branch</th></tr>
      <tr class="a4-v35-status-row"><th colspan="10" class="a4-v35-status">Weekly syllabus status</th></tr>
      <tr class="a4-v35-meta-row"><th colspan="10" class="a4-v35-meta-wrap"><table class="a4-v35-meta"><tr><td><b>Subject:</b> ${esc(subject)}</td><td><b>Week:</b> ${esc(week)}<br><b>Orientation:</b> ${esc(orientationLabel())}</td><td><b>Date:</b> ${today}</td></tr></table></th></tr>
      <tr class="a4-v35-columns"><th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th><th>Topic in Year Plan</th><th>Topic currently being taught</th><th>Lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher / Submitted</th></tr>
    </thead>`
  }
  function rowsNow(){try{return Array.isArray(REPORT_STATE?.rows)?REPORT_STATE.rows:reportFilteredRows()}catch(_){return[]}}
  function reportHtml(rows){return `<div class="a4-v35-report ${mode()}"><table class="a4-v35-table">${colgroup()}${headerHtml()}<tbody>${rows.length?rows.map((r,i)=>rowHtml(r,i+1)).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table></div>`}

  function baseCss(printing=false){return `
    *{box-sizing:border-box}
    .a4-v35-report{font-family:Arial,sans-serif;color:#000;background:#fff;margin:0 auto;${printing?"":"border:1px solid #ccd3dc;box-shadow:0 4px 16px rgba(0,0,0,.08);padding:7mm;"}}
    .a4-v35-report.landscape{${printing?"":"width:297mm;"}}.a4-v35-report.portrait{${printing?"":"width:210mm;"}}
    .a4-v35-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}
    .a4-v35-table th,.a4-v35-table td{border:1px solid #333;white-space:normal;overflow-wrap:anywhere;word-break:normal}
    .a4-v35-school,.a4-v35-status,.a4-v35-meta-wrap{border:0!important;background:#fff!important}
    .a4-v35-school{font-family:Georgia,serif;font-weight:700;font-size:15pt;line-height:1.08;text-align:center!important;padding:0 0 .6mm!important}
    .a4-v35-status{font-weight:400!important;font-size:9.5pt!important;line-height:1.1;text-align:center!important;padding:0 0 1.4mm!important}
    .a4-v35-meta-wrap{padding:0!important}
    .a4-v35-meta{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}
    .a4-v35-meta td{border:1px solid #333;padding:1.05mm 1.15mm;font-size:8pt;line-height:1.16;vertical-align:middle;text-align:left}
    .a4-v35-meta td:nth-child(1){width:33%}.a4-v35-meta td:nth-child(2){width:43%}.a4-v35-meta td:nth-child(3){width:24%}
    .a4-v35-columns th{font-size:7.5pt;line-height:1.12;padding:.75mm .45mm;text-align:center;vertical-align:middle;font-weight:700}
    .a4-v35-table tbody td{font-size:7.9pt;line-height:1.16;padding:.76mm .48mm;text-align:center;vertical-align:top}.a4-v35-table tbody td.left{text-align:left}.a4-v35-table tbody td small{display:block;font-size:6.4pt;line-height:1.1;margin-top:.3mm}.a4-v35-subject{display:block;font-size:6.7pt;line-height:1.08;font-weight:700;margin-top:.3mm}
    .portrait .a4-v35-school{font-size:14pt}.portrait .a4-v35-status{font-size:9pt!important}.portrait .a4-v35-meta td{font-size:7.1pt;padding:.85mm}.portrait .a4-v35-columns th{font-size:6.15pt;padding:.55mm .25mm}.portrait .a4-v35-table tbody td{font-size:6.55pt;line-height:1.1;padding:.55mm .28mm}.portrait .a4-v35-table tbody td small{font-size:5.4pt}.portrait .a4-v35-subject{font-size:5.7pt}
    .a4-v35-table tbody tr,.a4-v35-table tbody td{break-inside:avoid;page-break-inside:avoid}
    ${printing?"":"@media(max-width:760px){#weeklyReportPreview{overflow-x:auto}.a4-v35-report{margin:0;min-width:210mm}.a4-v35-report.landscape{min-width:297mm}}"}
  `}
  function addStyles(){let s=q("#reportV35Styles");if(!s){s=document.createElement("style");s.id="reportV35Styles";document.head.appendChild(s)}s.textContent=baseCss(false)}
  function render(){const p=q("#weeklyReportPreview");if(!p)return;addStyles();p.innerHTML=reportHtml(rowsNow())}

  function print40(){
    const m=mode(),rows=rowsNow();
    const w=window.open("","_blank");
    if(!w){alert("Please allow pop-ups for this site to print the report.");return}
    const pageW=m==="portrait"?210:297,pageH=m==="portrait"?297:210;
    const margin=5,usableW=pageW-(margin*2),usableH=pageH-(margin*2);
    const pageSize=m==="portrait"?"A4 portrait":"A4 landscape";
    const css=`@page{size:${pageSize};margin:${margin}mm}html,body{margin:0!important;padding:0!important;background:#fff!important}${baseCss(true)}body{font-family:Arial,sans-serif}.print-pages{width:100%}.print-page{width:100%;margin:0!important;padding:0!important;break-after:auto!important;page-break-after:auto!important}.print-page+.print-page{break-before:page!important;page-break-before:always!important}.print-page .a4-v35-table thead{display:table-row-group!important}.print-page .a4-v35-table tbody tr{break-inside:avoid!important;page-break-inside:avoid!important}.measure-page{position:absolute;left:-20000px;top:0;visibility:hidden;width:${usableW}mm;height:${usableH}mm;overflow:hidden;margin:0;padding:0}.measure-page table{width:100%}`;
    const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly Syllabus Report</title><style>${css}</style></head><body class="${m}"><div id="measurePage" class="measure-page ${m}"><table id="measureTable" class="a4-v35-table">${colgroup()}${headerHtml()}<tbody id="measureBody"></tbody></table></div><main id="printPages" class="print-pages"></main></body></html>`;
    try{
      w.document.open();w.document.write(html);w.document.close();try{w.opener=null}catch(_){}
      const prepare=()=>{
        try{
          const d=w.document,box=d.getElementById("measurePage"),body=d.getElementById("measureBody"),pages=d.getElementById("printPages");
          if(!box||!body||!pages)throw new Error("Print measurement area was not created.");
          const groups=[];let group=[];
          const fits=()=>{
            const table=d.getElementById("measureTable");
            if(!table)return false;
            return table.getBoundingClientRect().bottom<=box.getBoundingClientRect().bottom+.5;
          };
          if(!rows.length){groups.push([])}else{
            for(let i=0;i<rows.length;i++){
              body.insertAdjacentHTML("beforeend",rowHtml(rows[i],i+1));
              if(!fits()&&group.length){
                body.lastElementChild?.remove();groups.push(group);group=[];body.innerHTML="";
                body.insertAdjacentHTML("beforeend",rowHtml(rows[i],i+1));
              }
              group.push(i);
            }
            if(group.length)groups.push(group);
          }
          pages.innerHTML=groups.map(g=>`<section class="print-page ${m}"><table class="a4-v35-table">${colgroup()}${headerHtml()}<tbody>${g.length?g.map(i=>rowHtml(rows[i],i+1)).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table></section>`).join("");
          box.remove();
          setTimeout(()=>{try{w.focus();w.print()}catch(e){console.error("Print failed",e)}},180)
        }catch(e){console.error("Rendered A4 print preparation failed",e);try{w.close()}catch(_){}alert("Could not prepare the A4 report. Please refresh once and try again.")}
      };
      if(w.document.fonts?.ready)w.document.fonts.ready.then(()=>w.requestAnimationFrame(()=>w.requestAnimationFrame(prepare))).catch(prepare);else setTimeout(prepare,100)
    }catch(e){console.error("Print document failed",e);try{w.close()}catch(_){}alert("Could not prepare the print report. Please refresh once and try again.")}
  }
  function bind(){const b=q("#printReportPdf");if(!b||b.dataset.v40)return;b.dataset.v40="1";b.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();print40()},true)}
  function install(){
    if(installed||typeof renderReports!=="function")return;installed=true;addStyles();
    const prev=renderReports;renderReports=function(){const out=prev.apply(this,arguments);try{render()}catch(e){console.warn("A4 report preview",e)}bind();return out};
    bind();try{render()}catch(_){}window.__REPORT_A4_RENDERED_V40__=true
  }
  const obs=new MutationObserver(()=>{if(!installed&&q("#reports"))install();else if(installed)bind()});try{obs.observe(document.documentElement,{childList:true,subtree:true})}catch(_){}
  setTimeout(install,0)
})();