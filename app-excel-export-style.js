let KH_STYLED_XLSX_PROMISE=null;
function ensureStyledExcelEngine(){
  if(window.XLSX?.__khalsaStyled)return Promise.resolve(window.XLSX);
  if(KH_STYLED_XLSX_PROMISE)return KH_STYLED_XLSX_PROMISE;
  KH_STYLED_XLSX_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
    s.async=true;
    s.onload=()=>{if(!window.XLSX)return reject(new Error("Styled Excel library did not load."));window.XLSX.__khalsaStyled=true;resolve(window.XLSX)};
    s.onerror=()=>reject(new Error("Unable to load the styled Excel export library."));
    document.head.appendChild(s)
  });
  return KH_STYLED_XLSX_PROMISE
}
function excelThinBorder(){const edge={style:"thin",color:{rgb:"5F6368"}};return{top:edge,bottom:edge,left:edge,right:edge}}
function excelStyle({bold=false,size=10,h="center",v="center",wrap=true,fill=null}={}){
  const out={font:{name:"Arial",sz:size,bold,color:{rgb:"000000"}},alignment:{horizontal:h,vertical:v,wrapText:wrap},border:excelThinBorder()};
  if(fill)out.fill={patternType:"solid",fgColor:{rgb:fill}};
  return out
}
function ensureExcelCell(ws,r,c){const a=XLSX.utils.encode_cell({r,c});if(!ws[a])ws[a]={t:"s",v:""};return ws[a]}
function cloneExcelStyle(style){return JSON.parse(JSON.stringify(style))}
function styleExcelBlock(ws,r1,c1,r2,c2,style){for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)ensureExcelCell(ws,r,c).s=cloneExcelStyle(style)}
function styleMergedExcelBlock(ws,range,style){const rg=XLSX.utils.decode_range(range);styleExcelBlock(ws,rg.s.r,rg.s.c,rg.e.r,rg.e.c,style)}
function estimateExcelRowHeight(row){const longest=Math.max(String(row.plannedTopic||"").length,String(row.currentTopic||"").length,String(row.reason||"").length,String(row.teacher||"").length);return{hpt:Math.max(30,Math.min(82,28+Math.ceil(longest/48)*9))}}
function excelSubmittedAt(r){
  if(!r?.submitted)return"Pending";
  if(!r.savedAt)return"Submitted";
  const d=new Date(r.savedAt);if(Number.isNaN(d.getTime()))return"Submitted";
  return `Submitted: ${d.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}`
}
function excelClassCode(r){return r.batch||r.section||""}

exportWeeklyReportExcel=async function(){
  const rows=REPORT_STATE.rows||reportFilteredRows();
  let XL;try{XL=await ensureStyledExcelEngine()}catch(e){alert(e.message||String(e));return}
  const selectedSubject=document.getElementById("printReportSubject")?.value||REPORT_STATE.subject||REPORT_ALL_SUBJECTS;
  const allSubjects=selectedSubject===REPORT_ALL_SUBJECTS;
  const subject=`Subject: ${selectedSubject}`;
  const week=`Week dates: ${reportWeekLabel(REPORT_STATE.weekStart,REPORT_STATE.weekEnd)}`;
  const date=`Date: ${reportDateNumeric()}`;
  const sheetData=[
    ["Sri Chaitanya School: Khalsa CBSE Branch","","","","","","","","",""],
    ["Weekly syllabus status","","","","","","","","",""],
    [subject,"","",week,"","","",date,"",""],
    ["S.No","Class/Sec","Working days","Planned periods","Periods taken","Write the topic in the year plan as of today.","The topic currently being taught in the classroom","No. of lagging periods","Reason for lagging","Sign of Teacher / Submitted"]
  ];
  rows.forEach((r,i)=>sheetData.push([
    i+1,
    `${excelClassCode(r)}${allSubjects?`\n${r.subject||""}`:""}`,
    r.workingDays??"",r.plannedPeriods??"",r.periodsTaken??"",r.plannedTopic||"",r.currentTopic||"",r.lagPeriods??"",r.reason||"",
    `${r.teacher||""}${r.teacher?"\n":""}${excelSubmittedAt(r)}`
  ]));

  const ws=XL.utils.aoa_to_sheet(sheetData);
  ws["!merges"]=[XL.utils.decode_range("A1:J1"),XL.utils.decode_range("A2:J2"),XL.utils.decode_range("A3:C3"),XL.utils.decode_range("D3:G3"),XL.utils.decode_range("H3:J3")];
  ws["!cols"]=[{wch:4.5},{wch:14},{wch:8},{wch:9},{wch:9},{wch:42},{wch:42},{wch:10},{wch:24},{wch:24}];
  ws["!rows"]=[{hpt:28},{hpt:23},{hpt:28},{hpt:52},...rows.map(estimateExcelRowHeight)];
  ws["!margins"]={left:0.28,right:0.28,top:0.75,bottom:0.35,header:0.2,footer:0.2};
  ws["!pageSetup"]={orientation:"landscape",paperSize:9,fitToWidth:1,fitToHeight:0};
  ws["!sheetPr"]={pageSetUpPr:{fitToPage:true}};

  const titleStyle=excelStyle({bold:true,size:14,h:"center",v:"center",wrap:true});
  const subtitleStyle=excelStyle({bold:true,size:11,h:"center",v:"center",wrap:true});
  const metaStyle=excelStyle({bold:true,size:10,h:"center",v:"center",wrap:true});
  const headStyle=excelStyle({bold:true,size:9,h:"center",v:"center",wrap:true,fill:"E9EEF5"});
  const centerStyle=excelStyle({size:9,h:"center",v:"center",wrap:true});
  const leftStyle=excelStyle({size:9,h:"left",v:"center",wrap:true});

  styleMergedExcelBlock(ws,"A1:J1",titleStyle);styleMergedExcelBlock(ws,"A2:J2",subtitleStyle);styleMergedExcelBlock(ws,"A3:C3",metaStyle);styleMergedExcelBlock(ws,"D3:G3",metaStyle);styleMergedExcelBlock(ws,"H3:J3",metaStyle);styleExcelBlock(ws,3,0,3,9,headStyle);
  const lastRow=sheetData.length-1;
  if(lastRow>=4){styleExcelBlock(ws,4,0,lastRow,9,centerStyle);for(let r=4;r<=lastRow;r++)for(const c of [5,6,8])ensureExcelCell(ws,r,c).s=cloneExcelStyle(leftStyle)}
  for(let r=0;r<=lastRow;r++)for(let c=0;c<=9;c++){const cell=ensureExcelCell(ws,r,c);cell.s=cell.s||{};cell.s.border=excelThinBorder();cell.s.alignment=cell.s.alignment||{horizontal:"center",vertical:"center",wrapText:true}}

  const wb=XL.utils.book_new();XL.utils.book_append_sheet(wb,ws,"Weekly Status");
  wb.Workbook=wb.Workbook||{};wb.Workbook.Names=wb.Workbook.Names||[];
  wb.Workbook.Names.push({Name:"_xlnm.Print_Area",Sheet:0,Ref:`'Weekly Status'!$A$1:$J$${sheetData.length}`});
  wb.Workbook.Names.push({Name:"_xlnm.Print_Titles",Sheet:0,Ref:"'Weekly Status'!$1:$4"});
  XL.writeFile(wb,`Khalsa_Weekly_Syllabus_${REPORT_STATE.weekStart||"Report"}.xlsx`,{cellStyles:true,compression:true})
};