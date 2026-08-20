// Central Year Plan date normalization.
// Accepts Indian school date formats consistently across PDF/Excel import without altering Weekly Status.
(function(){
  const MIN_DATE="2026-06-01",MAX_DATE="2027-04-30";
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const iso=d=>d.toISOString().slice(0,10);
  const inRange=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>=MIN_DATE&&s<=MAX_DATE;
  function validYmd(y,m,d){
    y=Number(y);m=Number(m);d=Number(d);if(y<100)y+=2000;
    const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return"";
    const s=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;return inRange(s)?s:""
  }
  function flexDate(v){
    if(v instanceof Date&&!isNaN(v)){const s=iso(v);return inRange(s)?s:""}
    if(typeof v==="number"&&Number.isFinite(v)&&window.XLSX?.SSF?.parse_date_code){const x=XLSX.SSF.parse_date_code(v);if(x){const s=validYmd(x.y,x.m,x.d);if(s)return s}}
    let z=clean(v).replace(/[‐‑‒–—−]/g,"-");
    let m=z.match(/^(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})$/);if(m)return validYmd(m[1],m[2],m[3]);
    m=z.match(/^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{2,4})$/);if(m)return validYmd(m[3],m[2],m[1]);
    return""
  }
  function flexDates(v){
    if(v instanceof Date||typeof v==="number"){const s=flexDate(v);return s?[s]:[]}
    const z=clean(v).replace(/[‐‑‒–—−]/g,"-");const out=[];
    const rx=/(?:\b20\d{2}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2}\b|\b\d{1,2}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{2,4}\b)/g;
    for(const m of z.matchAll(rx)){const s=flexDate(m[0]);if(s&&!out.includes(s))out.push(s)}return out
  }
  window.yearPlanFlexDate=flexDate;window.yearPlanFlexDates=flexDates;

  // Base smart Excel date cell parser.
  if(typeof parseDateCell==="function")parseDateCell=function(v){const d=flexDates(v);return d.length?[d[0],d[1]||d[0]]:[null,null]};

  // PDF parser date token and date-column anchors.
  if(typeof pdfDateToken==="function")pdfDateToken=function(v){return flexDate(v)||null};
  if(typeof pdfDateAnchors==="function")pdfDateAnchors=function(items,bounds){
    const bd=bounds.find(x=>x.k==="date");if(!bd)return[];
    const lines=pdfGroups(items.filter(x=>x.x>=bd.min&&x.x<bd.max)),out=[];
    for(let i=0;i<lines.length;i++){
      const direct=flexDates(lines[i].text);if(!direct.length)continue;
      const start=direct[0];let end=direct[1]||start,consume=0;
      if(direct.length<2){
        const n1=lines[i+1],n2=lines[i+2];
        if(n1&&/^to$/i.test(clean(n1.text))&&n2){const d=flexDates(n2.text);if(d.length){end=d[0];consume=2}}
        else if(n1&&/\bto\b/i.test(`${lines[i].text} ${n1.text}`)){const d=flexDates(n1.text);if(d.length){end=d[0];consume=1}}
      }
      out.push({start,end,y:lines[i].y});i+=consume
    }
    const uniq=[];for(const r of out)if(!uniq.some(x=>x.start===r.start&&x.end===r.end&&Math.abs(x.y-r.y)<2.5))uniq.push(r);return uniq
  };

  // Make import review's date count use the same parser so slash dates are not reported as missing.
  if(typeof smartDetection==="function"){
    const baseDetection=smartDetection;
    smartDetection=function(file,text,pages,rows){const d=baseDetection(file,text,pages,rows);d.dateTokens=flexDates(text).length;return d}
  }

  function excelFallback(file,wb){
    const out=[];
    for(const sn of wb.SheetNames){
      const ws=wb.Sheets[sn];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});
      const fmt=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
      if(!raw.length)continue;
      const top=fmt.slice(0,30).flat().join(" "),grade=(detectGrades(top+" "+sn+" "+file.name)||[])[0]||null,detected=detectSubjects(top,file.name)||[];
      let header=-1,dateCol=-1;
      for(let r=0;r<Math.min(60,fmt.length);r++){
        const row=(fmt[r]||[]).map(clean),dc=row.findIndex(x=>/^dates?$|^week$/i.test(x));
        if(dc>=0){header=r;dateCol=dc;break}
      }
      if(dateCol<0){
        outer:for(let r=0;r<Math.min(80,raw.length);r++)for(let c=0;c<(raw[r]||[]).length;c++){if(flexDates(raw[r][c]).length){header=Math.max(0,r-1);dateCol=c;break outer}}
      }
      if(dateCol<0)continue;
      const width=Math.max(...fmt.slice(Math.max(0,header-3),Math.min(fmt.length,header+4)).map(r=>r.length),0);
      const head=c=>{const a=[];for(let r=Math.max(0,header-3);r<=Math.min(fmt.length-1,header+2);r++){const v=clean(fmt[r]?.[c]);if(v&&!a.includes(v))a.push(v)}return a.join(" ")};
      let daysCol=-1,periodCol=-1,topicCol=-1;const subjectCols=[];
      for(let c=0;c<width;c++){
        const h=head(c),canon=canonicalSubject(h);
        if(daysCol<0&&/working.*days|no\.?\s*of\s*days/i.test(h))daysCol=c;
        if(periodCol<0&&/periods?|no\.?\s*of\s*periods/i.test(h))periodCol=c;
        if(topicCol<0&&/topic|content|syllabus|chapter|lesson|portion/i.test(h))topicCol=c;
        if(["Track A","Track B","Reasoning","Arithmetic","Vedic Maths"].includes(canon))subjectCols.push([c,canon])
      }
      const num=(row,c)=>c>=0?(Number(clean(row?.[c]).match(/\d+/)?.[0]||0)||null):null;
      for(let r=header+1;r<raw.length;r++){
        const rr=raw[r]||[],fr=fmt[r]||[];let dates=[];
        for(let c=dateCol;c<=Math.min(dateCol+3,rr.length-1);c++)dates.push(...flexDates(rr[c]));
        dates=[...new Set(dates)];if(!dates.length)continue;const start=dates[0],end=dates[1]||start,workingDays=num(fr,daysCol),plannedPeriods=num(fr,periodCol);
        if(subjectCols.length){
          for(const[c,subject]of subjectCols){const topic=clean(fr[c]);if(topic)out.push({grade,subject,startDate:start,endDate:end,workingDays,plannedPeriods,topic})}
          continue
        }
        let topic=topicCol>=0?clean(fr[topicCol]):"";
        if(!topic){const parts=[];for(let c=dateCol+1;c<fr.length;c++){if([daysCol,periodCol].includes(c))continue;const v=clean(fr[c]);if(!v||flexDates(v).length||/^to$/i.test(v)||/^\d{1,2}$/.test(v))continue;parts.push(v)}topic=[...new Set(parts)].join(" | ")}
        out.push({grade,subject:canonicalSubject(detected[0]||""),startDate:start,endDate:end,workingDays,plannedPeriods,topic})
      }
    }
    return out
  }

  // Final Excel fallback. Runs only when all earlier parsers produced no usable dated rows.
  if(typeof smartParse==="function"){
    const baseSmartParse=smartParse;
    smartParse=async function(file){
      const d=await baseSmartParse(file),ext=file.name.split(".").pop().toLowerCase();
      if(!["xlsx","xls","csv"].includes(ext)||!window.XLSX||(d.rows||[]).some(r=>r.startDate))return d;
      try{
        const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}),rows=excelFallback(file,wb);
        if(rows.length){d.rows=rows;d.rawRows=rows.map((r,i)=>({...r,sourceRow:i+1}));d.subjects=[...new Set([...d.subjects,...rows.map(r=>canonicalSubject(r.subject)).filter(Boolean)])];d.grades=[...new Set([...d.grades,...rows.map(r=>r.grade).filter(Boolean)])].sort((a,b)=>a-b);d.dateTokens=Math.max(Number(d.dateTokens||0),rows.length);d.captureIncomplete=false;d.captureWarning="";d.captureWarnings=[]}
      }catch(e){console.warn("Flexible Excel date fallback",e)}return d
    }
  }
})();
