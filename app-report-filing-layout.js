function ensureReportFilingStyles(){
  if(document.getElementById("weeklyReportFilingStyles"))return;
  const s=document.createElement("style");
  s.id="weeklyReportFilingStyles";
  s.textContent=`
  .weekly-meta-table,.weekly-paper-table{table-layout:fixed}
  .weekly-meta-table td,.weekly-paper-table th,.weekly-paper-table td{white-space:normal;overflow-wrap:anywhere;word-break:normal}
  .weekly-paper-table th{font-size:7px;line-height:1.2}
  .weekly-paper-table td:nth-child(6),.weekly-paper-table td:nth-child(7),.weekly-paper-table td:nth-child(9){text-align:left}
  @media print{
    @page{size:A4 landscape;margin:8mm 7mm 8mm 19mm}
    html,body{background:#fff!important}
    .weekly-print-sheet{position:absolute!important;left:0!important;top:0!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;box-sizing:border-box!important}
    .weekly-paper-title{font-size:14pt!important;line-height:1.15!important;margin:0!important}
    .weekly-paper-subtitle{font-size:9pt!important;line-height:1.15!important;margin:1.5mm 0 3mm!important}
    .weekly-meta-table{table-layout:fixed!important;margin-bottom:0!important}
    .weekly-meta-table td{font-size:7.2pt!important;line-height:1.2!important;padding:1.5mm 1.4mm!important;vertical-align:middle!important}
    .weekly-paper-table{table-layout:fixed!important;width:100%!important}
    .weekly-paper-table thead{display:table-header-group!important}
    .weekly-paper-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
    .weekly-paper-table th{font-size:7pt!important;line-height:1.15!important;padding:1.35mm .65mm!important;font-weight:700!important;vertical-align:middle!important;white-space:normal!important;overflow-wrap:anywhere!important}
    .weekly-paper-table td{font-size:6.8pt!important;line-height:1.22!important;padding:1.25mm .65mm!important;vertical-align:middle!important;white-space:normal!important;overflow-wrap:anywhere!important}
    .weekly-paper-table td small{font-size:5.8pt!important;margin-top:.7mm!important}
    .weekly-print-sheet.compact .weekly-paper-table th,.weekly-print-sheet.ultra .weekly-paper-table th{font-size:7pt!important;padding:1.35mm .65mm!important}
    .weekly-print-sheet.compact .weekly-paper-table td,.weekly-print-sheet.ultra .weekly-paper-table td{font-size:6.8pt!important;padding:1.25mm .65mm!important}
    .weekly-print-sheet.ultra{padding:0!important}
  }
  `;
  document.head.appendChild(s)
}

reportSheetHtml=function(rows){
  const subject=REPORT_STATE.subject||REPORT_ALL_SUBJECTS,week=reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd),today=reportDateNumeric();
  return`<div id="weeklyPrintSheet" class="weekly-print-sheet ${reportSheetClass(rows.length)}">
    <div class="weekly-paper-title">Sri Chaitanya School: Khalsa CBSE Branch</div>
    <div class="weekly-paper-subtitle">Weekly syllabus status</div>
    <table class="weekly-meta-table">
      <colgroup><col style="width:32%"><col style="width:42%"><col style="width:26%"></colgroup>
      <tr><td><b>Subject:</b> ${reportEsc(subject)}</td><td><b>Week dates:</b> ${reportEsc(week)}</td><td><b>Date:</b> ${today}</td></tr>
    </table>
    <table class="weekly-paper-table">
      <colgroup>
        <col style="width:3.5%"><col style="width:7.5%"><col style="width:6%"><col style="width:6.5%"><col style="width:6.5%">
        <col style="width:22%"><col style="width:22%"><col style="width:7%"><col style="width:11%"><col style="width:8%">
      </colgroup>
      <thead><tr>
        <th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th>
        <th>Write the topic in the year plan as of today.</th><th>The topic currently being taught in the classroom</th>
        <th>No. of lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher</th>
      </tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr>
        <td>${i+1}</td><td><b>${reportEsc(r.section)}</b><small>${reportEsc(r.batch||r.program)}</small></td>
        <td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td>
        <td>${reportEsc(r.plannedTopic||"—")}</td><td>${reportEsc(r.currentTopic||"Not submitted")}</td>
        <td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td>${reportEsc(r.reason||"—")}</td>
        <td><b>${reportEsc(r.teacher||"—")}</b><small class="${r.submitted?"submitted":"pending"}">${r.submitted?"Digitally submitted":"Pending"}</small></td>
      </tr>`).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody>
    </table>
  </div>`
};

function excelCellStyle(base={}){
  const thin={style:"thin",color:{rgb:"777777"}};
  return{
    font:{name:"Arial",sz:10,color:{rgb:"000000"},...(base.font||{})},
    alignment:{vertical:"center",horizontal:"center",wrapText:true,...(base.alignment||{})},
    border:{top:thin,bottom:thin,left:thin,right:thin},
    ...(base.fill?{fill:base.fill}:{}),
    ...(base.numFmt?{numFmt:base.numFmt}:{})
  }
}
function styleExcelRange(ws,r1,c1,r2,c2,style){
  for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){
    const a=XLSX.utils.encode_cell({r,c});if(ws[a])ws[a].s=style
  }
}

exportWeeklyReportExcel=function(){
  const rows=REPORT_STATE.rows||reportFilteredRows();if(!window.XLSX){alert("Excel export library is unavailable.");return}
  const subject=`Subject: ${REPORT_STATE.subject||REPORT_ALL_SUBJECTS}`;
  const week=`Week dates: ${reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd)}`;
  const date=`Date: ${reportDateNumeric()}`;
  const sheetData=[
    ["Sri Chaitanya School: Khalsa CBSE Branch"],
    ["Weekly syllabus status"],
    [subject,"","",week,"","","",date,"",""],
    ["S.No","Class/Sec","Working days","Planned periods","Periods taken","Write the topic in the year plan as of today.","The topic currently being taught in the classroom","No. of lagging periods","Reason for lagging","Sign of Teacher"]
  ];
  rows.forEach((r,i)=>sheetData.push([i+1,`${r.section}${r.batch?" - "+r.batch:""}`,r.workingDays??"",r.plannedPeriods??"",r.periodsTaken??"",r.plannedTopic||"",r.currentTopic||"",r.lagPeriods??"",r.reason||"",`${r.teacher||""}${r.teacher?" - ":""}${r.submitted?"Digitally submitted":"Pending"}`]));
  const ws=XLSX.utils.aoa_to_sheet(sheetData);
  ws["!merges"]=[
    XLSX.utils.decode_range("A1:J1"),XLSX.utils.decode_range("A2:J2"),
    XLSX.utils.decode_range("A3:C3"),XLSX.utils.decode_range("D3:G3"),XLSX.utils.decode_range("H3:J3")
  ];
  ws["!cols"]=[
    {wch:4.5},  // S.No
    {wch:11},   // Class/Sec
    {wch:8},    // Working days
    {wch:9},    // Planned periods
    {wch:9},    // Periods taken
    {wch:42},   // Year plan topic
    {wch:42},   // Current classroom topic
    {wch:10},   // Lagging periods
    {wch:24},   // Reason
    {wch:18}    // Teacher/sign
  ];
  ws["!rows"]=[{hpt:26},{hpt:22},{hpt:24},{hpt:48},...rows.map(r=>({hpt:Math.max(24,Math.min(64,18+Math.ceil(Math.max(String(r.plannedTopic||"").length,String(r.currentTopic||"").length,String(r.reason||"").length)/44)*8))}))];
  ws["!margins"]={left:0.75,right:0.28,top:0.35,bottom:0.35,header:0.2,footer:0.2};
  ws["!pageSetup"]={orientation:"landscape",paperSize:9,fitToWidth:1,fitToHeight:0};
  ws["!sheetPr"]={pageSetUpPr:{fitToPage:true}};

  const titleStyle=excelCellStyle({font:{bold:true,sz:14},alignment:{horizontal:"center",vertical:"center",wrapText:true}});
  const subtitleStyle=excelCellStyle({font:{bold:true,sz:11},alignment:{horizontal:"center",vertical:"center",wrapText:true}});
  const metaStyle=excelCellStyle({font:{bold:true,sz:10},alignment:{horizontal:"left",vertical:"center",wrapText:true}});
  const headStyle=excelCellStyle({font:{bold:true,sz:9},alignment:{horizontal:"center",vertical:"center",wrapText:true},fill:{fgColor:{rgb:"E9EEF5"},patternType:"solid"}});
  const bodyStyle=excelCellStyle({font:{sz:9},alignment:{horizontal:"center",vertical:"center",wrapText:true}});
  const textStyle=excelCellStyle({font:{sz:9},alignment:{horizontal:"left",vertical:"center",wrapText:true}});

  if(ws.A1)ws.A1.s=titleStyle;if(ws.A2)ws.A2.s=subtitleStyle;
  ["A3","D3","H3"].forEach(a=>{if(ws[a])ws[a].s=metaStyle});
  styleExcelRange(ws,3,0,3,9,headStyle);
  if(rows.length){styleExcelRange(ws,4,0,3+rows.length,9,bodyStyle);for(let r=4;r<=3+rows.length;r++)for(const c of [5,6,8]){const a=XLSX.utils.encode_cell({r,c});if(ws[a])ws[a].s=textStyle}}

  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Weekly Status");
  wb.Workbook=wb.Workbook||{};wb.Workbook.Names=wb.Workbook.Names||[];
  wb.Workbook.Names.push({Name:"_xlnm.Print_Area",Sheet:0,Ref:`'Weekly Status'!$A$1:$J$${sheetData.length}`});
  wb.Workbook.Names.push({Name:"_xlnm.Print_Titles",Sheet:0,Ref:"'Weekly Status'!$1:$4"});
  XLSX.writeFile(wb,`Khalsa_Weekly_Syllabus_${REPORT_STATE.weekStart||"Report"}.xlsx`,{cellStyles:true,compression:true})
};

const _reportFilingInit=init;
init=function(){_reportFilingInit();ensureReportFilingStyles()};
