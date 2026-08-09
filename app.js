const SECTIONS=[
{section:'6A',program:'C Batch'},{section:'6B',program:'C Batch'},{section:'6C',program:'Lead'},
{section:'7A',program:'C Batch'},{section:'7B',program:'C Batch'},{section:'7C',program:'Lead'},
{section:'8A',program:'C Batch'},{section:'8B',program:'C Batch'},{section:'8C',program:'Lead'},{section:'8D',program:'Techno'},
{section:'9A',program:'C Batch'},{section:'9B',program:'C Batch'},{section:'9C',program:'Lead'},{section:'9D',program:'Techno'},
{section:'10A',program:'C Batch'},{section:'10B',program:'C Batch'},{section:'10C',program:'Techno'}
];
const STORE={plans:'khalsa_plans_v2',weekly:'khalsa_weekly_v2'};
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const load=k=>JSON.parse(localStorage.getItem(k)||'[]');
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const weeks=Array.from({length:52},(_,i)=>`Week ${i+1}`);
function esc(v=''){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function statusOf(e){return Number(e.lagPeriods||0)>0?'Lagging':'On Track'}
function fillSelect(el,items,selected){el.innerHTML=items.map(x=>`<option${x===selected?' selected':''}>${esc(x)}</option>`).join('')}
function init(){
  fillSelect($('#ypSection'),SECTIONS.map(x=>x.section)); fillSelect($('#wkSection'),SECTIONS.map(x=>x.section));
  fillSelect($('#wkWeek'),weeks,'Week 1'); fillSelect($('#dashboardWeek'),['All Weeks',...weeks],'All Weeks');
  $('#ypSection').addEventListener('change',()=>$('#ypProgram').value=SECTIONS.find(x=>x.section===$('#ypSection').value)?.program||'C Batch');
  $('#ypProgram').value=SECTIONS[0].program;
  $$('.nav-btn').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $('#savePlanBtn').onclick=savePlan; $('#saveWeeklyBtn').onclick=saveWeekly;
  $('#planSearch').oninput=renderPlans; $('#dashboardWeek').onchange=renderDashboard;
  $('#reportMode').onchange=renderReports; $('#reportFilter').oninput=renderReports; $('#exportCsvBtn').onclick=exportCsv;
  $('#backupBtn').onclick=backup; $('#restoreInput').onchange=restore;
  renderAll();
}
function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));const meta={dashboard:['Dashboard','Weekly syllabus progress at a glance'],yearplans:['Year Plans','Upload and manage academic year plans'],weekly:['Weekly Tracking','Record planned vs actual syllabus progress'],reports:['Reports','Teacher, class, subject and week-wise analysis'],setup:['Initial Setup','Academic sections and programme mapping']}[id];$('#pageTitle').textContent=meta[0];$('#pageSubtitle').textContent=meta[1];}
async function savePlan(){
  const file=$('#ypFile').files[0], subject=$('#ypSubject').value.trim(), teacher=$('#ypTeacher').value.trim();
  if(!file||!subject){$('#planStatus').textContent='Select a file and enter the subject.';return}
  const section=$('#ypSection').value; const program=$('#ypProgram').value;
  let preview='';
  try{preview=await parsePreview(file)}catch(e){preview='Preview parsing unavailable for this file.'}
  const plans=load(STORE.plans); plans.unshift({id:crypto.randomUUID(),section,program,subject,teacher,fileName:file.name,enabled:true,uploadedAt:new Date().toISOString(),preview}); save(STORE.plans,plans);
  $('#planStatus').textContent='Year Plan saved.'; $('#ypFile').value=''; renderAll();
}
async function parsePreview(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','csv'].includes(ext) && window.XLSX){const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_csv(ws).slice(0,1200)}
  if(ext==='pdf') return 'PDF attached. Detailed PDF extraction will be handled in the server-connected version.';
  return '';
}
function saveWeekly(){
  const e={id:crypto.randomUUID(),week:$('#wkWeek').value,section:$('#wkSection').value,subject:$('#wkSubject').value.trim(),teacher:$('#wkTeacher').value.trim(),planned:$('#wkPlanned').value.trim(),actual:$('#wkActual').value.trim(),plannedPeriods:Number($('#wkPlannedPeriods').value||0),takenPeriods:Number($('#wkTakenPeriods').value||0),lagPeriods:Number($('#wkLagPeriods').value||0),reason:$('#wkReason').value.trim(),savedAt:new Date().toISOString()};
  if(!e.subject){$('#weeklyStatus').textContent='Enter the subject before saving.';return}
  const rows=load(STORE.weekly);rows.unshift(e);save(STORE.weekly,rows);$('#weeklyStatus').textContent='Weekly progress saved.';renderAll();
}
function renderAll(){renderPlans();renderWeekly();renderDashboard();renderReports();renderSetup();}
function renderPlans(){const q=$('#planSearch')?.value?.toLowerCase()||'';const rows=load(STORE.plans).filter(p=>[p.section,p.program,p.subject,p.teacher,p.fileName].join(' ').toLowerCase().includes(q));$('#planTable').innerHTML=rows.length?rows.map(p=>`<tr><td>${esc(p.section)}</td><td>${esc(p.program)}</td><td>${esc(p.subject)}</td><td>${esc(p.teacher||'-')}</td><td title="${esc(p.preview||'')}">${esc(p.fileName)}</td><td><button class="secondary" onclick="togglePlan('${p.id}')">${p.enabled?'Enabled':'Disabled'}</button></td><td><button class="icon-btn" onclick="deletePlan('${p.id}')">Delete</button></td></tr>`).join(''):'<tr><td colspan="7">No Year Plans uploaded yet.</td></tr>'}
window.togglePlan=id=>{const a=load(STORE.plans);const p=a.find(x=>x.id===id);if(p)p.enabled=!p.enabled;save(STORE.plans,a);renderAll()};
window.deletePlan=id=>{save(STORE.plans,load(STORE.plans).filter(x=>x.id!==id));renderAll()};
function renderWeekly(){const rows=load(STORE.weekly);$('#weeklyTable').innerHTML=rows.length?rows.slice(0,100).map(e=>`<tr><td>${esc(e.week)}</td><td>${esc(e.section)}</td><td>${esc(e.subject)}</td><td>${esc(e.teacher||'-')}</td><td>${e.lagPeriods}</td><td class="${e.lagPeriods>0?'danger-text':'ok-text'}">${statusOf(e)}</td><td><button class="icon-btn" onclick="deleteWeekly('${e.id}')">Delete</button></td></tr>`).join(''):'<tr><td colspan="7">No weekly entries yet.</td></tr>'}
window.deleteWeekly=id=>{save(STORE.weekly,load(STORE.weekly).filter(x=>x.id!==id));renderAll()};
function renderDashboard(){const plans=load(STORE.plans).filter(p=>p.enabled), all=load(STORE.weekly), week=$('#dashboardWeek')?.value||'All Weeks';const rows=week==='All Weeks'?all:all.filter(e=>e.week===week);$('#statSections').textContent=SECTIONS.length;$('#statPlans').textContent=plans.length;$('#statOnTrack').textContent=rows.filter(e=>e.lagPeriods<=0).length;$('#statLagging').textContent=rows.filter(e=>e.lagPeriods>0).length;$('#sectionCards').innerHTML=SECTIONS.map(s=>{const sr=rows.filter(e=>e.section===s.section),lag=sr.filter(e=>e.lagPeriods>0).length,plansCount=plans.filter(p=>p.section===s.section).length;return `<article class="section-card"><div class="row"><strong>${s.section}</strong><span class="badge ${lag?'lag':'ok'}">${lag?lag+' lagging':'On track'}</span></div><p>${s.program}</p><div class="row"><small>${sr.length} updates</small><small>${plansCount} plans</small></div></article>`}).join('')}
function renderReports(){const mode=$('#reportMode')?.value||'teacher',filter=$('#reportFilter')?.value.toLowerCase()||'';let rows=load(STORE.weekly).filter(e=>[e.week,e.section,e.subject,e.teacher,e.planned,e.actual].join(' ').toLowerCase().includes(filter));const key={teacher:'teacher',class:'section',subject:'subject',week:'week'}[mode];rows.sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||'')));const lag=rows.filter(e=>e.lagPeriods>0).length;const totalLag=rows.reduce((n,e)=>n+Number(e.lagPeriods||0),0);$('#reportSummary').innerHTML=`<span class="summary-pill">Entries: <b>${rows.length}</b></span><span class="summary-pill">Lagging entries: <b>${lag}</b></span><span class="summary-pill">Periods lagging: <b>${totalLag}</b></span>`;$('#reportTable').innerHTML=rows.length?rows.map(e=>`<tr><td>${esc(e.week)}</td><td>${esc(e.section)}</td><td>${esc(e.subject)}</td><td>${esc(e.teacher||'-')}</td><td>${esc(e.planned||'-')}</td><td>${esc(e.actual||'-')}</td><td>${e.lagPeriods}</td><td class="${e.lagPeriods>0?'danger-text':'ok-text'}">${statusOf(e)}</td></tr>`).join(''):'<tr><td colspan="8">No report data available.</td></tr>'}
function renderSetup(){$('#setupGrid').innerHTML=SECTIONS.map(s=>`<article class="setup-card"><h3>Class ${s.section}</h3><p>Program: ${s.program}</p></article>`).join('')}
function exportCsv(){const rows=load(STORE.weekly);const h=['Week','Section','Subject','Teacher','Planned Topic','Actual Topic','Planned Periods','Periods Taken','Periods Lagging','Reason','Status'];const body=rows.map(e=>[e.week,e.section,e.subject,e.teacher,e.planned,e.actual,e.plannedPeriods,e.takenPeriods,e.lagPeriods,e.reason,statusOf(e)]);const csv=[h,...body].map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');downloadBlob(csv,'khalsa-syllabus-report.csv','text/csv')}
function backup(){downloadBlob(JSON.stringify({plans:load(STORE.plans),weekly:load(STORE.weekly),exportedAt:new Date().toISOString()},null,2),'khalsa-syllabus-backup.json','application/json')}
function restore(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);save(STORE.plans,d.plans||[]);save(STORE.weekly,d.weekly||[]);renderAll();alert('Backup restored successfully.')}catch(e){alert('Invalid backup file.')}};r.readAsText(f)}
function downloadBlob(data,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
init();
