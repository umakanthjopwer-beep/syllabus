// Readable A4 landscape weekly report printing.
// Each logical report page must fit on one physical A4 sheet; never shrink text or let a row spill to a hidden extra page.
(function(){
  const MAX_ROWS_PER_PAGE=6;
  function paginate(rows){
    const out=[];
    for(let i=0;i<(rows||[]).length;i+=MAX_ROWS_PER_PAGE)out.push(rows.slice(i,i+MAX_ROWS_PER_PAGE));
    return out.length?out:[[]]
  }
  function isAllSubjects(){
    const live=document.getElementById("printReportSubject")?.value;
    return (live||REPORT_STATE.subject||REPORT_ALL_SUBJECTS)===REPORT_ALL_SUBJECTS
  }
  function submittedAt(r){
    if(!r?.submitted)return"Pending";
    if(!r.savedAt)return"Submitted";
    const d=new Date(r.savedAt);if(Number.isNaN(d.getTime()))return"Submitted";
    return `Submitted: ${d.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`
  }
  function reportClassCode(r){return r.batch||r.section||"—"}
  function subjectLine(r){
    const code=reportClassCode(r);
    if(isAllSubjects())return `<b class="report-row-class">${reportEsc(code)}</b><span class="report-row-subject">${reportEsc(r.subject||"Subject not available")}</span>`;
    return `<b class="report-row-class">${reportEsc(code)}</b>`
  }
  function onePage(rows,page,totalPages,offset){
    const subject=document.getElementById("printReportSubject")?.value||REPORT_STATE.subject||REPORT_ALL_SUBJECTS,week=reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd),today=reportDateNumeric();
    return `<div class="weekly-print-sheet readable-report-page">
      <div class="weekly-paper-title">Sri Chaitanya School: Khalsa CBSE Branch</div>
      <div class="weekly-paper-subtitle">Weekly syllabus status</div>
      <table class="weekly-meta-table"><tr>
        <td><b>Subject:</b> ${reportEsc(subject)}</td>
        <td><b>Week dates:</b> ${reportEsc(week)}</td>
        <td><b>Date:</b> ${today}<br><b>Page:</b> ${page} of ${totalPages}</td>
      </tr></table>
      <table class="weekly-paper-table readable-report-table"><thead><tr>
        <th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th>
        <th>Topic in Year Plan</th><th>Topic currently being taught</th>
        <th>Lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher / Submitted</th>
      </tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr>
        <td>${offset+i+1}</td><td class="report-class-subject-cell">${subjectLine(r)}</td>
        <td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td>
        <td>${reportEsc(r.plannedTopic||"—")}</td><td>${reportEsc(r.currentTopic||"Not submitted")}</td>
        <td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td>${reportEsc(r.reason||"—")}</td>
        <td><b>${reportEsc(r.teacher||"—")}</b><small class="${r.submitted?"submitted":"pending"}">${reportEsc(submittedAt(r))}</small></td>
      </tr>`).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table>
    </div>`
  }

  reportSheetHtml=function(rows){
    const pages=paginate(rows||[]),total=pages.length;
    let offset=0;
    const html=pages.map((p,i)=>{const h=onePage(p,i+1,total,offset);offset+=p.length;return h}).join("");
    return `<div class="readable-report-pages">${html}</div>`
  };

  function styles(){
    if(document.getElementById("readableReportPrintStyles"))return;
    const s=document.createElement("style");s.id="readableReportPrintStyles";s.textContent=`
      .readable-report-pages{display:grid;gap:18px}.readable-report-page{margin-bottom:0!important;box-sizing:border-box!important}
      .report-class-subject-cell{text-align:center!important}.report-row-class{display:block;font-weight:800}.report-row-subject{display:block!important;margin-top:4px!important;font-size:7px!important;line-height:1.2!important;font-weight:800!important;color:#234f86!important}
      .readable-report-table th:nth-child(1){width:3.5%!important}.readable-report-table th:nth-child(2){width:8%!important}.readable-report-table th:nth-child(3){width:6%!important}.readable-report-table th:nth-child(4){width:6%!important}.readable-report-table th:nth-child(5){width:6%!important}.readable-report-table th:nth-child(6){width:20.5%!important}.readable-report-table th:nth-child(7){width:20.5%!important}.readable-report-table th:nth-child(8){width:6%!important}.readable-report-table th:nth-child(9){width:12.5%!important}.readable-report-table th:nth-child(10){width:10.5%!important}
      @media screen{.readable-report-page{width:1120px;max-width:100%;min-width:900px}.report-row-subject{font-size:8px!important}}
      @media print{
        @page{size:A4 landscape;margin:7mm}
        html,body{width:auto!important;height:auto!important;background:#fff!important}
        .readable-report-pages{display:block!important;width:100%!important;margin:0!important;padding:0!important}
        #weeklyReportPreview .readable-report-page{
          position:relative!important;left:auto!important;top:auto!important;
          width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;
          margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;overflow:visible!important;
          break-inside:avoid-page!important;page-break-inside:avoid!important;
          break-after:page!important;page-break-after:always!important;
        }
        #weeklyReportPreview .readable-report-page:last-child{break-after:auto!important;page-break-after:auto!important}
        #weeklyReportPreview .weekly-paper-title{font-size:14pt!important;margin:0 0 1mm!important;line-height:1.1!important}
        #weeklyReportPreview .weekly-paper-subtitle{font-size:9pt!important;margin:0 0 2mm!important;line-height:1.1!important}
        #weeklyReportPreview .weekly-meta-table{margin:0!important}
        #weeklyReportPreview .weekly-meta-table td{font-size:8pt!important;padding:1.4mm 1.7mm!important;line-height:1.18!important}
        #weeklyReportPreview .readable-report-table{margin:0!important;table-layout:fixed!important;width:100%!important}
        #weeklyReportPreview .readable-report-table thead{display:table-header-group!important}
        #weeklyReportPreview .readable-report-table th{font-size:7pt!important;padding:1.3mm .7mm!important;line-height:1.15!important;font-weight:700!important}
        #weeklyReportPreview .readable-report-table td{font-size:8pt!important;padding:1.45mm .8mm!important;line-height:1.22!important;vertical-align:top!important}
        #weeklyReportPreview .readable-report-table td small{font-size:6.4pt!important;margin-top:.8mm!important;line-height:1.2!important}
        #weeklyReportPreview .report-row-subject{display:block!important;font-size:7pt!important;line-height:1.15!important;margin-top:.8mm!important;font-weight:800!important;color:#000!important}
        #weeklyReportPreview .readable-report-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
      }
    `;document.head.appendChild(s)
  }
  styles();
})();