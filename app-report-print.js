const REPORT_ALL_SUBJECTS="All subjects";
const REPORT_ALL_STATUSES="All statuses";
let REPORT_STATE={weekStart:"",weekEnd:"",weekLabel:"",subject:REPORT_ALL_SUBJECTS,status:REPORT_ALL_STATUSES,rows:[]};

function reportEsc(v=""){return esc(String(v??""))}
function reportDate(iso){
  if(!iso)return"";const d=new Date(iso+"T00:00:00");
  return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
}
function reportDateNumeric(d=new Date()){
  return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}).replaceAll("/","-")
}
function reportWeekLabel(start,end){return`${reportDate(start)} to ${reportDate(end)}`}
function reportCurrentMonday(){
  const d=new Date(),day=d.getDay(),back=(day+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-back);return isoDate(d)
}
function reportAccessibleMappings(){
  if(!currentUser)return[];
  let rows=[];
  if(currentUser.role==="Teacher"&&typeof ownTeacherMappings==="function")rows=ownTeacherMappings();
  else if(currentUser.role==="HOD"){
    const ds=new Set(userDepartments());rows=(data.setup?.handlingMappings||[]).filter(m=>m.activeForSyllabus&&ds.has(m.department));
  }else if(isAdmin())rows=(data.setup?.handlingMappings||[]).filter(m=>m.activeForSyllabus);
  else rows=[];
  const seen=new Set();return rows.filter(m=>{const k=[m.section,canonicalSubject(m.subject),m.teacher].join("|");if(seen.has(k))return false;seen.add(k);return true})
}
function reportWeekOptions(){
  const map=new Map();
  for(const m of reportAccessibleMappings()){
    if(typeof planRowsFor!=="function"||typeof calendarWeeksForRows!=="function")continue;
    const {rows}=planRowsFor(m.section,canonicalSubject(m.subject));
    for(const w of calendarWeeksForRows(rows||[]))map.set(w.start,w)
  }
  for(const r of visibleWeekly()){
    if(!r.startDate)continue;const w=calendarWeekForDate(r.startDate);map.set(w.start,w)
  }
  return[...map.values()].sort((a,b)=>a.start.localeCompare(b.start))
}
function reportSavedFor(m,start,end){
  return visibleWeekly().filter(r=>r.section===m.section&&canonicalSubject(r.subject)===canonicalSubject(m.subject)&&r.startDate&&overlaps(r.startDate,r.endDate||r.startDate,start,end)).sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0]||null
}
function reportRowsForWeek(start,end){
  const out=[];
  for(const m of reportAccessibleMappings()){
    const subject=canonicalSubject(m.subject),source=typeof planRowsFor==="function"?planRowsFor(m.section,subject):{plan:null,rows:[]};
    const agg=typeof aggregateWeek==="function"?aggregateWeek(source.rows||[],start,end):{matched:[],topic:"",workingDays:null,plannedPeriods:null};
    const saved=reportSavedFor(m,start,end);
    if(!agg.matched?.length&&!saved)continue;
    const meta=sectionMeta(m.section),lag=saved?Number(saved.lagPeriods||0):null;
    out.push({
      section:m.section,batch:meta.batch||meta.program||"",program:meta.program||"",subject,teacher:m.teacher||saved?.teacher||"",
      workingDays:agg.workingDays??saved?.workingDays??null,plannedPeriods:agg.plannedPeriods??saved?.plannedPeriods??null,
      plannedTopic:agg.topic||saved?.planned||"Year Plan topic not available",periodsTaken:saved?.takenPeriods??null,
      currentTopic:saved?.actual||"Not submitted",lagPeriods:lag,reason:saved?.reason||"—",submitted:!!saved,
      status:!saved?"Pending":lag>0?"Lagging":"On Track",savedAt:saved?.savedAt||""
    })
  }
  return out.sort((a,b)=>Number(sectionMeta(a.section).grade||0)-Number(sectionMeta(b.section).grade||0)||a.section.localeCompare(b.section)||a.subject.localeCompare(b.subject))
}
function reportFilteredRows(){
  let rows=reportRowsForWeek(REPORT_STATE.weekStart,REPORT_STATE.weekEnd);
  const subject=document.getElementById("printReportSubject")?.value||REPORT_ALL_SUBJECTS,status=document.getElementById("printReportStatus")?.value||REPORT_ALL_STATUSES;
  if(subject!==REPORT_ALL_SUBJECTS)rows=rows.filter(r=>r.subject===subject);
  if(status==="Submitted")rows=rows.filter(r=>r.submitted);
  if(status==="Pending")rows=rows.filter(r=>!r.submitted);
  if(status==="Lagging")rows=rows.filter(r=>r.submitted&&r.lagPeriods>0);
  if(status==="On Track")rows=rows.filter(r=>r.submitted&&r.lagPeriods===0);
  REPORT_STATE={...REPORT_STATE,subject,status,rows};return rows
}
function reportSubjects(){return[...new Set(reportAccessibleMappings().map(m=>canonicalSubject(m.subject)).filter(Boolean))].sort()}
function reportSheetClass(n){return n>24?"ultra":n>15?"compact":""}
function reportSheetHtml(rows){
  const subject=REPORT_STATE.subject||REPORT_ALL_SUBJECTS,week=reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd),today=reportDateNumeric();
  return`<div id="weeklyPrintSheet" class="weekly-print-sheet ${reportSheetClass(rows.length)}">
    <div class="weekly-paper-title">Sri Chaitanya School: Khalsa CBSE Branch</div>
    <div class="weekly-paper-subtitle">Weekly syllabus status</div>
    <table class="weekly-meta-table"><tr><td><b>Subject:</b> ${reportEsc(subject)}</td><td><b>Week dates:</b> ${reportEsc(week)}</td><td><b>Date:</b> ${today}</td></tr></table>
    <table class="weekly-paper-table"><thead><tr>
      <th>S.No</th><th>Class/Sec</th><th>Working days</th><th>Planned periods</th><th>Periods taken</th>
      <th>Write the topic in the year plan as of today.</th><th>The topic currently being taught in the classroom</th>
      <th>No. of lagging periods</th><th>Reason for lagging</th><th>Sign of Teacher</th>
    </tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr>
      <td>${i+1}</td><td><b>${reportEsc(r.section)}</b><small>${reportEsc(r.batch||r.program)}</small></td>
      <td>${r.workingDays??"—"}</td><td>${r.plannedPeriods??"—"}</td><td>${r.periodsTaken??"—"}</td>
      <td>${reportEsc(r.plannedTopic||"—")}</td><td>${reportEsc(r.currentTopic||"Not submitted")}</td>
      <td>${r.lagPeriods==null?"—":r.lagPeriods}</td><td>${reportEsc(r.reason||"—")}</td>
      <td><b>${reportEsc(r.teacher||"—")}</b><small class="${r.submitted?"submitted":"pending"}">${r.submitted?"Digitally submitted":"Pending"}</small></td>
    </tr>`).join(""):`<tr><td colspan="10">No records available for the selected filters.</td></tr>`}</tbody></table>
  </div>`
}
function ensurePrintReportStyles(){
  if(document.getElementById("weeklyReportPrintStyles"))return;const s=document.createElement("style");s.id="weeklyReportPrintStyles";s.textContent=`
  .print-report-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px}.print-report-head h2{font-size:26px;margin:5px 0}.print-report-head p{margin:0;color:#7f8a9d;font-size:12px}.print-report-actions{display:flex;gap:10px}.print-report-filter{display:grid;grid-template-columns:1.1fr 1.1fr 1.1fr 110px;gap:12px;align-items:end}.print-report-filter label{display:grid;gap:7px;font-size:9px;letter-spacing:.6px;font-weight:800;color:#74839a;text-transform:uppercase}.print-report-filter select{width:100%;border:1px solid #ccd6e4;border-radius:10px;padding:11px;background:#fff;color:#172235}.record-count-box{border-left:1px solid #e0e6ef;padding-left:18px}.record-count-box small{display:block;font-size:9px;color:#8090a5;text-transform:uppercase;font-weight:800;letter-spacing:.6px}.record-count-box b{display:block;font-size:24px;margin-top:9px}.weekly-report-preview{padding:14px 0 0;overflow:auto}.weekly-print-sheet{width:1120px;max-width:100%;min-width:900px;margin:0 auto;background:#fff;border:1px solid #cfd5dc;padding:24px 20px 30px;color:#000;box-shadow:0 5px 18px rgba(0,0,0,.06);font-family:Arial,sans-serif}.weekly-paper-title{text-align:center;font-family:Georgia,serif;font-weight:700;font-size:18px}.weekly-paper-subtitle{text-align:center;font-size:12px;margin:8px 0 14px}.weekly-meta-table,.weekly-paper-table{width:100%;border-collapse:collapse;min-width:0}.weekly-meta-table td{border:1px solid #555;padding:6px 8px;font-size:9px}.weekly-meta-table td:nth-child(1){width:34%}.weekly-meta-table td:nth-child(2){width:36%}.weekly-paper-table th,.weekly-paper-table td{border:1px solid #555;padding:7px 6px;text-align:center;vertical-align:middle;font-size:7.5px;line-height:1.35;text-transform:none;letter-spacing:0;color:#000;background:#fff;position:static}.weekly-paper-table th{font-weight:700;font-size:6.5px}.weekly-paper-table th:nth-child(1){width:4%}.weekly-paper-table th:nth-child(2){width:8%}.weekly-paper-table th:nth-child(3){width:7%}.weekly-paper-table th:nth-child(4){width:7%}.weekly-paper-table th:nth-child(5){width:7%}.weekly-paper-table th:nth-child(6){width:19%}.weekly-paper-table th:nth-child(7){width:19%}.weekly-paper-table th:nth-child(8){width:8%}.weekly-paper-table th:nth-child(9){width:12%}.weekly-paper-table th:nth-child(10){width:9%}.weekly-paper-table td small{display:block;font-size:6.3px;margin-top:3px}.weekly-paper-table .submitted{color:#315f9a}.weekly-paper-table .pending{color:#8f6d24}.weekly-print-sheet.compact .weekly-paper-table th,.weekly-print-sheet.compact .weekly-paper-table td{padding:5px 4px;font-size:6.7px}.weekly-print-sheet.ultra .weekly-paper-table th,.weekly-print-sheet.ultra .weekly-paper-table td{padding:3px 3px;font-size:5.7px}.weekly-print-sheet.ultra{padding:14px}.weekly-print-sheet.ultra .weekly-paper-title{font-size:15px}.weekly-print-sheet.ultra .weekly-paper-subtitle{margin:5px 0 8px}
  @media(max-width:760px){.print-report-head{align-items:flex-start;flex-direction:column}.print-report-actions{width:100%}.print-report-actions button{flex:1}.print-report-filter{grid-template-columns:1fr}.record-count-box{border-left:0;border-top:1px solid #e0e6ef;padding:10px 0 0;display:flex;align-items:center;justify-content:space-between}.record-count-box b{margin:0}.weekly-report-preview{margin-left:-14px;margin-right:-14px;padding-left:14px}.weekly-print-sheet{max-width:none}}
  @media print{@page{size:A4 landscape;margin:5mm}body{background:#fff!important}body *{visibility:hidden!important}.weekly-print-sheet,.weekly-print-sheet *{visibility:visible!important}.weekly-print-sheet{position:absolute!important;left:0!important;top:0!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}.weekly-paper-title{font-size:13pt}.weekly-paper-subtitle{font-size:8pt;margin:2mm 0 3mm}.weekly-meta-table td{font-size:6.5pt;padding:1.4mm}.weekly-paper-table th{font-size:5.3pt;padding:1.2mm .8mm}.weekly-paper-table td{font-size:5.8pt;padding:1.4mm .8mm;line-height:1.2}.weekly-paper-table td small{font-size:4.8pt}.weekly-print-sheet.compact .weekly-paper-table th,.weekly-print-sheet.compact .weekly-paper-table td{font-size:5pt;padding:.9mm .6mm}.weekly-print-sheet.ultra .weekly-paper-table th,.weekly-print-sheet.ultra .weekly-paper-table td{font-size:4.1pt;padding:.55mm .4mm}}
  `;document.head.appendChild(s)
}
function ensureReportWorkspace(){
  const sec=document.getElementById("reports");if(!sec)return;
  if(!document.getElementById("printReportWeek")){
    sec.innerHTML=`<div class="print-report-head"><div><div class="eyebrow blue-text">REPORTS</div><h2>Print and export weekly reports</h2><p>The subject report follows the Weekly Syllabus Status format.</p></div><div class="print-report-actions"><button id="printReportExcel" class="outline-btn">↓ Export Excel</button><button id="printReportPdf" class="primary">Print / Save PDF</button></div></div>
    <div class="panel"><div class="print-report-filter"><label>Reporting Week<select id="printReportWeek"></select></label><label>Subject<select id="printReportSubject"></select></label><label>Status Included<select id="printReportStatus"><option>${REPORT_ALL_STATUSES}</option><option>Submitted</option><option>Pending</option><option>Lagging</option><option>On Track</option></select></label><div class="record-count-box"><small>Records in report</small><b id="printReportCount">0</b></div></div></div><div id="weeklyReportPreview" class="weekly-report-preview"></div>`;
    document.getElementById("printReportWeek").onchange=()=>{const op=document.getElementById("printReportWeek").selectedOptions[0];REPORT_STATE.weekStart=op?.dataset.start||"";REPORT_STATE.weekEnd=op?.dataset.end||"";REPORT_STATE.weekLabel=op?.value||"";renderReports()};
    document.getElementById("printReportSubject").onchange=renderReports;document.getElementById("printReportStatus").onchange=renderReports;
    document.getElementById("printReportPdf").onclick=()=>window.print();document.getElementById("printReportExcel").onclick=exportWeeklyReportExcel
  }
  ensurePrintReportStyles()
}
renderReports=function(){
  ensureReportWorkspace();const weekSel=document.getElementById("printReportWeek"),subjectSel=document.getElementById("printReportSubject");if(!weekSel||!subjectSel)return;
  const weeks=reportWeekOptions(),old=REPORT_STATE.weekStart||weekSel.selectedOptions?.[0]?.dataset.start||"",current=reportCurrentMonday();
  weekSel.innerHTML=weeks.length?weeks.map(w=>`<option value="${reportEsc(reportWeekLabel(w.start,w.end))}" data-start="${w.start}" data-end="${w.end}">${reportEsc(reportWeekLabel(w.start,w.end))}</option>`).join(""):'<option>No reporting weeks available</option>';
  const preferred=weeks.find(w=>w.start===old)||weeks.find(w=>w.start===current)||weeks[0];if(preferred){weekSel.value=reportWeekLabel(preferred.start,preferred.end);REPORT_STATE.weekStart=preferred.start;REPORT_STATE.weekEnd=preferred.end;REPORT_STATE.weekLabel=weekSel.value}
  const subjects=[REPORT_ALL_SUBJECTS,...reportSubjects()],oldSub=REPORT_STATE.subject||subjectSel.value||REPORT_ALL_SUBJECTS;subjectSel.innerHTML=subjects.map(x=>`<option value="${reportEsc(x)}">${reportEsc(x)}</option>`).join("");subjectSel.value=subjects.includes(oldSub)?oldSub:REPORT_ALL_SUBJECTS;
  const statusSel=document.getElementById("printReportStatus");if(REPORT_STATE.status&&[...statusSel.options].some(o=>o.value===REPORT_STATE.status))statusSel.value=REPORT_STATE.status;
  const rows=reportFilteredRows();document.getElementById("printReportCount").textContent=rows.length;document.getElementById("weeklyReportPreview").innerHTML=reportSheetHtml(rows)
};
function exportWeeklyReportExcel(){
  const rows=REPORT_STATE.rows||reportFilteredRows();if(!window.XLSX){alert("Excel export library is unavailable.");return}
  const title=[["Sri Chaitanya School: Khalsa CBSE Branch"],["Weekly syllabus status"],[`Subject: ${REPORT_STATE.subject}`,`Week dates: ${reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd)}`,`Date: ${reportDateNumeric()}`],[],["S.No","Class/Sec","Working days","Planned periods","Periods taken","Write the topic in the year plan as of today.","The topic currently being taught in the classroom","No. of lagging periods","Reason for lagging","Sign of Teacher"]];
  rows.forEach((r,i)=>title.push([i+1,`${r.section}${r.batch?" - "+r.batch:""}`,r.workingDays??"",r.plannedPeriods??"",r.periodsTaken??"",r.plannedTopic,r.currentTopic,r.lagPeriods??"",r.reason,`${r.teacher} - ${r.submitted?"Digitally submitted":"Pending"}`]));
  const ws=XLSX.utils.aoa_to_sheet(title);ws["!cols"]=[{wch:6},{wch:14},{wch:12},{wch:13},{wch:12},{wch:38},{wch:38},{wch:14},{wch:28},{wch:20}];ws["!merges"]=[XLSX.utils.decode_range("A1:J1"),XLSX.utils.decode_range("A2:J2")];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Weekly Status");XLSX.writeFile(wb,`Khalsa_Weekly_Syllabus_${REPORT_STATE.weekStart||"Report"}.xlsx`)
}
const _reportPrintInit=init;
init=function(){_reportPrintInit();ensurePrintReportStyles();ensureReportWorkspace();renderReports()};