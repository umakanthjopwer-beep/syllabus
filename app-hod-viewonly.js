function applyHodDepartmentAccess(){
  if(currentUser?.role!=="HOD")return;
  const dep=document.getElementById("department");
  if(dep){
    const h=dep.querySelector(".page-head h2"),p=dep.querySelector(".page-head p");
    if(h)h.textContent="My department lagging report";
    if(p)p.textContent="View the complete department lagging status here. Use Weekly Status only for your own handling classes and subjects.";
  }
  const weekly=document.getElementById("weekly");
  if(weekly){const h=weekly.querySelector(".page-head h2"),p=weekly.querySelector(".page-head p");if(h)h.textContent="My syllabus lagging report";if(p)p.textContent="Enter lagging status only for your own handling classes. Other teachers' department entries are view-only in My Department and Reports."}
}

const _hodApplyRoleAccess=applyRoleAccess;
applyRoleAccess=function(){
  _hodApplyRoleAccess();
  if(currentUser?.role!=="HOD")return;
  const allowed=new Set(["dashboard","department","weekly","reports"]);
  document.querySelectorAll(".nav-btn,.mobile-nav button").forEach(b=>b.classList.toggle("hidden",!allowed.has(b.dataset.view)));
  document.getElementById("departmentNav")?.classList.remove("hidden");
  document.getElementById("departmentMobileNav")?.classList.remove("hidden");
  if(!allowed.has(document.querySelector(".view.active")?.id||""))showView("department");
  applyHodDepartmentAccess()
};

const _hodShowView=showView;
showView=function(id){
  if(currentUser?.role==="HOD"&&!new Set(["dashboard","department","weekly","reports"]).has(id))id="department";
  const out=_hodShowView(id);applyHodDepartmentAccess();if(id==="weekly"&&typeof prepareOwnWeeklyEntry==="function")prepareOwnWeeklyEntry();return out
};

const _hodOpenApp=openApp;
openApp=function(){
  _hodOpenApp();
  if(currentUser?.role==="HOD"){applyHodDepartmentAccess();if(typeof prepareOwnWeeklyEntry==="function")prepareOwnWeeklyEntry();showView("department")}
};
