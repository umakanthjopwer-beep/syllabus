// Fetch every Year Plan week row (Supabase tables exceed the default API page size)
// and prefer canonical Monday-Saturday rows over legacy single-date recapture rows.
(function(){
  const FULL_WEEKS_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/yearplan-weeks-all";
  const CLASS_X_REVISION_START="2026-08-31";
  const CLASS_X_REVISION_END="2027-04-03";
  const clean=v=>String(v??"").trim();
  async function fullCatalog(){
    const t=remoteToken();if(!t)throw new Error("Please sign in again.");
    const r=await fetch(FULL_WEEKS_API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${t}`},body:"{}"});
    let out={};try{out=await r.json()}catch(e){}if(!r.ok)throw new Error(out.error||`Year Plan data request failed (${r.status})`);return out
  }
  const previousReloadRemote=reloadRemote;
  reloadRemote=async function(){
    const r=await previousReloadRemote();
    try{
      const full=await fullCatalog();
      if(Array.isArray(full.plans))r.plans=full.plans;
      if(Array.isArray(full.assignments))r.assignments=full.assignments;
      if(Array.isArray(full.weeks))r.weeks=full.weeks;
      if(Array.isArray(full.planSubjects))r.planSubjects=full.planSubjects;
      r.completeYearPlanWeekCount=Number(full.count||0);
      applyRemoteData(r)
    }catch(e){console.error("Complete Year Plan catalog",e)}
    if(document.getElementById("wkWeek")&&typeof fillWeeklyCalendarFromPlan==="function")setTimeout(()=>{try{fillWeeklyCalendarFromPlan(true)}catch(e){console.warn("Weekly autofill refresh",e)}},0);
    return r
  };
  function monday(iso){if(!iso)return"";const d=new Date(iso+"T00:00:00Z"),back=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-back);return d.toISOString().slice(0,10)}
  function addDays(start,n){const d=new Date(start+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  function saturday(start){return addDays(start,5)}
  function canonicalRows(rows){
    const byWeek=new Map();for(const r of rows||[]){if(!r.startDate)continue;const ws=monday(r.startDate);if(!byWeek.has(ws))byWeek.set(ws,[]);byWeek.get(ws).push(r)}
    const out=[];for(const [ws,g] of byWeek){
      const we=saturday(ws),exact=g.filter(r=>r.startDate===ws&&(r.endDate||r.startDate)===we);
      if(exact.length){exact.sort((a,b)=>(clean(b.topic).length-clean(a.topic).length)||((Number(b.plannedPeriods)||0)-(Number(a.plannedPeriods)||0)));out.push(exact[0])}else out.push(...g)
    }
    return out.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))
  }
  function withClassXRevision(section,subject,plan,rows){
    const grade=Number(sectionMeta(section)?.grade||0);if(grade!==10||!plan)return rows;
    const sub=canonicalSubject(subject||"");const byStart=new Map((rows||[]).map(r=>[monday(r.startDate),{...r}]));
    for(let ws=CLASS_X_REVISION_START;ws<=CLASS_X_REVISION_END;ws=addDays(ws,7)){
      const existing=byStart.get(ws),label=calendarWeekForDate(ws)?.label||"";
      if(existing){
        if(!clean(existing.topic)){existing.topic=`Class X Revision Schedule – ${sub}`;existing.syntheticRevision=true}
        if(!existing.endDate)existing.endDate=saturday(ws);if(!existing.week)existing.week=label;if(!existing.weekLabel)existing.weekLabel=label;if(!existing.weekNo)existing.weekNo=calendarWeekForDate(ws)?.weekNo||0;byStart.set(ws,existing)
      }else{
        byStart.set(ws,{grade:10,subject:sub,startDate:ws,endDate:saturday(ws),workingDays:null,plannedPeriods:null,topic:`Class X Revision Schedule – ${sub}`,week:label,weekLabel:label,weekNo:calendarWeekForDate(ws)?.weekNo||0,academicWeekNo:calendarWeekForDate(ws)?.weekNo||0,syntheticRevision:true})
      }
    }
    return[...byStart.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))
  }
  const oldPlanRowsFor=planRowsFor;
  planRowsFor=function(section,subject){const x=oldPlanRowsFor(section,subject),rows=canonicalRows(x.rows||[]);return{...x,rows:withClassXRevision(section,subject,x.plan,rows)}};
  const previousFillWeekly=fillWeeklyCalendarFromPlan;
  fillWeeklyCalendarFromPlan=function(preserveSelection=true){const r=previousFillWeekly(preserveSelection);try{const section=document.getElementById("wkSection")?.value,subject=canonicalSubject(document.getElementById("wkSubject")?.value||""),w=selectedCalendarWeek?.();if(Number(sectionMeta(section)?.grade||0)===10&&w&&w.start>=CLASS_X_REVISION_START){const x=planRowsFor(section,subject),agg=aggregateWeek(x.rows,w.start,w.end),isRevision=(agg.matched||[]).some(q=>q.syntheticRevision);if(isRevision){const note=document.getElementById("yearPlanSourceNote");if(note)note.textContent=`Class X revision phase · ${subject} · Auto-filled as Revision Schedule because the Year Plan switches from new-topic teaching to revision from September.`}}}catch(e){}return r};
  fillWeeklyFromPlan=function(){return fillWeeklyCalendarFromPlan(true)};
  applyWeekDates=function(){return fillWeeklyCalendarFromPlan(true)};
  window.yearPlanAutofillDiagnostic=function(section,subject,weekStart){const x=planRowsFor(section,canonicalSubject(subject||"")),we=saturday(weekStart),agg=aggregateWeek(x.rows,weekStart,we);return{plan:x.plan?.fileName||"",rows:x.rows.length,matched:agg.matched.length,topic:agg.topic,workingDays:agg.workingDays,plannedPeriods:agg.plannedPeriods,revisionFallback:(agg.matched||[]).some(r=>r.syntheticRevision)}};
})();

// Keep Super Admin return/logout controls visible while viewing a Teacher/HOD account.
(function(){
  const HEIGHT=52;
  function active(){try{return typeof impersonationActive==="function"&&impersonationActive()}catch(e){return false}}
  function offset(on){const px=on?`${HEIGHT}px`:"";const shell=document.getElementById("appShell");if(shell)shell.style.marginTop=px;document.querySelectorAll(".topbar,.mobile-header").forEach(el=>el.style.top=px);const side=document.querySelector(".sidebar");if(side){side.style.top=px;side.style.height=on?`calc(100vh - ${HEIGHT}px)`:""}}
  function ensure(){let bar=document.getElementById("superAdminStaffViewBar");if(bar)return bar;bar=document.createElement("div");bar.id="superAdminStaffViewBar";bar.style.cssText=`display:none;position:fixed;top:0;left:0;right:0;z-index:6000;min-height:${HEIGHT}px;background:#fff3cd;border-bottom:1px solid #e2c96e;padding:7px 10px;align-items:center;gap:8px;box-shadow:0 3px 10px rgba(0,0,0,.08);color:#654f0b`;bar.innerHTML=`<span id="superAdminStaffViewText" style="flex:1;min-width:0;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span><div style="display:flex;gap:6px;flex-shrink:0"><button id="superAdminReturnVisible" type="button" style="border:1px solid #9a7b19;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:900;color:#654f0b">Return to Super Admin</button><button id="superAdminLogoutVisible" type="button" style="border:1px solid #654f0b;background:#654f0b;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:900;color:#fff">Logout</button></div>`;document.body.appendChild(bar);document.getElementById("superAdminReturnVisible").onclick=()=>{if(typeof returnToSuperAdmin==="function")returnToSuperAdmin()};document.getElementById("superAdminLogoutVisible").onclick=()=>{if(confirm("Logout from the app?"))logout()};return bar}
  function refresh(){const bar=ensure(),on=active(),old=document.getElementById("impersonationBar");if(old&&on)old.style.display="none";bar.style.display=on?"flex":"none";offset(on);if(on){const t=document.getElementById("superAdminStaffViewText");if(t)t.innerHTML=`SUPER ADMIN VIEW · <strong>${esc(currentUser?.name||"")}</strong> (${esc(currentUser?.role||"")})`}}
  const oldOpen=openApp;openApp=function(){const r=oldOpen();setTimeout(refresh,0);return r};
  const oldShow=showView;showView=function(id){const r=oldShow(id);setTimeout(refresh,0);return r};
  const oldRender=renderAll;renderAll=function(){const r=oldRender();setTimeout(refresh,0);return r};
  const oldInit=init;init=function(){ensure();oldInit();refresh()};
  window.addEventListener("resize",refresh);
  window.refreshSuperAdminStaffViewBar=refresh;
})();