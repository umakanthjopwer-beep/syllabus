// Final capture verification after Monday-Saturday normalization.
// Uses Date-column rows from each grade page instead of every date printed anywhere in the document.
(function(){
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const base=smartParse;
  smartParse=async function(file){
    const d=await base(file),audit=d.captureSourceAudit;if(!audit)return d;
    const missing=audit.missingRanges||[],blankTeaching=(d.rows||[]).filter(r=>Number(r.workingDays||0)>0&&!clean(r.topic));
    d.captureWarnings=[];
    if(missing.length)d.captureWarnings.push(`${missing.length} dated Year Plan row(s) could not be captured from the Date column.`);
    if(blankTeaching.length)d.captureWarnings.push(`${blankTeaching.length} Monday-Saturday teaching week row(s) still have no syllabus text.`);
    d.captureIncomplete=missing.length>0;
    d.captureWarning=d.captureWarnings.join(" ");
    d.normalizationSummary={...(d.normalizationSummary||{}),sourceRanges:audit.sourceRanges,capturedRanges:audit.capturedRanges,missingSourceRanges:missing,blankTeachingRows:blankTeaching.length,coverageByGrade:audit.coverageByGrade};
    return d
  };
})();