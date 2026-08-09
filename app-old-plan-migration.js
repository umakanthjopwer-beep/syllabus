const OLD_PLAN_MIGRATION_FORMAT="khalsa-old-year-plans-migration-v1";

async function loadOldPlanZipLibrary(){
  if(window.JSZip)return window.JSZip;
  await new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    s.onload=resolve;s.onerror=()=>reject(new Error("Could not load ZIP reader."));
    document.head.appendChild(s);
  });
  return window.JSZip;
}
function migrationSet(a){return [...new Set(a||[])].sort((x,y)=>String(x).localeCompare(String(y)))}
function sameMigrationSet(a,b){const x=migrationSet(a),y=migrationSet(b);return x.length===y.length&&x.every((v,i)=>same(v,y[i]))}
function migrationPlanSubjects(p){return typeof planSubjects==="function"?planSubjects(p):[p.subject].filter(Boolean)}
function migrationStoredMatch(entry,p){
  return !!p.storagePath&&same(p.fileName,entry.file_name)&&sameMigrationSet(migrationPlanSubjects(p),entry.subjects)&&sameMigrationSet(p.assignedSections,entry.sections)
}
function ensureOldPlanMigrationPanel(){
  const host=document.getElementById("yearplans");
  if(!host||document.getElementById("oldPlanMigrationPanel")||!isAdmin())return;
  const library=host.querySelector(".panel:last-child");
  const panel=document.createElement("div");panel.className="panel";panel.id="oldPlanMigrationPanel";
  panel.innerHTML=`
    <div class="panel-head"><div><div class="eyebrow">OLD APP MIGRATION</div><h3>Restore Old Published Plans</h3></div><span class="soft-badge">ONE-TIME ZIP IMPORT</span></div>
    <p class="small-muted">Use the migration ZIP prepared from the old app library. It restores the original files, exact old section assignments and verified dated schedule rows. Existing stored matches are skipped automatically.</p>
    <label class="restore-box"><span><b>Select migration ZIP</b><br><small class="small-muted">Khalsa_Old_Published_Year_Plans_Migration.zip</small></span><input id="oldPlanMigrationZip" type="file" accept=".zip,application/zip"></label>
    <div class="row-actions" style="margin-top:12px"><div id="oldPlanMigrationStatus" class="status-text">No migration ZIP selected.</div><button id="oldPlanMigrationBtn" class="primary" disabled>Restore published plans</button></div>
    <div id="oldPlanMigrationProgress" class="hidden" style="margin-top:12px"><div style="height:8px;background:#e9eef5;border-radius:999px;overflow:hidden"><div id="oldPlanMigrationBar" style="height:100%;width:0%;background:#2d66ba;transition:width .2s"></div></div><div id="oldPlanMigrationDetail" class="small-muted" style="margin-top:7px"></div></div>`;
  if(library)host.insertBefore(panel,library);else host.appendChild(panel);
  const input=document.getElementById("oldPlanMigrationZip"),btn=document.getElementById("oldPlanMigrationBtn");
  input.onchange=()=>{btn.disabled=!input.files?.[0];document.getElementById("oldPlanMigrationStatus").textContent=input.files?.[0]?`Ready: ${input.files[0].name}`:"No migration ZIP selected."};
  btn.onclick=restoreOldPublishedPlans;
}
async function restoreOldPublishedPlans(){
  const input=document.getElementById("oldPlanMigrationZip"),btn=document.getElementById("oldPlanMigrationBtn"),status=document.getElementById("oldPlanMigrationStatus"),progress=document.getElementById("oldPlanMigrationProgress"),bar=document.getElementById("oldPlanMigrationBar"),detail=document.getElementById("oldPlanMigrationDetail");
  const file=input?.files?.[0];if(!file)return;
  setBusy(btn,true,"Preparing…");progress.classList.remove("hidden");bar.style.width="0%";
  let succeeded=0,skipped=0,failed=[];
  try{
    const JSZip=await loadOldPlanZipLibrary(),zip=await JSZip.loadAsync(file),mf=zip.file("migration-manifest.json");
    if(!mf)throw new Error("migration-manifest.json is missing from this ZIP.");
    const manifest=JSON.parse(await mf.async("string"));
    if(manifest.format!==OLD_PLAN_MIGRATION_FORMAT)throw new Error("This is not the Khalsa old Year Plan migration ZIP.");
    const entries=manifest.entries||[];if(!entries.length)throw new Error("No Year Plans were found in the migration manifest.");
    await reloadRemote();renderAll();ensureOldPlanMigrationPanel();
    const initialPlans=[...data.plans];
    for(let i=0;i<entries.length;i++){
      const e=entries[i],pct=Math.round((i/entries.length)*100);bar.style.width=`${pct}%`;detail.textContent=`${i+1} of ${entries.length}: ${e.file_name}`;
      if(initialPlans.some(p=>migrationStoredMatch(e,p))){skipped++;continue}
      try{
        const zf=zip.file(e.zip_path);if(!zf)throw new Error(`Source file missing in ZIP: ${e.zip_path}`);
        const subject_ids=(e.subjects||[]).map(s=>REMOTE.subjectIdByName.get(canonicalSubject(s))).filter(Boolean),section_ids=(e.sections||[]).map(s=>REMOTE.sectionIdByName.get(s)).filter(Boolean);
        if(subject_ids.length!==(e.subjects||[]).length)throw new Error("A subject in this plan is missing from Subject Master.");
        if(section_ids.length!==(e.sections||[]).length)throw new Error("A class/section in this plan is missing from Section Master.");
        const weeks=(e.weeks||[]).map(w=>({week_no:Number(w.week_no||0),week_label:w.week_label||"",start_date:w.start_date||null,end_date:w.end_date||null,working_days:w.working_days??null,planned_periods:w.planned_periods??null,topic:w.topic||"",grade:w.grade??null,subject_id:REMOTE.subjectIdByName.get(canonicalSubject(w.subject||e.subjects[0]))||subject_ids[0],source_row:w.source_row??null}));
        const file_base64=await zf.async("base64");
        await smartApi({action:"save",file_name:e.file_name,file_type:e.file_type||"application/octet-stream",file_size:Number(e.file_size||0),file_base64,department:e.department||"",subject_ids,section_ids,weeks,parse_status:e.parse_status||"parsed",parse_message:e.parse_message||`Old app migration: ${weeks.length} dated row(s)`});
        succeeded++;
        const recovered=initialPlans.filter(p=>!p.storagePath&&same(p.fileName,e.file_name));
        for(const p of recovered){try{await remoteCall("yearplan_delete",{id:p.id})}catch(_){}}
      }catch(err){failed.push(`${e.file_name}: ${err.message||err}`)}
    }
    bar.style.width="100%";await reloadRemote();renderAll();ensureOldPlanMigrationPanel();
    status.textContent=`Migration complete — ${succeeded} restored, ${skipped} already present${failed.length?`, ${failed.length} failed`:""}.`;
    detail.textContent=failed.length?failed.slice(0,4).join(" | "):`All ${entries.length} published-plan records were processed.`;
    if(failed.length)alert(`Migration finished with ${failed.length} issue(s). You can run the same ZIP again; completed plans will be skipped.`);else alert("Old published Year Plans restored successfully.");
  }catch(err){status.textContent=err.message||String(err);detail.textContent="Migration stopped before completion.";alert(err.message||err)}finally{setBusy(btn,false);btn.disabled=!input?.files?.[0]}
}

const _oldPlanInject=injectSmartYearPlans;
injectSmartYearPlans=function(){_oldPlanInject();ensureOldPlanMigrationPanel()};
