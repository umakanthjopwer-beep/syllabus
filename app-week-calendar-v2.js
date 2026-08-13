// Weekly Status academic calendar normalization.
(function(){
  const WEEK1="2026-06-01",TOTAL=44;
  const d=s=>new Date(s+"T00:00:00Z"),iso=x=>x.toISOString().slice(0,10);
  const add=(s,n)=>{const x=d(s);x.setUTCDate(x.getUTCDate()+n);return iso(x)};
  const fmt=s=>d(s).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});
  const monday=s=>{const x=d(s),back=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-back);return iso(x)};
  const no=start=>Math.max(1,Math.floor((d(start)-d(WEEK1))/(7*86400000))+1);
  const wk=n=>{const start=add(WEEK1,(n-1)*7),end=add(start,5);return{weekNo:n,start,end,label:`Week ${n} | ${fmt(start)} - ${fmt(end)}`}};
  const weekFor=s=>{const start=monday(s),n=no(start),end=add(start,5);return{weekNo:n,start,end,label:`Week ${n} | ${fmt(start)} - ${fmt(end)}`}};
  const all=()=>Array.from({length:TOTAL},(_,i)=>wk(i+1));

  calendarWeekForDate=function(s){return weekFor(s)};
  calendarWeeksForRows=function(){return all()};
  aggregateWeek=function(rows,start,end){
    const matched=(rows||[]).filter(r=>overlaps(r.startDate,r.endDate,start,end));
    const topics=[...new Set(matched.map(r=>String(r.topic||"").trim()).filter(Boolean))];
    const days=matched.map(r=>r.workingDays).filter(v=>v!==null&&v!==undefined&&v!=="").map(Number).filter(Number.isFinite);
    const periods=matched.map(r=>r.plannedPeriods).filter(v=>v!==null&&v!==undefined&&v!=="").map(Number).filter(Number.isFinite);
    return{matched,topic:topics.join("\n"),workingDays:days.length?days.reduce((a,b)=>a+b,0):null,plannedPeriods:periods.length?periods.reduce((a,b)=>a+b,0):null,weekNo:no(start)}
  };
  renderCalendarWeekOptions=function(){
    const sel=document.getElementById("wkWeek"),weeks=all();if(!sel)return weeks;
    const old=sel.dataset.weekStart||"",today=(typeof schoolTodayIso==="function"?schoolTodayIso():new Date().toISOString().slice(0,10)),cur=weekFor(today);
    sel.innerHTML=weeks.map(w=>`<option value="${esc(w.label)}" data-start="${w.start}" data-end="${w.end}" data-week-no="${w.weekNo}">${esc(w.label)}</option>`).join("");
    const p=weeks.find(w=>w.start===old)||weeks.find(w=>w.start===cur.start)||weeks[0];
    sel.value=p.label;sel.dataset.weekStart=p.start;sel.dataset.weekEnd=p.end;sel.dataset.weekNo=String(p.weekNo);return weeks
  };
  function normalizeLabels(){
    for(const p of data.plans||[])for(const w of p.weeks||[])if(w.startDate){const a=weekFor(w.startDate);w.week=a.label;w.weekNo=a.weekNo}
    for(const w of data.weekly||[])if(w.startDate){const a=weekFor(w.startDate);w.week=a.label;w.weekNo=a.weekNo;w.endDate=a.end}
  }
  const oldApply=applyRemoteData;applyRemoteData=function(r){oldApply(r);normalizeLabels()};
  const oldAll=renderAll;renderAll=function(){normalizeLabels();return oldAll()};
})();
