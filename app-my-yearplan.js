// Read-only My Year Plan view for Teacher logins.
// Uses the same planRowsFor() source as Weekly Status and enriches it from the original stored Year Plan.
(function(){
  const sourceCache=new Map();
  let displayRows=[];
  const clean=v=>String(v??"").trim();
  const D=s=>new Date(s+"T00:00:00Z"),ISO=d=>d.toISOString().slice(0,10);
  const addDays=(s,n)=>{const d=D(s);d.setUTCDate(d.getUTCDate()+n);return ISO(d)};
  const monday=s=>{if(!s)return"";const d=D(s),back=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-back);return ISO(d)};
  const saturday=s=>addDays(s,5);
  const today=()=>new Date().toISOString().slice(0,10);
  const teacherMode=()=>currentUser?.role==="Teacher";

  function ensureStyles(){
    if(document.getElementById("myYearPlanStyles"))return;
    const s=document.createElement("style");s.id="myYearPlanStyles";s.textContent=`
      .myp-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr 1.4fr;gap:10px;align-items:end}
      .myp-toolbar label{display:grid;gap:6px;font-size:10px;font-weight:800;color:#536176}.myp-toolbar select,.myp-toolbar input{width:100%;border:1px solid #ccd6e4;border-radius:10px;padding:10px;background:#fff}
      .myp-source{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:11px 12px;border:1px solid #dce5ef;border-radius:11px;background:#f7faff;font-size:10px;color:#5d6f87}.myp-source strong{color:#244f88}.myp-source button{border:1px solid #cbd8e8;background:#fff;border-radius:8px;padding:7px 9px;color:#275b9f;font-weight:800;font-size:9px}
      .myp-summary{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.myp-pill{padding:7px 10px;border-radius:999px;background:#eef3fb;color:#45617f;font-size:9px;font-weight:800}.myp-pill.current{background:#e8f6ef;color:#15744e}
      #myYearPlanTable tr.current-week td{background:#f0f8f4}.myp-week{white-space:nowrap;font-weight:800;color:#234e84}.myp-topic{min-width:340px;line-height:1.45}.myp-state{font-size:8px;font-weight:900;border-radius:999px;padding:5px 7px;display:inline-block}.myp-state.current{background:#e7f7ef;color:#167a52}.myp-state.future{background:#edf3fb;color:#275e9f}.myp-state.past{background:#f1f1f1;color:#707987}.myp-empty{color:#b14646;font-weight:700}
      @media(max-width:760px){.myp-toolbar{grid-template-columns:1fr 1fr}.myp-toolbar .wide-mobile{grid-column:1/-1}.myp-source{align-items:flex-start;flex-direction:column}.myp-source button{width:100%}.myp-topic{min-width:260px}}
    `;document.head.appendChild(s)
  }

  function ensureView(){
    if(document.getElementById("myyearplan"))return;
    const main=document.querySelector(".main-content");if(!main)return;
    const sec=document.createElement("section");sec.id="myyearplan";sec.className="view";sec.innerHTML=`
      <div class="page-head"><div><div class="eyebrow blue-text">MY YEAR PLAN</div><h2>My Year Plan</h2><p>Read-only weekly syllabus for your own handling classes and subjects. The same plan feeds Weekly Status.</p></div></div>
      <div class="panel">
        <div class="myp-toolbar">
          <label>Class & Section<select id="mypSection"></select></label>
          <label>Subject<select id="mypSubject"></select></label>
          <label>Show<select id="mypRange"><option value="all">All weeks</option><option value="current">Current week</option><option value="future">Current & future</option><option value="past">Previous weeks</option></select></label>
          <label class="wide-mobile">Search<input id="mypSearch" placeholder="Search week or syllabus topic"></label>
        </div>
        <div id="mypSource" class="myp-source"><span>Select your class and subject to view the official Year Plan.</span></div>
        <div id="mypSummary" class="myp-summary"></div>
        <div class="table-wrap"><table id="myYearPlanTable"><thead><tr><th>Week</th><th>Monday–Saturday</th><th>Planned Syllabus / Activity</th><th>Working Days</th><th>Planned Periods</th><th>Status</th></tr></thead><tbody id="mypBody"></tbody></table></div>
      </div>`;
    const weekly=document.getElementById("weekly");weekly?.after(sec);if(!weekly)main.appendChild(sec);
    document.getElementById("mypSection").onchange=()=>{populateSubjects();renderMyYearPlan(true)};
    document.getElementById("mypSubject").onchange=()=>renderMyYearPlan(true);
    document.getElementById("mypRange").onchange=renderTable;
    document.getElementById("mypSearch").oninput=renderTable
  }

  function ensureNav(){
    const side=document.getElementById("sideNav");
    if(side&&!document.getElementById("myYearPlanNav")){
      const b=document.createElement("button");b.id="myYearPlanNav";b.className="nav-btn hidden";b.dataset.view="myyearplan";b.innerHTML="<span>Y</span>My Year Plan";b.onclick=()=>showView("myyearplan");
      const weekly=side.querySelector('[data-view="weekly"]');weekly?.after(b);if(!weekly)side.appendChild(b)
    }
    const mobile=document.querySelector(".mobile-nav");
    if(mobile&&!document.getElementById("myYearPlanMobileNav")){
      const b=document.createElement("button");b.id="myYearPlanMobileNav";b.className="hidden";b.dataset.view="myyearplan";b.innerHTML="<span>Y</span><small>My Plan</small>";b.onclick=()=>showView("myyearplan");
      const weekly=mobile.querySelector('[data-view="weekly"]');weekly?.after(b);if(!weekly)mobile.appendChild(b)
    }
  }

  function pairs(){
    if(typeof ownTeacherPairs!=="function")return[];
    const map=new Map();for(const p of ownTeacherPairs()){const k=`${p.section}|${canonicalSubject(p.subject)}`;if(!map.has(k))map.set(k,{section:p.section,subject:canonicalSubject(p.subject)})}return[...map.values()]
  }
  function fillSimpleSelect(el,values,selected){if(!el)return;el.innerHTML=values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(values.includes(selected))el.value=selected}
  function populateSelectors(){
    const ps=pairs(),section=document.getElementById("mypSection"),old=section?.value||"",sections=[...new Set(ps.map(x=>x.section))];fillSimpleSelect(section,sections,sections.includes(old)?old:sections[0]||"");populateSubjects()
  }
  function populateSubjects(){
    const ps=pairs(),section=document.getElementById("mypSection")?.value||"",subject=document.getElementById("mypSubject"),old=canonicalSubject(subject?.value||""),subjects=[...new Set(ps.filter(x=>x.section===section).map(x=>x.subject))];fillSimpleSelect(subject,subjects,subjects.includes(old)?old:subjects[0]||"")
  }

  function sourcePlans(section,subject){const sub=canonicalSubject(subject||"");return(data.plans||[]).filter(p=>p.enabled!==false&&p.assignedSections?.includes(section)&&planHasSubject(p,sub))}
  async function parsePlan(plan){
    if(sourceCache.has(plan.id))return sourceCache.get(plan.id);
    const promise=(async()=>{const signed=await remoteCall("yearplan_url",{id:plan.id}),r=await fetch(signed.url);if(!r.ok)throw new Error("Could not read original Year Plan");const blob=await r.blob(),file=new File([blob],plan.fileName,{type:plan.fileType||blob.type||"application/octet-stream"});return smartParse(file)})();
    sourceCache.set(plan.id,promise);try{return await promise}catch(e){sourceCache.delete(plan.id);throw e}
  }
  function overlapDays(a,b,ws,we){let n=0;for(let x=a;x<=b;x=addDays(x,1)){const dow=D(x).getUTCDay();if(dow!==0&&x>=ws&&x<=we)n++}return n}
  function distribute(total,weights){if(total==null||total===""||!Number.isFinite(Number(total)))return weights.map(()=>null);const value=Math.max(0,Math.round(Number(total))),sum=weights.reduce((a,b)=>a+b,0)||1,out=weights.map(w=>Math.floor(value*w/sum));let rem=value-out.reduce((a,b)=>a+b,0),i=0;while(rem-->0)out[i++%out.length]++;return out}
  function normalizeRows(rows){
    const groups=new Map();
    for(const raw of rows||[]){if(!raw.startDate)continue;let a=raw.startDate,b=raw.endDate||a;if(b<a){const t=a;a=b;b=t}const weeks=[];for(let ws=monday(a),guard=0;ws<=b&&guard++<60;ws=addDays(ws,7)){const we=saturday(ws),weight=overlapDays(a,b,ws,we);if(weight)weeks.push({ws,we,weight})}const d=distribute(raw.workingDays,weeks.map(x=>x.weight)),p=distribute(raw.plannedPeriods,weeks.map(x=>x.weight));weeks.forEach((w,i)=>{const r={...raw,startDate:w.ws,endDate:w.we,workingDays:d[i],plannedPeriods:p[i]};if(!groups.has(w.ws))groups.set(w.ws,[]);groups.get(w.ws).push(r)})}
    const out=[];for(const[ws,g]of groups){const topics=[];for(const r of g)for(const t of clean(r.topic).split(/\s*\|\s*/).filter(Boolean))if(!topics.includes(t))topics.push(t);const days=g.map(r=>r.workingDays).filter(v=>v!=null&&v!=="").map(Number).filter(Number.isFinite),periods=g.map(r=>r.plannedPeriods).filter(v=>v!=null&&v!=="").map(Number).filter(Number.isFinite),sample=g.find(r=>clean(r.topic))||g[0]||{};out.push({...sample,startDate:ws,endDate:saturday(ws),topic:topics.join(" | "),workingDays:days.length?Math.min(6,Math.max(...days)):null,plannedPeriods:periods.length?Math.max(...periods):null})}
    return out.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))
  }
  function mergeRows(a,b){
    const by=new Map();for(const r of [...(a||[]),...(b||[])]){if(!r.startDate)continue;const ws=monday(r.startDate),old=by.get(ws);if(!old){by.set(ws,{...r,startDate:ws,endDate:saturday(ws)});continue}const rt=clean(r.topic),ot=clean(old.topic);if(rt&&!ot.includes(rt))old.topic=ot?`${ot} | ${rt}`:rt;if((old.workingDays==null||old.workingDays===0)&&r.workingDays!=null)old.workingDays=r.workingDays;if((old.plannedPeriods==null||old.plannedPeriods===0)&&r.plannedPeriods!=null)old.plannedPeriods=r.plannedPeriods}
    return[...by.values()].sort((x,y)=>String(x.startDate).localeCompare(String(y.startDate)))
  }
  function fmtDate(s){if(!s)return"—";return new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
  function rowState(r){const t=today();return t>=r.startDate&&t<=r.endDate?"current":r.startDate>t?"future":"past"}
  function weekNo(r){try{return calendarWeekForDate(r.startDate)?.weekNo||r.weekNo||""}catch(e){return r.weekNo||""}}
  function renderSource(section,subject,plans,loading=false,error=""){
    const box=document.getElementById("mypSource");if(!box)return;const names=plans.map(p=>p.fileName);if(!plans.length){box.innerHTML='<span class="myp-empty">No Year Plan is linked to this class and subject.</span>';return}
    const text=loading?"Checking original Year Plan for all weeks…":error?`Stored plan shown. Original source check: ${error}`:`Source: ${names.join(" · ")}`;
    box.innerHTML=`<span><strong>${loading?"Verifying full-year source":"Official Year Plan"}</strong><br>${esc(text)}</span><button type="button" id="mypViewOriginal">View Original Year Plan</button>`;
    document.getElementById("mypViewOriginal").onclick=()=>viewPlan(plans[0].id)
  }
  function renderTable(){
    const body=document.getElementById("mypBody"),q=clean(document.getElementById("mypSearch")?.value).toLowerCase(),range=document.getElementById("mypRange")?.value||"all";if(!body)return;
    const rows=displayRows.filter(r=>{const state=rowState(r),okRange=range==="all"||(range==="current"&&state==="current")||(range==="future"&&(state==="current"||state==="future"))||(range==="past"&&state==="past"),text=`${r.startDate} ${r.endDate} ${r.topic}`.toLowerCase();return okRange&&(!q||text.includes(q))});
    const current=displayRows.filter(r=>rowState(r)==="current").length,future=displayRows.filter(r=>rowState(r)==="future").length,blank=displayRows.filter(r=>!clean(r.topic)).length,sum=document.getElementById("mypSummary");if(sum)sum.innerHTML=`<span class="myp-pill current">${current} Current</span><span class="myp-pill">${future} Future weeks</span><span class="myp-pill">${displayRows.length} Total weeks</span>${blank?`<span class="myp-pill">${blank} blank source row(s)</span>`:""}`;
    body.innerHTML=rows.map(r=>{const state=rowState(r),n=weekNo(r),topic=clean(r.topic)||"No planned syllabus captured for this week";return`<tr class="${state==="current"?"current-week":""}"><td class="myp-week">Week ${esc(String(n||"—"))}</td><td>${esc(fmtDate(r.startDate))}<br>to ${esc(fmtDate(r.endDate))}</td><td class="myp-topic ${clean(r.topic)?"":"myp-empty"}">${esc(topic)}</td><td>${r.workingDays==null?"—":esc(String(r.workingDays))}</td><td>${r.plannedPeriods==null?"—":esc(String(r.plannedPeriods))}</td><td><span class="myp-state ${state}">${state==="current"?"CURRENT WEEK":state==="future"?"UPCOMING":"COMPLETED WEEK"}</span></td></tr>`}).join("")||'<tr><td colspan="6">No Year Plan weeks match this filter.</td></tr>'
  }
  async function renderMyYearPlan(checkSource=false){
    if(!teacherMode())return;ensureView();ensureNav();populateSelectors();const section=document.getElementById("mypSection")?.value||"",subject=canonicalSubject(document.getElementById("mypSubject")?.value||"");if(!section||!subject){displayRows=[];renderTable();return}
    const plans=sourcePlans(section,subject),base=planRowsFor(section,subject);displayRows=mergeRows([],base.rows||[]);renderSource(section,subject,plans,!!checkSource);renderTable();if(!checkSource||!plans.length)return;
    try{const grade=Number(sectionMeta(section)?.grade||0),all=[];for(const p of plans){const d=await parsePlan(p);for(const r of d.rows||[])if((!r.grade||Number(r.grade)===grade)&&same(canonicalSubject(r.subject||subject),subject))all.push(r)}displayRows=mergeRows(displayRows,normalizeRows(all));renderSource(section,subject,plans,false);renderTable()}catch(e){renderSource(section,subject,plans,false,e.message||String(e));renderTable()}
  }
  function roleVisibility(){ensureView();ensureNav();const on=teacherMode();document.getElementById("myYearPlanNav")?.classList.toggle("hidden",!on);document.getElementById("myYearPlanMobileNav")?.classList.toggle("hidden",!on);if(!on&&document.getElementById("myyearplan")?.classList.contains("active"))showView("dashboard")}
  function activateMyYearPlan(){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="myyearplan"));document.querySelectorAll(".nav-btn,.mobile-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view==="myyearplan"));renderMyYearPlan(true)}

  const previousShow=showView;showView=function(id){if(teacherMode()&&id==="myyearplan"){activateMyYearPlan();return}return previousShow(id)};
  const previousRole=applyRoleAccess;applyRoleAccess=function(){const r=previousRole();roleVisibility();return r};
  const previousOpen=openApp;openApp=function(){ensureView();ensureNav();const r=previousOpen();roleVisibility();return r};
  const previousRenderAll=renderAll;renderAll=function(){const r=previousRenderAll();roleVisibility();if(teacherMode()&&document.getElementById("myyearplan")?.classList.contains("active"))renderMyYearPlan(false);return r};
  const previousInit=init;init=function(){ensureStyles();ensureView();ensureNav();previousInit();roleVisibility()};
  window.renderMyYearPlan=renderMyYearPlan;
})();
