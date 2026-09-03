// Weekly Reports v46: Excel layout choices, AutoFilters and frozen report headers.
(function(){
  const state=window.__REPORT_EXCEL_LAYOUT_V46__||{layout:"single"};
  window.__REPORT_EXCEL_LAYOUT_V46__=state;
  let excelJsPromise=null;

  function ensureExcelJs(){
    if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
    if(excelJsPromise)return excelJsPromise;
    excelJsPromise=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
      script.async=true;
      script.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error("Excel export library did not load."));
      script.onerror=()=>reject(new Error("Unable to load the Excel export library."));
      document.head.appendChild(script)
    });
    return excelJsPromise
  }

  function text(value){return String(value??"").trim()}
  function orientationFor(row){
    if(text(row?.program))return text(row.program);
    try{const meta=sectionMeta(row?.section);return text(meta?.program||meta?.orientation)}catch(_){return""}
  }
  function classCode(row){return text(row?.batch||row?.section)}
  function rowStatus(row){
    if(!row?.submitted)return"Pending";
    return Number(row?.lagPeriods||0)>0?"Lagging":"On Track"
  }
  function submittedDetail(row){
    if(!row?.submitted)return"Pending";
    if(!row.savedAt)return"Submitted";
    const date=new Date(row.savedAt);
    if(Number.isNaN(date.getTime()))return"Submitted";
    return `Submitted: ${date.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`
  }
  function safeSheetName(value,fallback){
    const cleaned=text(value).replace(/[\\/?*:[\]]/g," ").replace(/\s+/g," ").trim();
    return(cleaned||fallback||"Report").slice(0,31)
  }
  function uniqueSheetName(workbook,value,fallback){
    const base=safeSheetName(value,fallback);let name=base,n=2;
    while(workbook.getWorksheet(name)){const suffix=` (${n++})`;name=base.slice(0,31-suffix.length)+suffix}
    return name
  }
  function downloadBuffer(buffer,fileName){
    const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)
  }
  function selectedMeta(){
    const meta=window.__REPORT_FILTER_META_V43__||{};
    return{
      subjects:meta.subject||REPORT_STATE.subject||"All subjects",
      classes:meta.classes||"All classes",
      orientations:meta.orientation||REPORT_STATE.orientation||"All orientations",
      statuses:meta.status||REPORT_STATE.status||"All statuses",
      sort:meta.sort==="subject"?"Subject wise":"Class wise"
    }
  }
  function groupsFor(rows){
    if(state.layout==="subject"){
      const groups=new Map();rows.forEach(row=>{const key=text(row.subject)||"No Subject";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)});return[...groups]
    }
    if(state.layout==="class"){
      const groups=new Map();rows.forEach(row=>{const key=classCode(row)||"No Class";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)});return[...groups]
    }
    return[["Weekly Status",rows]]
  }
  function addSheet(workbook,name,rows,meta){
    const ws=workbook.addWorksheet(uniqueSheetName(workbook,name,"Weekly Status"),{
      views:[{state:"frozen",xSplit:0,ySplit:4,topLeftCell:"A5",activeCell:"A5"}],
      pageSetup:{paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.5,bottom:.35,header:.2,footer:.2}}
    });
    const headers=["S.No","Class/Section","Subject","Orientation/Programme","Teacher","Working Days","Planned Periods","Periods Taken","Planned Topic / Year Plan","Current Topic","Lagging Periods","Reason for Lagging","Status / Submission"];
    ws.addRow(["Sri Chaitanya School: Khalsa CBSE Branch"]);ws.mergeCells("A1:M1");
    ws.addRow(["Weekly syllabus status"]);ws.mergeCells("A2:M2");
    ws.addRow([`Subjects: ${meta.subjects}`,"","",`Reporting Week: ${reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd)}`,"","","","",`Filters: ${meta.classes} | ${meta.orientations} | ${meta.statuses} | Sort: ${meta.sort}`]);
    ws.mergeCells("A3:C3");ws.mergeCells("D3:H3");ws.mergeCells("I3:M3");
    ws.addRow(headers);
    rows.forEach((row,index)=>ws.addRow([
      index+1,classCode(row),text(row.subject),orientationFor(row),text(row.teacher),row.workingDays??"",row.plannedPeriods??"",row.periodsTaken??"",text(row.plannedTopic),text(row.currentTopic),row.lagPeriods??"",text(row.reason),`${rowStatus(row)}\n${submittedDetail(row)}`
    ]));

    ws.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,4+rows.length),column:13}};
    ws.columns=[6,15,18,21,22,12,14,13,45,45,15,30,25].map(width=>({width}));
    ws.getRow(1).height=27;ws.getRow(2).height=23;ws.getRow(3).height=32;ws.getRow(4).height=42;
    const border={top:{style:"thin",color:{argb:"FF5F6368"}},left:{style:"thin",color:{argb:"FF5F6368"}},bottom:{style:"thin",color:{argb:"FF5F6368"}},right:{style:"thin",color:{argb:"FF5F6368"}}};
    ws.eachRow((row,rowNumber)=>{
      row.eachCell({includeEmpty:true},(cell,columnNumber)=>{
        cell.border=border;cell.alignment={vertical:"middle",horizontal:[9,10,12].includes(columnNumber)?"left":"center",wrapText:true};cell.font={name:"Arial",size:rowNumber<=2?11:9,bold:rowNumber<=4}
      });
      if(rowNumber>=5)row.height=Math.max(30,Math.min(85,28+Math.ceil(Math.max(text(rows[rowNumber-5]?.plannedTopic).length,text(rows[rowNumber-5]?.currentTopic).length,text(rows[rowNumber-5]?.reason).length)/50)*9))
    });
    ws.getCell("A1").font={name:"Arial",size:14,bold:true};ws.getCell("A2").font={name:"Arial",size:11,bold:true};
    ws.getRow(4).eachCell(cell=>{cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE9EEF5"}};cell.font={name:"Arial",size:9,bold:true}});
    ws.headerFooter.oddFooter="Page &P of &N";
    ws.pageSetup.printArea=`A1:M${Math.max(4,4+rows.length)}`;
    ws.pageSetup.printTitlesRow="1:4"
  }

  function ensureControl(){
    const filter=document.querySelector("#reports .print-report-filter");if(!filter||document.getElementById("reportExcelLayoutV46"))return;
    const count=filter.querySelector(".record-count-box"),wrap=document.createElement("label");
    wrap.className="report-v43-field";wrap.id="reportExcelLayoutFieldV46";wrap.append(document.createTextNode("Excel Sheet Layout"));
    const select=document.createElement("select");select.id="reportExcelLayoutV46";
    select.innerHTML='<option value="single">Single Sheet</option><option value="subject">Separate Sheets by Subject</option><option value="class">Separate Sheets by Class</option>';
    select.value=state.layout;select.onchange=()=>{state.layout=select.value||"single"};wrap.appendChild(select);filter.insertBefore(wrap,count||null);
    if(!document.getElementById("reportExcelLayoutStyleV46")){
      const style=document.createElement("style");style.id="reportExcelLayoutStyleV46";style.textContent="#reportExcelLayoutV46{width:100%;border:1px solid #ccd6e4;border-radius:10px;padding:11px;background:#fff;color:#172235}";document.head.appendChild(style)
    }
  }

  exportWeeklyReportExcel=async function(){
    const rows=[...(reportFilteredRows()||[])];
    if(!rows.length){alert("No report records match the selected filters.");return}
    let ExcelJS;try{ExcelJS=await ensureExcelJs()}catch(error){alert(error.message||String(error));return}
    const workbook=new ExcelJS.Workbook();workbook.creator="Khalsa CBSE Syllabus Tracker";workbook.created=new Date();
    const meta=selectedMeta();groupsFor(rows).forEach(([name,group])=>addSheet(workbook,name,group,meta));
    const buffer=await workbook.xlsx.writeBuffer();
    downloadBuffer(buffer,`Khalsa_Weekly_Syllabus_${REPORT_STATE.weekStart||"Report"}.xlsx`)
  };

  if(typeof renderReports==="function"){
    const previous=renderReports;renderReports=function(){const result=previous.apply(this,arguments);queueMicrotask(ensureControl);return result}
  }
  setTimeout(ensureControl,0);
  window.__REPORT_EXCEL_LAYOUT_READY_V46__=true
})();

