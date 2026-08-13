// Final capture verification and Monday-Saturday normalization.
// Safe to load before or after the existing week engine.
(function(){
  const clean=v=>String(v??"").replace(/\s+/g," ").trim(),D=s=>new Date(s+"T00:00:00Z"),ISO=d=>d.toISOString().slice(0,10);
  const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||""));
  function add(s,n){const d=D(s);d.setUTCDate(d.getUTCDate()+n);return ISO(d)}
  function mon(s){const d=D(s),back=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-back);return ISO(d)}
  function weekNo(s){return Math.max(1,Math.floor((D(mon(s))-D("2026-06-01"))/(7*86400000))+1)}
  function label(s){const f=x=>D(x).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});return`Week ${weekNo(s)} | ${f(s)} - ${f(add(s,5))}`}
  function overlap(a,b,ws,we){let n=0;for(let x=a;x<=b;x=add(x,1)){const dow=D(x).getUTCDay();if(x>=ws&&x<=we&&dow!==0)n++}return n}
  function distribute(total,weights){if(total==null||total===""||!Number.isFinite(Number(total)))return weights.map(()=>null);let t=Math.max(0,Math.round(Number(total))),sum=weights.reduce((a,b)=>a+b,0)||1,out=weights.map(w=>Math.floor(t*w/sum)),used=out.reduce((a,b)=>a+b,0),rem=t-used,ord=weights.map((w,i)=>({i,f:t*w/sum-Math.floor(t*w/sum)})).sort((a,b)=>b.f-a.f);for(let k=0;k<rem;k++)out[ord[k%ord.length].i]++;return out}
  function periodCount(v){let n=0,found=false;for(const m of String(v||"").matchAll(/\b(\d{1,2})\s*Periods?\b/gi)){n+=Number(m[1]);found=true}return found?n:null}
  function split(r){
    let a=valid(r.startDate)?r.startDate:"",b=valid(r.endDate)?r.endDate:a;if(!a)return[];if(!b)b=a;if(b<a){const x=a;a=b;b=x}let ws=mon(a),parts=[];while(ws<=b){const we=add(ws,5),w=overlap(a,b,ws,we);if(w>0)parts.push({start:ws,end:we,weight:w});ws=add(ws,7)}
    const days=distribute(r.workingDays,parts.map(x=>x.weight)),rawPeriods=r.plannedPeriods==null?periodCount(r.topic):r.plannedPeriods,periods=distribute(rawPeriods,parts.map(x=>x.weight));return parts.map((p,i)=>({...r,startDate:p.start,endDate:p.end,workingDays:days[i],plannedPeriods:periods[i],academicWeekNo:weekNo(p.start),weekNo:weekNo(p.start),weekLabel:label(p.start),week:label(p.start),sourceStartDate:a,sourceEndDate:b}))
  }
  function normalize(rows){
    const map=new Map();for(const r of (rows||[]).flatMap(split)){const key=[r.grade??"",canonicalSubject(r.subject||""),r.startDate].join("|"),x=map.get(key)||{...r,topic:"",workingDays:0,plannedPeriods:0,_hasDays:false,_hasPeriods:false,_topics:[]};const t=clean(r.topic);if(t&&!x._topics.includes(t))x._topics.push(t);if(r.workingDays!=null){x.workingDays+=Number(r.workingDays)||0;x._hasDays=true}if(r.plannedPeriods!=null){x.plannedPeriods+=Number(r.plannedPeriods)||0;x._hasPeriods=true}map.set(key,x)}
    return[...map.values()].map(x=>{x.topic=x._topics.join(" | ");x.workingDays=x._hasDays?Math.min(6,x.workingDays):null;x.plannedPeriods=x._hasPeriods?x.plannedPeriods:null;delete x._topics;delete x._hasDays;delete x._hasPeriods;return x}).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||Number(a.grade||0)-Number(b.grade||0)||String(a.subject).localeCompare(String(b.subject)))
  }
  const base=smartParse;
  smartParse=async function(file){
    const d=await base(file),audit=d.captureSourceAudit;if(!audit)return d;d.rawRows=d.rawRows||d.rows||[];d.rows=normalize(d.rows||[]);
    const missing=audit.missingRanges||[],blankTeaching=(d.rows||[]).filter(r=>Number(r.workingDays||0)>0&&!clean(r.topic));d.captureWarnings=[];
    if(missing.length)d.captureWarnings.push(`${missing.length} dated Year Plan row(s) could not be captured from the Date column.`);if(blankTeaching.length)d.captureWarnings.push(`${blankTeaching.length} Monday-Saturday teaching week row(s) still have no syllabus text.`);
    d.captureIncomplete=missing.length>0;d.captureWarning=d.captureWarnings.join(" ");d.normalizationSummary={...(d.normalizationSummary||{}),sourceRanges:audit.sourceRanges,capturedRanges:audit.capturedRanges,missingSourceRanges:missing,blankTeachingRows:blankTeaching.length,coverageByGrade:audit.coverageByGrade,weekRows:d.rows.length};return d
  };
})();