// Weekly Reports v43: multi-select filters + Class-wise / Subject-wise sorting.
(function(){
  const q=s=>document.querySelector(s);
  const txt=v=>String(v??"").trim();
  const state=window.__REPORT_MULTI_STATE_V43__||{
    subjects:null,classes:null,orientations:null,statuses:null,sort:"class"
  };
  window.__REPORT_MULTI_STATE_V43__=state;

  function orientationFor(r){
    if(txt(r?.program))return txt(r.program);
    try{const m=sectionMeta(r?.section);return txt(m?.program||m?.orientation)}catch(_){return""}
  }
  function baseRows(){
    try{return reportRowsForWeek(REPORT_STATE.weekStart,REPORT_STATE.weekEnd)||[]}catch(_){return[]}
  }
  function gradeOf(r){try{return Number(sectionMeta(r.section)?.grade||0)}catch(_){return 0}}
  function classCompare(a,b){return gradeOf(a)-gradeOf(b)||txt(a.section).localeCompare(txt(b.section),undefined,{numeric:true,sensitivity:"base"})}
  function subjectCompare(a,b){return txt(a.subject).localeCompare(txt(b.subject),undefined,{numeric:true,sensitivity:"base"})}
  function statusMatch(r,s){
    if(s==="Submitted")return !!r.submitted;
    if(s==="Pending")return !r.submitted;
    if(s==="Lagging")return !!r.submitted&&Number(r.lagPeriods||0)>0;
    if(s==="On Track")return !!r.submitted&&Number(r.lagPeriods||0)===0;
    return true
  }
  function unique(arr){return[...new Set(arr.map(txt).filter(Boolean))]}
  function currentOptions(){
    const rows=baseRows();
    return{
      subjects:unique(rows.map(r=>r.subject)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"})),
      classes:unique(rows.map(r=>r.section)).sort((a,b)=>{const ra=rows.find(r=>r.section===a)||{section:a},rb=rows.find(r=>r.section===b)||{section:b};return classCompare(ra,rb)}),
      orientations:unique(rows.map(orientationFor)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"})),
      statuses:["Submitted","Pending","Lagging","On Track"]
    }
  }
  function normalizeSelection(key,options){
    const s=state[key];if(!s)return;
    const next=new Set([...s].filter(x=>options.includes(x)));
    state[key]=next.size?next:null
  }
  function shortLabel(set,allLabel,suffix){
    if(!set||!set.size)return allLabel;
    const a=[...set];
    if(a.length<=3)return a.join(", ");
    return `${a.length} ${suffix} selected`
  }
  function labels(options=currentOptions()){
    return{
      subject:shortLabel(state.subjects,"All subjects","subjects"),
      classes:shortLabel(state.classes,"All classes","classes"),
      orientation:shortLabel(state.orientations,"All orientations","orientations"),
      status:shortLabel(state.statuses,"All statuses","statuses"),
      subjectSingle:!!state.subjects&&state.subjects.size===1,
      sort:state.sort||"class"
    }
  }

  // Single filtering authority used by preview, PDF and Excel.
  reportFilteredRows=function(){
    const options=currentOptions();
    normalizeSelection("subjects",options.subjects);normalizeSelection("classes",options.classes);normalizeSelection("orientations",options.orientations);normalizeSelection("statuses",options.statuses);
    let rows=baseRows();
    if(state.subjects)rows=rows.filter(r=>state.subjects.has(txt(r.subject)));
    if(state.classes)rows=rows.filter(r=>state.classes.has(txt(r.section)));
    if(state.orientations)rows=rows.filter(r=>state.orientations.has(orientationFor(r)));
    if(state.statuses)rows=rows.filter(r=>[...state.statuses].some(s=>statusMatch(r,s)));
    rows.sort(state.sort==="subject"?(a,b)=>subjectCompare(a,b)||classCompare(a,b):(a,b)=>classCompare(a,b)||subjectCompare(a,b));
    const meta=labels(options);
    REPORT_STATE={...REPORT_STATE,subject:meta.subject,status:meta.status,orientation:meta.orientation,rows};
    window.__REPORT_FILTER_META_V43__={...meta,subjectCount:state.subjects?.size||options.subjects.length,classCount:state.classes?.size||options.classes.length};
    return rows
  };

  function findOwner(id){const el=q(id);return el?.closest("label")||null}
  function hideLegacy(){
    ["#printReportSubject","#printReportStatus","#printReportOrientation"].forEach(id=>{const o=findOwner(id);if(o)o.style.display="none"})
  }
  function ensureStyles(){
    if(q("#reportMultiSortStylesV43"))return;
    const s=document.createElement("style");s.id="reportMultiSortStylesV43";s.textContent=`
      #reports .print-report-filter{grid-template-columns:repeat(3,minmax(180px,1fr))!important;gap:12px!important;align-items:end!important}
      .report-v43-field{display:grid;gap:7px;font-size:9px;letter-spacing:.6px;font-weight:800;color:#74839a;text-transform:uppercase;position:relative;min-width:0}
      .report-v43-multi{position:relative;min-width:0}.report-v43-multi>summary{list-style:none;cursor:pointer;width:100%;border:1px solid #ccd6e4;border-radius:10px;padding:11px 34px 11px 11px;background:#fff;color:#172235;font-size:13px;font-weight:600;text-transform:none;letter-spacing:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative}
      .report-v43-multi>summary::-webkit-details-marker{display:none}.report-v43-multi>summary:after{content:'⌄';position:absolute;right:12px;top:50%;transform:translateY(-55%);font-size:16px;color:#60718a}
      .report-v43-options{position:absolute;z-index:2000;left:0;right:0;top:calc(100% + 5px);max-height:300px;overflow:auto;background:#fff;border:1px solid #ccd6e4;border-radius:12px;box-shadow:0 12px 28px rgba(35,50,75,.18);padding:7px}
      .report-v43-option{display:flex!important;grid-template-columns:20px 1fr!important;align-items:center!important;gap:8px!important;padding:8px!important;border-radius:8px!important;font-size:12px!important;font-weight:600!important;letter-spacing:0!important;text-transform:none!important;color:#172235!important;cursor:pointer}.report-v43-option:hover{background:#f4f7fb}.report-v43-option input{width:16px;height:16px;margin:0}
      #reportSortByV43{width:100%;border:1px solid #ccd6e4;border-radius:10px;padding:11px;background:#fff;color:#172235}
      @media(max-width:900px){#reports .print-report-filter{grid-template-columns:repeat(2,minmax(160px,1fr))!important}}
      @media(max-width:760px){#reports .print-report-filter{grid-template-columns:1fr!important}.report-v43-options{position:fixed;left:16px;right:16px;top:20%;max-height:60vh}}
    `;document.head.appendChild(s)
  }
  function field(id,title){
    const wrap=document.createElement("div");wrap.id=id+"Field";wrap.className="report-v43-field";
    const cap=document.createElement("span");cap.textContent=title;wrap.appendChild(cap);
    const d=document.createElement("details");d.id=id;d.className="report-v43-multi";
    const sm=document.createElement("summary");sm.textContent="All";d.appendChild(sm);
    const box=document.createElement("div");box.className="report-v43-options";d.appendChild(box);wrap.appendChild(d);return wrap
  }
  function ensureControls(){
    const filter=q("#reports .print-report-filter");if(!filter)return false;
    hideLegacy();ensureStyles();
    const count=filter.querySelector(".record-count-box");
    if(!q("#reportSubjectsV43"))filter.insertBefore(field("reportSubjectsV43","Subjects"),count||null);
    if(!q("#reportClassesV43"))filter.insertBefore(field("reportClassesV43","Class / Section"),count||null);
    if(!q("#reportOrientationsV43"))filter.insertBefore(field("reportOrientationsV43","Orientation / Programme"),count||null);
    if(!q("#reportStatusesV43"))filter.insertBefore(field("reportStatusesV43","Status Included"),count||null);
    if(!q("#reportSortByV43")){
      const wrap=document.createElement("label");wrap.className="report-v43-field";wrap.id="reportSortFieldV43";wrap.append(document.createTextNode("Sort By"));
      const sel=document.createElement("select");sel.id="reportSortByV43";sel.innerHTML='<option value="class">Class wise</option><option value="subject">Subject wise</option>';sel.value=state.sort||"class";sel.onchange=()=>{state.sort=sel.value||"class";renderReports()};wrap.appendChild(sel);filter.insertBefore(wrap,count||null)
    }
    return true
  }
  function buildMulti(id,key,options,allLabel,suffix){
    const d=q("#"+id);if(!d)return;normalizeSelection(key,options);
    const summary=d.querySelector("summary"),box=d.querySelector(".report-v43-options"),s=state[key];
    summary.textContent=shortLabel(s,allLabel,suffix);
    box.innerHTML="";
    const all=document.createElement("label");all.className="report-v43-option";all.innerHTML=`<input type="checkbox" data-all="1" ${!s?"checked":""}><span>${allLabel}</span>`;box.appendChild(all);
    for(const v of options){const row=document.createElement("label");row.className="report-v43-option";const checked=s?.has(v)?"checked":"";row.innerHTML=`<input type="checkbox" value="${String(v).replace(/&/g,"&amp;").replace(/\"/g,"&quot;")}" ${checked}><span></span>`;row.querySelector("span").textContent=v;box.appendChild(row)}
    box.onchange=e=>{
      const input=e.target;if(!(input instanceof HTMLInputElement))return;
      if(input.dataset.all){state[key]=null}else{
        let next=state[key]?new Set(state[key]):new Set();
        if(input.checked)next.add(input.value);else next.delete(input.value);
        state[key]=next.size?next:null
      }
      renderReports()
    }
  }
  function syncControls(){
    if(!ensureControls())return;
    const o=currentOptions();
    buildMulti("reportSubjectsV43","subjects",o.subjects,"All subjects","subjects");
    buildMulti("reportClassesV43","classes",o.classes,"All classes","classes");
    buildMulti("reportOrientationsV43","orientations",o.orientations,"All orientations","orientations");
    buildMulti("reportStatusesV43","statuses",o.statuses,"All statuses","statuses");
    const sort=q("#reportSortByV43");if(sort)sort.value=state.sort||"class";
    hideLegacy()
  }

  if(typeof renderReports==="function"){
    const previous=renderReports;
    renderReports=function(){const out=previous.apply(this,arguments);queueMicrotask(syncControls);return out}
  }
  setTimeout(()=>{try{syncControls()}catch(e){console.warn("Report multi-select init",e)}},0);
  window.__REPORT_MULTI_SORT_V43__=true;
})();