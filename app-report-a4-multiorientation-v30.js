// Weekly Reports v30: multi-orientation filter + isolated A4 portrait/landscape print engine.
(function(){
  const ALL="All orientations";
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const txt=v=>String(v??"").trim();
  const escHtml=v=>typeof reportEsc==="function"?reportEsc(v):txt(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let installed=false,selected=new Set(),pageMode="landscape",baseFiltered=null,baseRender=null;

  function orientationForSection(section){try{const m=sectionMeta(section);return txt(m?.program||m?.orientation)}catch(_){return""}}
  function availableOrientations(){
    const out=new Set();
    try{for(const m of reportAccessibleMappings()){const o=orientationForSection(m.section);if(o)out.add(o)}}catch(_){}
    return [...out].sort((a,b)=>a.localeCompare(b))
  }
  function selectedList(){const all=availableOrientations();if(!selected.size||selected.size===all.length)return all;return all.filter(x=>selected.has(x))}
  function orientationLabel(){const all=availableOrientations(),now=selectedList();if(!now.length||now.length===all.length)return ALL;if(now.length<=2)return now.join(" + ");return `${now.length} selected`}

  function addStyles(){if(q("#reportV30Styles"))return;const s=document.createElement("style");s.id="reportV30Styles";s.textContent=`
    .report-v30-multi{position:relative;display:grid;gap:7px;font-size:9px;letter-spacing:.6px;font-weight:800;color:#74839a;text-transform:uppercase}
    .report-v30-button{width:100%;min-height:42px;border:1px solid #ccd6e4;border-radius:10px;background:#fff;color:#172235;padding:9px 11px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:600;text-transform:none;letter-spacing:0}
    .report-v30-pop{position:absolute;z-index:50;top:100%;left:0;right:0;margin-top:5px;background:#fff;border:1px solid #ccd6e4;border-radius:12px;box-shadow:0 12px 28px rgba(20,45,80,.15);padding:8px;display:none;max-height:240px;overflow:auto}
    .report-v30-pop.open{display:grid;gap:4px}.report-v30-pop label{display:flex!important;align-items:center;gap:8px;padding:8px;border-radius:8px;font-size:12px!important;font-weight:650!important;color:#24374d!important;text-transform:none!important;letter-spacing:0!important;cursor:pointer}.report-v30-pop label:hover{background:#f3f7fb}.report-v30-pop input{width:auto!important;margin:0}
    .report-v30-layout{display:grid;gap:7px;font-size:9px;letter-spacing:.6px;font-weight:800;color:#74839a;text-transform:uppercase}.report-v30-layout select{width:100%;border:1px solid #ccd6e4;border-radius:10px;padding:11px;background:#fff;color:#172235}
    .a4-v30-pages{display:grid;gap:20px;justify-items:center;padding-bottom:8px}.a4-v30-page{box-sizing:border-box;background:#fff;color:#000;border:1px solid #ccd3dc;box-shadow:0 4px 16px rgba(0,0,0,.08);font-family:Arial,sans-serif;padding:4mm;overflow:hidden}.a4-v30-page.landscape{width:283mm;height:196mm}.a4-v30-page.portrait{width:196mm;height:283mm}.a4-v30-title{text-align:center;font-family:Georgia,serif;font-size:15pt;font-weight:700;line-height:1.08;margin:0 0 .6mm}.a4-v30-sub{text-align:center;font-size:9pt;margin:0 0 1.5mm}.a4-v30-meta,.a4-v30-table{width:100%;border-collapse:collapse;table-layout:fixed}.a4-v30-meta td{border:1px solid #555;padding:1.2mm 1.3mm;font-size:7.5pt;line-height:1.15}.a4-v30-table{margin-top:0}.a4-v30-table th,.a4-v30-table td{border:1px solid #555;vertical-align:top;white-space:normal;overflow-wrap:anywhere;word-break:normal}.a4-v30-table th{font-size:6.8pt;line-height:1.08;padding:.9mm .55mm;text-align:center}.a4-v30-table td{font-size:7.1pt;line-height:1.13;padding:.95mm .58mm;text-align:center}.a4-v30-table td.left{text-align:left}.a4-v30-table td small{display:block;font-size:5.8pt;line-height:1.1;margin-top:.45mm}.a4-v30-row-subject{display:block;margin-top:.5mm;font-size:6pt;font-weight:700}.a4-v30-page.portrait .a4-v30-title{font-size:13pt}.a4-v30-page.portrait .a4-v30-sub{font-size:8pt}.a4-v30-page.portrait .a4-v30-meta td{font-size:6.6pt;padding:1mm}.a4-v30-page.portrait .a4-v30-table th{font-size:5.4pt;padding:.72mm .35mm}.a4-v30-page.portrait .a4-v30-table td{font-size:5.8pt;padding:.78mm .4mm;line-height:1.1}.a4-v30-page.portrait .a4-v30-table td small{font-size:4.8pt}.a4-v30-page.portrait .a4-v30-row-subject{font-size:5pt}.a4-v30-measure{position:fixed!important;left:-20000px!important;top:0!important;visibility:hidden!important;box-shadow:none!important;border:0!important;z-index:-1!important}
    @media(max-width:760px){.print-report-filter{grid-template-columns:1fr!important}.a4-v30-pages{justify-items:start;overflow:auto}.report-v30-pop{position:fixed;left:14px;right:14px;top:auto;max-height:45vh}}
  `;document.head.appendChild(s)}

  function ensureControls(){
    const filter=q("#reports .print-report-filter");if(!filter)return false;addStyles();
    let old=q("#printReportOrientationLabel");
    if(!q("#reportV30Orientation")){
      const wrap=document.createElement("div");wrap.id="reportV30Orientation";wrap.className="report-v30-multi";
      wrap.innerHTML=`<span>Orientation / Programme</span><button type="button" class="report-v30-button" id="reportV30OrientationBtn"><span id="reportV30OrientationText">${ALL}</span><span>⌄</span></button><div class="report-v30-pop" id="reportV30OrientationPop"></div><select id="printReportOrientation" style="display:none"><option>${ALL}</option></select>`;
      if(old)old.replaceWith(wrap);else{const count=filter.querySelector(".record-count-box");filter.insertBefore(wrap,count||null)}
      q("#reportV30OrientationBtn").onclick=e=>{e.stopPropagation();q("#reportV30OrientationPop")?.classList.toggle("open")};
      document.addEventListener("click",e=>{if(!wrap.contains(e.target))q("#reportV30OrientationPop")?.classList.remove("open")});
    }
    if(!q("#reportV30PageLayout")){
      const label=document.createElement("label");label.id="reportV30PageLayout";label.className="report-v30-layout";label.innerHTML=`Page Layout<select id="reportV30PageSelect"><option value="landscape">A4 Landscape</option><option value="portrait">A4 Portrait</option></select>`;
      const count=filter.querySelector(".record-count-box");filter.insertBefore(label,count||null);q("#reportV30PageSelect").value=pageMode;q("#reportV30PageSelect").onchange=()=>{pageMode=q("#reportV30PageSelect").value||"landscape";REPORT_STATE.pageOrientation=pageMode;renderReports()}
    }
    filter.style.gridTemplateColumns="1.05fr 1.05fr 1.05fr 1.25fr .9fr 110px";
    syncOrientationControl();
    const print=q("#printReportPdf");if(print&&!print.dataset.v30){print.dataset.v30="1";print.onclick=printIsolated}
    return true
  }

  function syncOrientationControl(){
    const values=availableOrientations();
    if(!selected.size)values.forEach(x=>selected.add(x));
    for(const v of [...selected])if(!values.includes(v))selected.delete(v);
    if(!selected.size)values.forEach(x=>selected.add(x));
    const pop=q("#reportV30OrientationPop");if(pop){
      pop.innerHTML=`<label><input type="checkbox" data-all="1" ${selected.size===values.length?"checked":""}> <strong>${ALL}</strong></label>`+values.map(v=>`<label><input type="checkbox" value="${escHtml(v)}" ${selected.has(v)?"checked":""}> ${escHtml(v)}</label>`).join("");
      const allBox=pop.querySelector('[data-all="1"]');if(allBox)allBox.onchange=()=>{selected.clear();if(allBox.checked)values.forEach(x=>selected.add(x));else if(values[0])selected.add(values[0]);REPORT_STATE.orientations=[...selected];syncOrientationControl();renderReports()};
      qa("#reportV30OrientationPop input:not([data-all])").forEach(cb=>cb.onchange=()=>{if(cb.checked)selected.add(cb.value);else selected.delete(cb.value);if(!selected.size)selected.add(cb.value);REPORT_STATE.orientations=[...selected];syncOrientationControl();renderReports()})
    }
    const textNode=q("#reportV30OrientationText");if(textNode)textNode.textContent=orientationLabel();
    const legacy=q("#printReportOrientation");if(legacy){legacy.innerHTML=`<option>${ALL}</option>`;legacy.value=ALL}
    REPORT_STATE.orientation=ALL;REPORT_STATE.orientations=[...selected]
  }

  function submittedAt(r){
    if(!r?.submitted)return"Pending";if(!r.savedAt)return"Submitted";
    const d=new Date(r.savedAt);if(Number.isNaN(d.getTime()))return"Submitted";
    return `Submitted: ${d.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`
  }
  function allSubjects(){const v=q("#printReportSubject")?.value||REPORT_STATE.subject||REPORT_ALL_SUBJECTS;return v===REPORT_ALL_SUBJECTS}
  function classCell(r){const code=r.batch||r.section||"—";return `<b>${escHtml(code)}</b>${allSubjects()?`<span class="a4-v30-row-subject">${escHtml(r.subject||"")}</span>`:""}`}
  function rowHtml(r,index){return `<tr><td>${index}</td><td>${classCell(r)}</td><td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td><td class="left">${escHtml(r.plannedTopic||"—")}</td><td class="left">${escHtml(r.currentTopic||"Not submitted")}</td><td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td class="left">${escHtml(r.reason||"—")}</td><td><b>${escHtml(r.teacher||"—")}</b><small>${escHtml(submittedAt(r))}</small></td></tr>`}
  function colgroup(mode){
    if(mode==="portrait")return `<colgroup><col style="width:4%"><col style="width:8%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:20%"><col style="width:20%"><col style="width:6%"><col style="width:13%"><col style="width:11%"></colgroup>`;
    return `<colgroup><col style="width:3.5%"><col style="width:8%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:20.5%"><col style="width:20.5%"><col style="width:6%"><col style="width:12.5%"><col style="width:10.5%"></colgroup>`
  }
  function metaHtml(page,total){
    const subject=q("#printReportSubject")?.value||REPORT_STATE.subject||REPORT_ALL_SUBJECTS;
    const week=reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd),orient=orientationLabel(),today=reportDateNumeric();
    return `<div class="a4-v30-title">Sri Chaitanya School: Khalsa CBSE Branch</div><div class="a4-v30-sub">Weekly syllabus status</div><table class="a4-v30-meta"><tr><td><b>Subject:</b> ${escHtml(subject)}</td><td><b>Week:</b> ${escHtml(week)}<br><b>Orientation:</b> ${escHtml(orient)}</td><td><b>Date:</b> ${today}<br><b>Page:</b> ${page} of ${total}</td></tr></table>`
  }
  function tableHead(){return `<thead><tr><th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th><th>Topic in Year Plan</th><th>Topic currently being taught</th><th>Lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher / Submitted</th></tr></thead>`}

  function blankMeasurePage(mode){
    const p=document.createElement("div");p.className=`a4-v30-page ${mode} a4-v30-measure`;p.innerHTML=`${metaHtml(99,99)}<table class="a4-v30-table">${colgroup(mode)}${tableHead()}<tbody></tbody></table>`;document.body.appendChild(p);return p
  }
  function paginateMeasured(rows,mode){
    if(!rows?.length)return[[]];
    const groups=[];let group=[],page=blankMeasurePage(mode),body=page.querySelector("tbody");
    const max=page.clientHeight;
    for(let i=0;i<rows.length;i++){
      const holder=document.createElement("tbody");holder.innerHTML=rowHtml(rows[i],i+1);const tr=holder.firstElementChild;body.appendChild(tr);
      const overflow=page.scrollHeight>max+1;
      if(overflow&&group.length){tr.remove();groups.push(group);page.remove();group=[];page=blankMeasurePage(mode);body=page.querySelector("tbody");const h2=document.createElement("tbody");h2.innerHTML=rowHtml(rows[i],i+1);body.appendChild(h2.firstElementChild)}
      group.push(rows[i]);
    }
    if(group.length)groups.push(group);page.remove();return groups
  }
  function pageHtml(rows,page,total,offset,mode){return `<section class="a4-v30-page ${mode}">${metaHtml(page,total)}<table class="a4-v30-table">${colgroup(mode)}${tableHead()}<tbody>${rows.length?rows.map((r,i)=>rowHtml(r,offset+i+1)).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table></section>`}
  function pagesHtml(rows,mode=pageMode){const groups=paginateMeasured(rows||[],mode),total=groups.length;let offset=0;const html=groups.map((g,i)=>{const x=pageHtml(g,i+1,total,offset,mode);offset+=g.length;return x}).join("");return `<div class="a4-v30-pages" data-layout="${mode}">${html}</div>`}

  function printCss(mode){const pageSize=mode==="portrait"?"A4 portrait":"A4 landscape";return `<style>@page{size:${pageSize};margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif}.a4-v30-page{box-sizing:border-box;width:${mode==="portrait"?"196mm":"283mm"};height:${mode==="portrait"?"283mm":"196mm"};padding:4mm;overflow:hidden;color:#000;background:#fff;break-after:page;page-break-after:always}.a4-v30-page:last-child{break-after:auto;page-break-after:auto}.a4-v30-title{text-align:center;font-family:Georgia,serif;font-size:${mode==="portrait"?"13pt":"15pt"};font-weight:700;line-height:1.08;margin:0 0 .6mm}.a4-v30-sub{text-align:center;font-size:${mode==="portrait"?"8pt":"9pt"};margin:0 0 1.5mm}.a4-v30-meta,.a4-v30-table{width:100%;border-collapse:collapse;table-layout:fixed}.a4-v30-meta td{border:1px solid #555;padding:${mode==="portrait"?"1mm":"1.2mm 1.3mm"};font-size:${mode==="portrait"?"6.6pt":"7.5pt"};line-height:1.15}.a4-v30-table th,.a4-v30-table td{border:1px solid #555;vertical-align:top;white-space:normal;overflow-wrap:anywhere;word-break:normal}.a4-v30-table th{font-size:${mode==="portrait"?"5.4pt":"6.8pt"};line-height:1.08;padding:${mode==="portrait"?".72mm .35mm":".9mm .55mm"};text-align:center}.a4-v30-table td{font-size:${mode==="portrait"?"5.8pt":"7.1pt"};line-height:${mode==="portrait"?"1.1":"1.13"};padding:${mode==="portrait"?".78mm .4mm":".95mm .58mm"};text-align:center}.a4-v30-table td.left{text-align:left}.a4-v30-table td small{display:block;font-size:${mode==="portrait"?"4.8pt":"5.8pt"};line-height:1.1;margin-top:.45mm}.a4-v30-row-subject{display:block;margin-top:.5mm;font-size:${mode==="portrait"?"5pt":"6pt"};font-weight:700}tr{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}</style>`}
  function printIsolated(){
    const rows=REPORT_STATE.rows||reportFilteredRows();const html=pagesHtml(rows,pageMode),w=window.open("","_blank");if(!w){alert("Allow pop-ups to print this report.");return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Weekly Syllabus Report</title>${printCss(pageMode)}</head><body>${html}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250)
  }

  function install(){
    if(installed||typeof reportFilteredRows!=="function"||typeof renderReports!=="function"||typeof ensureReportWorkspace!=="function")return false;installed=true;addStyles();baseFiltered=reportFilteredRows;baseRender=renderReports;
    reportFilteredRows=function(){
      const legacy=q("#printReportOrientation");if(legacy){legacy.value=ALL;REPORT_STATE.orientation=ALL}
      let rows=baseFiltered();const allowed=new Set(selectedList());if(allowed.size&&allowed.size<availableOrientations().length)rows=rows.filter(r=>allowed.has(txt(r.program)||orientationForSection(r.section)));REPORT_STATE={...REPORT_STATE,orientation:ALL,orientations:[...selected],pageOrientation:pageMode,rows};return rows
    };
    reportSheetHtml=function(rows){return pagesHtml(rows||[],pageMode)};
    renderReports=function(){REPORT_STATE.orientation=ALL;const r=baseRender();ensureControls();syncOrientationControl();const rows=reportFilteredRows();const count=q("#printReportCount");if(count)count.textContent=rows.length;const prev=q("#weeklyReportPreview");if(prev)prev.innerHTML=reportSheetHtml(rows);return r};
    const oldEnsure=ensureReportWorkspace;ensureReportWorkspace=function(){const r=oldEnsure();ensureControls();return r};
    ensureControls();REPORT_STATE.pageOrientation=pageMode;setTimeout(()=>{try{renderReports()}catch(_){}} ,0);window.__REPORT_A4_V30__=true;return true
  }
  let n=0;const timer=setInterval(()=>{if(install()||++n>80)clearInterval(timer)},100);install()
})();
