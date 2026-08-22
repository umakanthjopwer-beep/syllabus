// Print pagination hardening for weekly and exam reports.
(function(){
  if(document.getElementById("reportPaginationFix"))return;
  const s=document.createElement("style");s.id="reportPaginationFix";s.textContent=`
  @media print{
    .weekly-print-sheet{position:static!important;left:auto!important;top:auto!important;overflow:visible!important}
    .weekly-paper-table{page-break-inside:auto!important;break-inside:auto!important}
    .weekly-paper-table thead{display:table-header-group!important}
    .weekly-paper-table tbody{display:table-row-group!important}
    .weekly-paper-table tr{page-break-inside:avoid!important;break-inside:avoid!important}
    .weekly-paper-table td,.weekly-paper-table th{page-break-inside:avoid!important;break-inside:avoid!important}
    .weekly-meta-table{page-break-inside:avoid!important;break-inside:avoid!important}
    .weekly-paper-title,.weekly-paper-subtitle{page-break-after:avoid!important;break-after:avoid!important}
  }
  `;document.head.appendChild(s)
})();