// Fetch every Year Plan week row (Supabase tables exceed the default API page size)
// and prefer canonical Monday-Saturday rows over legacy single-date recapture rows.
(function(){
  const FULL_WEEKS_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/yearplan-weeks-all";
  const clean=v=>String(v??"").trim();
  async function fullWeeks(){
    const t=remoteToken();if(!t)throw new Error("Please sign in again.");
    const r=await fetch(FULL_WEEKS_API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${t}`},body:"{}"});
    let out={};try{out=await r.json()}catch(e){}if(!r.ok)throw new Error(out.error||`Year Plan data request failed (${r.status})`);return out.weeks||[]
  }
  reloadRemote=async function(){
    // Bootstrap still supplies users/mappings/plans. Replace its possibly truncated weeks
    // with the complete paged Year Plan week set before any UI mapping happens.
    const r=await remoteCall("bootstrap");
    try{r.weeks=await fullWeeks()}catch(e){console.error("Complete Year Plan weeks",e)}
    applyRemoteData(r);return r
  };

  function monday(iso){if(!iso)return"";const d=new Date(iso+"T00:00:00Z"),back=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-back);return d.toISOString().slice(0,10)}
  function saturday(start){const d=new Date(start+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+5);return d.toISOString().slice(0,10)}
  function canonicalRows(rows){
    const byWeek=new Map();for(const r of rows||[]){if(!r.startDate)continue;const ws=monday(r.startDate);if(!byWeek.has(ws))byWeek.set(ws,[]);byWeek.get(ws).push(r)}
    const out=[];for(const [ws,g] of byWeek){
      const we=saturday(ws),exact=g.filter(r=>r.startDate===ws&&(r.endDate||r.startDate)===we);
      if(exact.length){
        exact.sort((a,b)=>(clean(b.topic).length-clean(a.topic).length)||((Number(b.plannedPeriods)||0)-(Number(a.plannedPeriods)||0)));out.push(exact[0]);
      }else out.push(...g)
    }
    return out.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))
  }

  const oldPlanRowsFor=planRowsFor;
  planRowsFor=function(section,subject){
    const x=oldPlanRowsFor(section,subject);return{...x,rows:canonicalRows(x.rows||[])}
  };

  window.yearPlanAutofillDiagnostic=function(section,subject,weekStart){
    const x=planRowsFor(section,canonicalSubject(subject||"")),we=saturday(weekStart),agg=aggregateWeek(x.rows,weekStart,we);
    return{plan:x.plan?.fileName||"",rows:x.rows.length,matched:agg.matched.length,topic:agg.topic,workingDays:agg.workingDays,plannedPeriods:agg.plannedPeriods}
  };
})();
