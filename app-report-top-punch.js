function ensureTopPunchPrintStyles(){
  if(document.getElementById("weeklyTopPunchStyles"))return;
  const s=document.createElement("style");
  s.id="weeklyTopPunchStyles";
  s.textContent=`@media print{@page{size:A4 landscape;margin:19mm 7mm 8mm 7mm}}`;
  document.head.appendChild(s)
}

const _topPunchExcelExport=exportWeeklyReportExcel;
exportWeeklyReportExcel=function(){
  if(!window.XLSX)return _topPunchExcelExport();
  const originalWriteFile=XLSX.writeFile;
  XLSX.writeFile=function(wb,...args){
    try{
      for(const name of wb.SheetNames||[]){
        const ws=wb.Sheets?.[name];if(!ws)continue;
        ws["!margins"]={left:0.28,right:0.28,top:0.75,bottom:0.35,header:0.2,footer:0.2};
        ws["!pageSetup"]={...(ws["!pageSetup"]||{}),orientation:"landscape",paperSize:9,fitToWidth:1,fitToHeight:0};
        ws["!sheetPr"]={...(ws["!sheetPr"]||{}),pageSetUpPr:{fitToPage:true}}
      }
    }catch(e){console.warn("Could not apply top filing margin to Excel",e)}
    return originalWriteFile.call(XLSX,wb,...args)
  };
  try{return _topPunchExcelExport()}finally{XLSX.writeFile=originalWriteFile}
};

const _topPunchInit=init;
init=function(){_topPunchInit();ensureTopPunchPrintStyles()};
