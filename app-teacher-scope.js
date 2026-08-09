const WEEKLY_ENTRY_ROLES=new Set(["Teacher","HOD","Admin","Super Admin"]);
function canEnterOwnWeekly(){return!!currentUser&&WEEKLY_ENTRY_ROLES.has(currentUser.role)}
function loggedTeacherAlias(){
  if(!currentUser)return"";
  const linked=currentUser.teacherId&&REMOTE?.teacherById?.get?REMOTE.teacherById.get(currentUser.teacherId):null;
  return linked?.name||currentUser.name||""
}
function ownTeacherMappings(){
  if(!canEnterOwnWeekly())return[];
  const alias=loggedTeacherAlias();
  return (data.setup?.handlingMappings||[]).filter(m=>m.activeForSyllabus&&same(m.teacher,alias))
}
function ownTeacherPairs(){return ownTeacherMappings().map(m=>({section:m.section,subject:canonicalSubject(m.subject),department:m.department,teacher:m.teacher}))}
function ownTeacherSections(){return[...new Set(ownTeacherPairs().map(x=>x.section))]}
function ownTeacherSubjectsFor(section){return[...new Set(ownTeacherPairs().filter(x=>x.section===section).map(x=>x.subject))]}

// Teacher pages are fully limited to the teacher's own mappings. HOD/Admin/Super Admin retain their wider report/admin scope,
// but the Weekly Status ENTRY controls below are still restricted to their own handling combinations.
const _teacherScopeCurrentScope=currentScope;
currentScope=function(){
  if(currentUser?.role!=="Teacher")return _teacherScopeCurrentScope();
  const maps=ownTeacherPairs();
  return{departments:[...new Set(maps.map(x=>x.department).filter(Boolean))],sections:[...new Set(maps.map(x=>x.section))],subjects:[...new Set(maps.map(x=>x.subject))]}
};

const _teacherScopeVisiblePlans=visiblePlans;
visiblePlans=function(){
  if(currentUser?.role!=="Teacher")return _teacherScopeVisiblePlans();
  const pairs=ownTeacherPairs();
  return data.plans.filter(p=>p.enabled!==false&&pairs.some(x=>x.subject===canonicalSubject(p.subject)&&p.assignedSections?.includes(x.section)))
};

const _teacherScopeVisibleWeekly=visibleWeekly;
visibleWeekly=function(){
  if(currentUser?.role!=="Teacher")return _teacherScopeVisibleWeekly();
  const alias=loggedTeacherAlias();
  return data.weekly.filter(w=>same(w.teacher,alias))
};

const _teacherScopeUpdateSubjects=updateWeeklySubjects;
updateWeeklySubjects=function(){
  if(!canEnterOwnWeekly())return _teacherScopeUpdateSubjects();
  const section=document.getElementById("wkSection")?.value||ownTeacherSections()[0]||"";
  const subjects=ownTeacherSubjectsFor(section),sel=document.getElementById("wkSubject"),old=canonicalSubject(sel?.value||"");
  if(sel)fillSelect(sel,subjects,subjects.includes(old)?old:subjects[0]||"")
};

function prepareOwnWeeklyEntry(){
  if(!canEnterOwnWeekly())return;
  const sections=ownTeacherSections(),sectionSel=document.getElementById("wkSection"),oldSection=sectionSel?.value||"";
  if(sectionSel)fillSelect(sectionSel,sections,sections.includes(oldSection)?oldSection:sections[0]||"");
  updateWeeklySubjects();
  const teacher=document.getElementById("wkTeacher");
  if(teacher){teacher.value=loggedTeacherAlias();teacher.readOnly=true;teacher.setAttribute("aria-readonly","true");teacher.style.background="#f7f9fc";teacher.style.cursor="default"}
  const save=document.getElementById("saveWeeklyBtn");if(save)save.style.display="";
  const weekly=document.getElementById("weekly");
  if(weekly){const h=weekly.querySelector(".page-head h2"),p=weekly.querySelector(".page-head p");if(h)h.textContent="My syllabus lagging report";if(p)p.textContent="Only your own handling class and subject combinations are available for entry. Year Plan fields are auto-filled; enter only actual progress and lag details."}
  const note=document.getElementById("weeklyStatus");
  if(note&&!sections.length){note.textContent="No syllabus handling classes are mapped to this login. Contact the Admin.";note.classList.add("error");if(save)save.disabled=true}else if(save)save.disabled=false;
  if(typeof fillWeeklyFromPlan==="function"&&sections.length)fillWeeklyFromPlan()
}

const _teacherScopeApplyRoleAccess=applyRoleAccess;
applyRoleAccess=function(){
  _teacherScopeApplyRoleAccess();
  if(currentUser?.role!=="Teacher")return;
  document.querySelectorAll(".nav-btn,.mobile-nav button").forEach(b=>b.classList.toggle("hidden",b.dataset.view!=="weekly"));
  document.getElementById("departmentNav")?.classList.add("hidden");document.getElementById("departmentMobileNav")?.classList.add("hidden");
  if(document.querySelector(".view.active")?.id!=="weekly")showView("weekly")
};

const _teacherScopeShowView=showView;
showView=function(id){if(currentUser?.role==="Teacher")id="weekly";return _teacherScopeShowView(id)};

const _teacherScopeFillWeekly=fillWeeklyFromPlan;
fillWeeklyFromPlan=function(){
  if(canEnterOwnWeekly()){
    const sections=ownTeacherSections(),sectionSel=document.getElementById("wkSection");
    if(sectionSel&&sections.length&&!sections.includes(sectionSel.value))fillSelect(sectionSel,sections,sections[0]);
    updateWeeklySubjects()
  }
  _teacherScopeFillWeekly();
  if(canEnterOwnWeekly()){
    const teacher=document.getElementById("wkTeacher");if(teacher)teacher.value=loggedTeacherAlias()
  }
};

const _teacherScopeOpenApp=openApp;
openApp=function(){
  _teacherScopeOpenApp();
  if(canEnterOwnWeekly())prepareOwnWeeklyEntry();
  if(currentUser?.role==="Teacher"){showView("weekly");if(typeof renderWeekly==="function")renderWeekly()}
};

const _teacherScopeInit=init;
init=function(){
  _teacherScopeInit();
  const section=document.getElementById("wkSection"),subject=document.getElementById("wkSubject");
  if(section)section.onchange=()=>{updateWeeklySubjects();fillWeeklyFromPlan()};
  if(subject)subject.onchange=fillWeeklyFromPlan
};
