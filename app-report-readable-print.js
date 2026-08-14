// Readable multi-page weekly report printing.
// Keeps All Subjects reports legible by paginating instead of shrinking fonts.
(function(){
  const ROWS_PER_PAGE=8;
  function chunks(rows,size){const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out.length?out:[[]]}
  function isAllSubjects(){
    const live=document.getElementById("printReportSubject")?.value;
    return (live||REPORT_STATE.subject||REPORT_ALL_SUBJECTS)===REPORT_ALL_SUBJECTS
  }
  function subjectLine(r){
    if(isAllSubjects()){
      return `<b class="report-row-class">${reportEsc(r.section)}</b><span class="report-row-subject">${reportEsc(r.subject||"Subject not available")}</span>`
    }
    return `<b class="report-row-class">${reportEsc(r.section)}</b><span class="report-row-batch">${reportEsc(r.batch||r.program||"")}</span>`
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
        <th>Lagging periods</th><th>Reason for lagging</th><th>Teacher</th>
      </tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr>
        <td>${offset+i+1}</td><td class="report-class-subject-cell">${subjectLine(r)}</td>
        <td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td>
        <td>${reportEsc(r.plannedTopic||"—")}</td><td>${reportEsc(r.currentTopic||"Not submitted")}</td>
        <td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td>${reportEsc(r.reason||"—")}</td>
        <td><b>${reportEsc(r.teacher||"—")}</b><small class="${r.submitted?"submitted":"pending"}">${r.submitted?"Digitally submitted":"Pending"}</small></td>
      </tr>`).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table>
    </div>`
  }

  reportSheetHtml=function(rows){
    const pages=chunks(rows||[],ROWS_PER_PAGE),total=pages.length;
    return `<div class="readable-report-pages">${pages.map((p,i)=>onePage(p,i+1,total,i*ROWS_PER_PAGE)).join("")}</div>`
  };

  function styles(){
    if(document.getElementById("readableReportPrintStyles"))return;
    const s=document.createElement("style");s.id="readableReportPrintStyles";s.textContent=`
      .readable-report-pages{display:grid;gap:18px}.readable-report-page{margin-bottom:0!important}
      .report-class-subject-cell{text-align:center!important}.report-row-class{display:block;font-weight:800}.report-row-subject{display:block!important;margin-top:4px!important;font-size:7px!important;line-height:1.2!important;font-weight:800!important;color:#234f86!important}.report-row-batch{display:block!important;margin-top:3px!important;font-size:6.3px!important;color:#65758a!important}
      .readable-report-table th:nth-child(1){width:3.5%!important}.readable-report-table th:nth-child(2){width:8%!important}.readable-report-table th:nth-child(3){width:6%!important}.readable-report-table th:nth-child(4){width:6%!important}.readable-report-table th:nth-child(5){width:6%!important}.readable-report-table th:nth-child(6){width:21%!important}.readable-report-table th:nth-child(7){width:21%!important}.readable-report-table th:nth-child(8){width:6%!important}.readable-report-table th:nth-child(9){width:13%!important}.readable-report-table th:nth-child(10){width:9.5%!important}
      @media screen{.readable-report-page{width:1120px;max-width:100%;min-width:900px}.report-row-subject{font-size:8px!important}}
      @media print{
        @page{size:A4 landscape;margin:7mm}
        body{background:#fff!important}
        .readable-report-pages{display:block!important}
        #weeklyReportPreview .readable-report-page{position:relative!important;left:auto!important;top:auto!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;break-after:page!important;page-break-after:always!important}
        #weeklyReportPreview .readable-report-page:last-child{break-after:auto!important;page-break-after:auto!important}
        #weeklyReportPreview .weekly-paper-title{font-size:14pt!important;margin:0 0 1mm!important}
        #weeklyReportPreview .weekly-paper-subtitle{font-size:9pt!important;margin:0 0 3mm!important}
        #weeklyReportPreview .weekly-meta-table td{font-size:8pt!important;padding:1.6mm 2mm!important;line-height:1.25!important}
        #weeklyReportPreview .readable-report-table th{font-size:7pt!important;padding:1.5mm .8mm!important;line-height:1.2!important;font-weight:700!important}
        #weeklyReportPreview .readable-report-table td{font-size:8pt!important;padding:1.7mm .9mm!important;line-height:1.3!important;vertical-align:top!important}
        #weeklyReportPreview .readable-report-table td small{font-size:6.7pt!important;margin-top:1mm!important;line-height:1.2!important}
        #weeklyReportPreview .report-row-subject{display:block!important;font-size:7pt!important;line-height:1.2!important;margin-top:1mm!important;font-weight:800!important;color:#000!important}
        #weeklyReportPreview .report-row-batch{display:block!important;font-size:6.3pt!important;line-height:1.2!important;margin-top:.8mm!important;color:#000!important}
        #weeklyReportPreview .readable-report-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
      }
    `;document.head.appendChild(s)
  }
  styles();
})();