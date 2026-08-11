// Year-plan integrity fixes: prefer complete subject plans, expose the full source range,
// and prevent page-level subject misclassification during automatic PDF capture.
(function(){
  function rowSubject(row,plan){return canonicalSubject(row?.subject||plan?.subject||"")}
  function planRowsForSubject(plan,section,subject){
    const grade=Number(sectionMeta(section).grade),wanted=canonicalSubject(subject);
    return (plan?.weeks||[]).filter(w=>
      (w.grade==null||Number(w.grade)===grade)&&
      same(rowSubject(w,plan),wanted)&&
      !!w.startDate
    ).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||String(a.endDate||a.startDate).localeCompare(String(b.endDate||b.startDate)))
  }
  function planEnd(rows){return rows.reduce((m,r)=>{const d=String(r.endDate||r.startDate||"");return d>m?d:m},"")}
  function planStart(rows){return rows.reduce((m,r)=>{const d=String(r.startDate||"");return !m||d<m?d:m},"")}
  function topicCount(rows){return rows.filter(r=>String(r.topic||"").trim()).length}
  function quality(plan,rows){
    // The last covered source date is the most important signal. This makes a complete
    // June-Jan plan win over an older/partial June-Aug duplicate with the same filename.
    const end=planEnd(rows).replaceAll("-","");
    const start=planStart(rows).replaceAll("-","");
    return Number(end||0)*1e9 + rows.length*1e5 + topicCount(rows)*100 + Number(start||0)%100;
  }

  // Choose the most complete valid plan for the selected class + subject instead of the
  // first matching database record. Old/partial imports can therefore no longer truncate
  // the teacher week dropdown at July/August when a fuller source exists.
  planRowsFor=function(section,subject){
    const wanted=canonicalSubject(subject);
    const candidates=(typeof visiblePlans==="function"?visiblePlans():data.plans||[])
      .filter(p=>p.enabled!==false&&p.assignedSections?.includes(section)&&planHasSubject(p,wanted))
      .map(p=>({plan:p,rows:planRowsForSubject(p,section,wanted)}))
      .filter(x=>x.rows.length);
    if(!candidates.length)return{plan:null,rows:[]};
    candidates.sort((a,b)=>quality(b.plan,b.rows)-quality(a.plan,a.rows));
    return candidates[0];
  };

  // Teacher-visible plan filtering must respect all subjects linked to a shared plan,
  // not only the plan's legacy primary subject field.
  const previousVisiblePlans=visiblePlans;
  visiblePlans=function(){
    if(currentUser?.role!=="Teacher")return previousVisiblePlans();
    const pairs=typeof ownTeacherPairs==="function"?ownTeacherPairs():[];
    return (data.plans||[]).filter(p=>p.enabled!==false&&pairs.some(x=>
      p.assignedSections?.includes(x.section)&&planHasSubject(p,canonicalSubject(x.subject))
    ));
  };

  function explicitPageSubject(text){
    const z=String(text||"");
    const m=z.match(/Subject\s*:\s*(Mathematics|Maths|Physics|Chemistry|Biology|English|Social(?: Science)?|Information Technology|IT|Hindi|Telugu)\b/i);
    if(!m)return"";
    const s=m[1].toLowerCase();
    if(s==="maths"||s==="mathematics")return"Mathematics";
    if(s.startsWith("social"))return"Social";
    if(s==="information technology"||s==="it")return"IT";
    return m[1][0].toUpperCase()+m[1].slice(1).toLowerCase();
  }

  // The original parser used the first detected subject on a page. On combined plans that
  // can assign rows to the wrong subject. Prefer an explicit "Subject: ..." page heading.
  if(typeof pdfPageTableRows==="function"){
    const basePdfPageTableRows=pdfPageTableRows;
    pdfPageTableRows=function(items,pageText){
      const rows=basePdfPageTableRows(items,pageText),explicit=explicitPageSubject(pageText);
      if(!explicit||!rows.length)return rows;
      return rows.map(r=>{
        if(/^Track\s+[AB]$/i.test(String(r.subject||"")))return r;
        return{...r,subject:canonicalSubject(explicit)};
      });
    };
  }

  function latestDateInText(text){
    let latest="";
    for(const m of String(text||"").replaceAll("‐","-").replaceAll("–","-").matchAll(/\b(\d{1,2})[.\-](\d{1,2})[.\-](20\d{2})\b/g)){
      const iso=`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
      if(iso>latest)latest=iso;
    }
    return latest;
  }
  function daysBetween(a,b){if(!a||!b)return 0;return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000)}

  // Validate smart capture against the actual date span present in the file. If the PDF
  // contains later dated rows but capture stops much earlier, flag it for review instead of
  // silently treating a partial syllabus as complete. Also keep auto-detected subjects only
  // when dated rows were actually captured for them.
  const baseSmartParse=smartParse;
  smartParse=async function(file){
    const draft=await baseSmartParse(file);
    const rows=(draft.rows||[]).filter(r=>r.startDate);
    if(rows.length){
      const rowSubjects=[...new Set(rows.map(r=>canonicalSubject(r.subject||"")).filter(Boolean))];
      if(rowSubjects.length)draft.subjects=rowSubjects;
      const sourceLast=latestDateInText(draft.text),capturedLast=planEnd(rows);
      draft.sourceLastDate=sourceLast;draft.capturedLastDate=capturedLast;
      draft.captureIncomplete=!!(sourceLast&&capturedLast&&daysBetween(capturedLast,sourceLast)>21);
      if(draft.captureIncomplete){
        draft.captureWarning=`Incomplete auto capture: source continues to ${sourceLast}, but dated rows were captured only to ${capturedLast}. Review before publishing.`;
      }
    }
    return draft;
  };

  // Add a visible integrity warning during import review. This does not discard source data;
  // it makes incomplete capture obvious so a partial plan is never mistaken for a full one.
  if(typeof renderSmartReview==="function"){
    const baseRenderSmartReview=renderSmartReview;
    renderSmartReview=function(){
      const r=baseRenderSmartReview();
      if(smartDraft?.captureWarning){
        const host=document.getElementById("smartReview");
        if(host&&!document.getElementById("yearPlanCaptureWarning")){
          const warn=document.createElement("div");warn.id="yearPlanCaptureWarning";warn.className="login-error";warn.style.margin="12px 0";warn.textContent=smartDraft.captureWarning;host.prepend(warn);
        }
      }
      return r;
    };
  }

  // Refill the teacher form after remote data refresh so the week list always reflects the
  // newly selected best/full plan without requiring logout/login or a second manual change.
  const baseReloadRemoteIntegrity=reloadRemote;
  reloadRemote=async function(){
    const r=await baseReloadRemoteIntegrity();
    if(document.getElementById("wkWeek")&&typeof fillWeeklyCalendarFromPlan==="function"){
      setTimeout(()=>{try{fillWeeklyCalendarFromPlan(true)}catch(e){console.warn("Year-plan week refresh",e)}},0);
    }
    return r;
  };
})();