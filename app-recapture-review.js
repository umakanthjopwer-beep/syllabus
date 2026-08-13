(function(){
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  function statusText(status){const s=clean(status).toUpperCase();if(s.includes("PARTIAL CAPTURE"))return"Only part of the Year Plan was captured. Re-capture will safely restore missing dated rows.";if(s.includes("COVERAGE ENDS EARLY"))return"Captured coverage ends before the source Year Plan ends.";if(s.includes("BLANK ROW"))return"One or more teaching-week rows have no topic. Re-capture will fill them only when source content is available.";if(s.includes("CURRENT WEEK MISSING"))return"The current Monday-Saturday week is not represented by a captured row.";if(s.includes("CURRENT SYLLABUS BLANK"))return"The current captured week exists but the syllabus topic is blank.";if(s.includes("YEAR PLAN MISSING"))return"No Year Plan is linked to this active class-subject mapping.";if(s.includes("NO WEEK DATA"))return"The Year Plan is linked, but no usable week rows are captured.";return"Review this Year Plan capture warning."}
  function enhance(){const panel=document.getElementById("dataIntegrityAudit");if(!panel)return;panel.querySelectorAll("#auditTable tr").forEach(tr=>{if(tr.dataset.reviewReady==="1"||tr.cells.length<8)return;tr.dataset.reviewReady="1";const status=clean(tr.cells[6].textContent);if(status==="OK"||status==="NO SEPARATE YEAR PLAN")return;const d=document.createElement("details"),s=document.createElement("summary"),p=document.createElement("div");d.className="capture-issue-details";s.textContent="View Issue";p.className="capture-issue-note";p.textContent=status+" — "+statusText(status)+" Existing non-blank Year Plan data is preserved during Re-capture.";d.append(s,p);tr.cells[7].appendChild(d)})}
  const style=document.createElement("style");style.textContent=".capture-issue-details{margin-top:5px;font-size:9px}.capture-issue-details summary{cursor:pointer;color:#28568f;font-weight:800}.capture-issue-note{max-width:360px;padding:8px;margin-top:5px;border:1px solid #ead79e;background:#fff8e8;border-radius:8px;line-height:1.45}";document.head.appendChild(style);new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});setTimeout(enhance,0);

  // Final capture repair layer: fixes false date-token warnings and varied Excel date layouts.
  const baseParse=smartParse;
  const YEAR_MIN="2026-06-01",YEAR_MAX="2027-04-30";
  const pad=n=>String(n).padStart(2,"0");
  function validIso(s){return /^20\d{2}-\d{2}-\d{2}$/.test(String(s||""))&&s>=YEAR_MIN&&s<=YEAR_MAX}
  function fromParts(y,m,d){const s=`${y}-${pad(m)}-${pad(d)}`;const x=new Date(s+"T00:00:00Z");return !isNaN(x)&&x.getUTCFullYear()===Number(y)&&x.getUTCMonth()+1===Number(m)&&x.getUTCDate()===Number(d)&&validIso(s)?s:""}
  function excelSerialDate(v){if(typeof v!=="number"||!window.XLSX?.SSF?.parse_date_code)return"";const p=XLSX.SSF.parse_date_code(v);return p?fromParts(p.y,p.m,p.d):""}
  function oneDate(v){
    if(v instanceof Date&&!isNaN(v)){const s=v.toISOString().slice(0,10);return validIso(s)?s:""}
    const serial=excelSerialDate(v);if(serial)return serial;
    const z=clean(v).replaceAll("–","-").replaceAll("—","-").replaceAll(".","-");if(!z)return"";
    let m=z.match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);if(m)return fromParts(m[1],m[2],m[3]);
    m=z.match(/\b([0-3]?\d)[-\/]([01]?\d)[-\/](\d{2,4})\b/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return fromParts(y,m[2],m[1])}
    m=z.match(/\b([0-3]?\d)[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[-\s](\d{2,4})\b/i);if(m){const names={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};let y=Number(m[3]);if(y<100)y+=2000;return fromParts(y,names[m[2].toLowerCase()],m[1])}
    return""
  }
  function isoDates(v){
    if(v instanceof Date||typeof v==="number"){const s=oneDate(v);return s?[s]:[]}
    const z=String(v??"").replaceAll("–","-").replaceAll("—","-");const a=[];
    for(const m of z.matchAll(/\b(20\d{2})[-\/.]([01]?\d)[-\/.]([0-3]?\d)\b/g)){const s=fromParts(m[1],m[2],m[3]);if(s)a.push(s)}
    for(const m of z.matchAll(/\b([0-3]?\d)[-\/.]([01]?\d)[-\/.](\d{2,4})\b/g)){let y=Number(m[3]);if(y<100)y+=2000;const s=fromParts(y,m[2],m[1]);if(s)a.push(s)}
    for(const m of z.matchAll(/\b([0-3]?\d)[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[-\s](\d{2,4})\b/gi)){const names={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};let y=Number(m[3]);if(y<100)y+=2000;const s=fromParts(y,names[m[2].toLowerCase()],m[1]);if(s)a.push(s)}
    return[...new Set(a)]
  }
  const headerSubject=v=>{const z=clean(v).toLowerCase();if(/reasoning/.test(z))return"Reasoning";if(/arithmetic/.test(z))return"Arithmetic";if(/vedic/.test(z))return"Vedic Maths";if(/track\s*[-–]?\s*a/.test(z))return"Track A";if(/track\s*[-–]?\s*b/.test(z))return"Track B";return""};
  function monday(s){const d=new Date(s+"T00:00:00Z"),n=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)}
  function add(s,n){const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  function weekLabel(s){return calendarWeekForDate(s).label}
  function normalizeRows(rows){
    const map=new Map();
    for(const r of rows){if(!r.startDate)continue;const finalEnd=r.endDate&&r.endDate>=r.startDate?r.endDate:r.startDate;let ws=monday(r.startDate),guard=0;while(ws<=finalEnd&&guard++<55){const we=add(ws,5),overlap=we>=r.startDate&&ws<=finalEnd;if(overlap){const subject=canonicalSubject(r.subject||""),key=[r.grade??"",subject,ws].join("|");if(!map.has(key))map.set(key,{grade:r.grade??null,subject,startDate:ws,endDate:we,workingDays:r.workingDays??null,plannedPeriods:r.plannedPeriods??null,topic:"",weekNo:calendarWeekForDate(ws).weekNo,academicWeekNo:calendarWeekForDate(ws).weekNo,weekLabel:weekLabel(ws),week:weekLabel(ws)});const x=map.get(key),t=clean(r.topic);if(t&&!x.topic.split(" | ").includes(t))x.topic=x.topic?x.topic+" | "+t:t;if(x.workingDays==null&&r.workingDays!=null)x.workingDays=r.workingDays;if(x.plannedPeriods==null&&r.plannedPeriods!=null)x.plannedPeriods=r.plannedPeriods}ws=add(ws,7)}}
    return[...map.values()].sort((a,b)=>a.startDate.localeCompare(b.startDate)||Number(a.grade||0)-Number(b.grade||0)||a.subject.localeCompare(b.subject))
  }
  function matrixDate(raw,display){const a=[];for(const v of [raw,display]){if(v instanceof Date||typeof v==="number"){const s=oneDate(v);if(s)a.push(s)}else a.push(...isoDates(v))}return[...new Set(a)]}
  function excelFallback(wb,fileName){
    const out=[];
    for(const sn of wb.SheetNames){
      const ws=wb.Sheets[sn],raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true}),disp=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});if(!raw.length)continue;
      const top=disp.slice(0,30).flat().join(" "),grade=detectGrades(top+" "+sn+" "+fileName)[0]||null,maxCols=Math.max(...raw.slice(0,Math.min(raw.length,100)).map(r=>r.length),0);
      let hr=-1,dc=-1,endCol=-1;
      for(let r=0;r<Math.min(60,disp.length)&&hr<0;r++)for(let c=0;c<(disp[r]||[]).length;c++){const h=clean(disp[r][c]);if(/\b(date|dates|week)\b/i.test(h)&&!/update/i.test(h)){hr=r;dc=c;break}}
      if(dc<0){let best={c:-1,n:0,first:-1};for(let c=0;c<maxCols;c++){let n=0,first=-1;for(let r=0;r<Math.min(raw.length,120);r++){if(matrixDate(raw[r]?.[c],disp[r]?.[c]).length){n++;if(first<0)first=r}}if(n>best.n)best={c,n,first}}if(best.n>=2){dc=best.c;hr=Math.max(0,best.first-1)}}
      if(dc<0)continue;
      const head=c=>{const a=[];for(let r=Math.max(0,hr-6);r<=Math.min(disp.length-1,hr+3);r++){const v=clean(disp[r]?.[c]);if(v&&!a.includes(v))a.push(v)}return a.join(" ")};
      for(let c=0;c<maxCols;c++)if(c!==dc&&/(end|to).*date|date.*(end|to)/i.test(head(c))){endCol=c;break}
      const subs=[];let days=-1,periods=-1,topic=-1;
      for(let c=0;c<maxCols;c++){const h=head(c),s=headerSubject(h);if(s)subs.push([c,s]);if(days<0&&/working.*days|no\.?\s*of\s*days|days\s*worked/i.test(h))days=c;if(periods<0&&/period/i.test(h))periods=c;if(topic<0&&/topic|content|syllabus|lesson|chapter/i.test(h))topic=c}
      const detected=detectSubjects(top,fileName),sheetSubject=headerSubject(sn+" "+top)||detected[0]||"";
      for(let r=Math.max(0,hr+1);r<raw.length;r++){
        const rr=raw[r]||[],dd=disp[r]||[];let ds=matrixDate(rr[dc],dd[dc]);if(endCol>=0)ds=[...new Set([...ds,...matrixDate(rr[endCol],dd[endCol])])];if(ds.length<2){for(let c=Math.max(0,dc-1);c<=Math.min(maxCols-1,dc+2);c++)if(c!==dc)ds=[...new Set([...ds,...matrixDate(rr[c],dd[c])])]}if(!ds.length)continue;
        const start=ds[0],end=ds[1]||start,num=c=>{if(c<0)return null;const v=rr[c];if(typeof v==="number"&&Number.isFinite(v))return Number(v);const m=clean(dd[c]??v).match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null};
        if(subs.length){for(const[c,s]of subs){const t=clean(dd[c]??rr[c]);if(t||num(days)>0)out.push({grade,subject:s,startDate:start,endDate:end,workingDays:num(days),plannedPeriods:num(periods),topic:t})}}
        else if(topic>=0||sheetSubject){const t=topic>=0?clean(dd[topic]??rr[topic]):"";if(t||num(days)>0)out.push({grade,subject:sheetSubject,startDate:start,endDate:end,workingDays:num(days),plannedPeriods:num(periods),topic:t})}
      }
    }
    return out
  }
  const maxEnd=rows=>(rows||[]).reduce((m,r)=>{const x=r.endDate||r.startDate||"";return x>m?x:m},"");
  const quality=rows=>({n:(rows||[]).length,filled:(rows||[]).filter(r=>clean(r.topic)).length,end:maxEnd(rows)});
  function coverage(d){const src=isoDates(d.text||""),rows=d.rows||[],sourceEnd=src.reduce((m,x)=>x>m?x:m,""),captureEnd=maxEnd(rows),blank=rows.filter(r=>!clean(r.topic)&&Number(r.workingDays||0)>0).length;let incomplete=false,warn="";if(src.length&&!rows.length){incomplete=true;warn="Dated syllabus content is present in the source, but no usable week rows were captured."}else if(sourceEnd&&captureEnd&&((new Date(sourceEnd)-new Date(captureEnd))/86400000)>10){incomplete=true;warn=`Source Year Plan continues to ${sourceEnd}, but captured syllabus ends at ${captureEnd}.`}d.captureIncomplete=incomplete;d.captureWarnings=[];if(warn)d.captureWarnings.push(warn);if(blank)d.captureWarnings.push(`${blank} teaching-week row(s) still have no syllabus topic.`);d.captureWarning=d.captureWarnings.join(" ");return d}
  smartParse=async function(file){
    let d=await baseParse(file),ext=file.name.split(".").pop().toLowerCase();
    if(["xlsx","xls","csv"].includes(ext)&&window.XLSX){try{const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}),raw=excelFallback(wb,file.name),candidate=normalizeRows(raw),a=quality(d.rows||[]),b=quality(candidate);if(candidate.length&&(b.filled>a.filled||b.end>a.end||a.n===0)){d.rawRows=raw;d.rows=candidate}}catch(e){console.warn("Excel fallback capture",e)}}
    return coverage(d)
  };
})();
