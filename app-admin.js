function renderSetup(){
  if(!isAdmin())return;
  const os=data.setup.orientations||[];$("#orientationCount").innerHTML=`${os.filter(x=>x.active).length}<br><small>active</small>`;
  $("#orientationRows").innerHTML=os.map((o,i)=>`<div class="mrow"><div><strong>${esc(o.name)}</strong><small>${o.active?"Active":"Disabled"}</small></div><div class="buttons"><button onclick="renameOrientation(${i})">Edit</button><button onclick="toggleOrientation(${i})">${o.active?"Disable":"Enable"}</button><button class="delete" onclick="deleteOrientation(${i})">Delete</button></div></div>`).join("");
  $("#classMasterRows").innerHTML=SECTIONS.map(x=>`<div class="mrow"><div><strong>${x.section}</strong><small>${esc(x.batch)} · ${esc(x.program)}</small></div><div class="buttons"><button onclick="showClassInfo('${x.section}')">View</button></div></div>`).join("");
  $("#departmentCount").innerHTML=`${DEPARTMENT_ORDER.length}<br><small>active</small>`;$("#departmentMasterRows").innerHTML=DEPARTMENT_ORDER.map(d=>`<div class="mrow"><div><strong>${esc(d)}</strong><small>${DEPARTMENTS[d].length} subjects</small></div><div class="buttons"><button onclick="showDepartmentInfo('${d}')">View</button></div></div>`).join("");
  $("#teacherCount").innerHTML=`${data.setup.teachers.length}<br><small>imported</small>`;
  const teacherCard=$(".setup-grid .master-card:nth-child(4) .empty-master");if(teacherCard)teacherCard.innerHTML=`${data.setup.teachers.slice(0,10).map(t=>`<div class="mrow"><div><strong>${esc(t.name)}</strong><small>${esc(t.department||t.legacyDepartment||"Other")}</small></div></div>`).join("")}<div class="small-muted">Old-app seed: ${data.setup.sourceCounts?.teachers||data.setup.teachers.length} teachers · ${data.setup.sourceCounts?.teachingMappings||0} handling mappings.</div>`
}
window.renameOrientation=i=>{const o=data.setup.orientations[i],n=prompt("Orientation name",o.name);if(!n||same(n,o.name))return;o.name=norm(n);persist();renderSetup()};
window.toggleOrientation=i=>{data.setup.orientations[i].active=!data.setup.orientations[i].active;persist();renderSetup()};
window.deleteOrientation=i=>{const name=data.setup.orientations[i].name;if(SECTIONS.some(x=>x.program===name)){alert(`${name} is used by existing classes and cannot be deleted.`);return}if(confirm(`Delete ${name}?`)){data.setup.orientations.splice(i,1);persist();renderSetup()}};
window.showClassInfo=section=>{const x=sectionMeta(section),maps=data.setup.handlingMappings.filter(m=>m.section===section&&m.activeForSyllabus);alert(`${x.section}\nInternal batch: ${x.batch}\nOrientation: ${x.program}\nFloor: ${x.floor}\nSyllabus handling mappings: ${maps.length}`)};
window.showDepartmentInfo=d=>alert(`${d}\n\nSubjects:\n${DEPARTMENTS[d].join("\n")}`);

async function previewBulk(){
  const file=$("#bulkFile").files[0];if(!file){$("#bulkStatus").innerHTML='<div class="bulk-message">Select an Excel or CSV file first.</div>';return}
  if(!window.XLSX){$("#bulkStatus").innerHTML='<div class="bulk-message">Excel reader is unavailable.</div>';return}
  try{
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array"}),result={fileName:file.name,classes:[],teachers:[],subjects:[],mappings:[],issues:[]};
    for(const s of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[s],{defval:""}),n=s.toLowerCase();if(n==="classes"||n.includes("classes"))result.classes.push(...rows);else if(n==="teachers"||n.includes("teachers"))result.teachers.push(...rows);else if(n==="subjects"||n.includes("subjects"))result.subjects.push(...rows);else if(n.includes("teaching_mapping")||n.includes("handling")||n.includes("mapping")||n.includes("allocation"))result.mappings.push(...rows)}
    if(result.mappings.length){
      result.mappings.forEach((r,idx)=>{const cls=pick(r,["class section","class","section"]),sub=pick(r,["subject"]),teacher=pick(r,["teacher"]);if(!cls||!sub||!teacher)result.issues.push(`Mapping row ${idx+2}: Class, Subject and Teacher are required`)})
    }
    pendingBulk=result;$("#importBulkBtn").disabled=result.issues.length>0;renderBulkPreview()
  }catch(e){pendingBulk=null;$("#importBulkBtn").disabled=true;$("#bulkStatus").innerHTML=`<div class="bulk-message">Could not read file: ${esc(e.message||e)}</div>`}
}
function renderBulkPreview(){const p=pendingBulk;if(!p)return;$("#bulkStatus").innerHTML=`<div class="bulk-summary"><div class="bulk-stat"><strong>${p.classes.length}</strong><small>Classes & Sections</small></div><div class="bulk-stat"><strong>${p.teachers.length}</strong><small>Teachers</small></div><div class="bulk-stat"><strong>${p.subjects.length}</strong><small>Subjects</small></div><div class="bulk-stat"><strong>${p.mappings.length}</strong><small>Handling Mappings</small></div></div><div class="bulk-message">${p.issues.length?`<b>${p.issues.length} issue(s)</b> · ${esc(p.issues.slice(0,8).join(" · "))}`:"Validated. Import will merge/update the existing setup without deleting Year Plans or weekly history."}</div>`}
function importBulk(){
  if(!pendingBulk||pendingBulk.issues.length)return;
  const existingTeachers=new Map(data.setup.teachers.map(t=>[t.name.toLowerCase(),t]));
  pendingBulk.teachers.forEach(r=>{const name=norm(pick(r,["teacher name","teacher"]));if(!name)return;const legacyDept=norm(pick(r,["department"])),primary=canonicalSubject(pick(r,["primary subject","subject"]));let dept=legacyDept==="Maths"?"Mathematics":legacyDept==="Languages"?(primary.includes("Hindi")?"Hindi":primary.includes("Telugu")?"Telugu":""):DEPARTMENT_ORDER.includes(legacyDept)?legacyDept:"";existingTeachers.set(name.toLowerCase(),{name,department:dept,legacyDepartment:legacyDept,primarySubject:primary})});
  data.setup.teachers=[...existingTeachers.values()];
  if(pendingBulk.mappings.length){
    const mapKey=m=>[m.section,m.subject,m.teacher,m.week].join("|").toLowerCase(),merged=new Map(data.setup.handlingMappings.map(m=>[mapKey(m),m]));
    pendingBulk.mappings.forEach((r,idx)=>{const section=norm(pick(r,["class section","class","section"])),rawSub=norm(pick(r,["subject"])),teacher=norm(pick(r,["teacher"])),periods=Number(pick(r,["periods week","periods"])||0),week=norm(pick(r,["week"]))||"Every Week";if(!section||!rawSub||!teacher)return;const subject=canonicalSubject(rawSub),department=departmentForSubject(subject);const rec={id:"import-"+uid(),section,subject,teacher,periodsPerWeek:periods,week,department,originalSubject:rawSub,activeForSyllabus:!!department};merged.set(mapKey(rec),rec);if(rawSub==="A&R"){const ar={...rec,id:"import-"+uid(),subject:"Arithmetic",department:"Mathematics"};merged.set(mapKey(ar),ar)}});data.setup.handlingMappings=[...merged.values()]
  }
  data.setup.bulkImports.unshift({fileName:pendingBulk.fileName,importedAt:new Date().toISOString(),counts:{classes:pendingBulk.classes.length,teachers:pendingBulk.teachers.length,subjects:pendingBulk.subjects.length,mappings:pendingBulk.mappings.length}});
  persist();$("#bulkFile").value="";pendingBulk=null;$("#importBulkBtn").disabled=true;$("#bulkStatus").innerHTML='<div class="bulk-message"><b>Import completed.</b> Existing Year Plans, users and weekly history were preserved.</div>';renderAll()
}

function backup(){downloadBlob(JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2),"khalsa-syllabus-tracker-backup.json","application/json")}
function restoreBackup(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{data=migrateData(JSON.parse(r.result));persist();renderAll();alert("Backup restored successfully.")}catch(err){alert("Invalid backup file.")}};r.readAsText(file)}
async function installApp(){if(pendingInstall){pendingInstall.prompt();await pendingInstall.userChoice;pendingInstall=null}else alert('Use your browser menu and choose “Install app” or “Add to Home screen” if the install prompt is not shown.')}
function renderAll(){renderPlans();renderWeekly();renderDashboard();renderReports();renderDepartment();renderUsers();renderSetup()}
