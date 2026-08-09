function applyHodViewOnly(){
  if(currentUser?.role!=="HOD")return;
  const weekly=document.getElementById("weekly");
  if(weekly){
    const save=document.getElementById("saveWeeklyBtn");if(save)save.style.display="none";
    const entry=weekly.querySelector(".panel,.form-card,.card");
    if(entry&&entry.querySelector("#wkSection"))entry.style.display="none";
  }
  const dep=document.getElementById("department");
  if(dep){
    const h=dep.querySelector(".page-head h2");const p=dep.querySelector(".page-head p");
    if(h)h.textContent="My department lagging report";
    if(p)p.textContent="View-only department status. HOD accounts cannot submit or edit teacher lagging entries.";
  }
}

const _hodApplyRoleAccess=applyRoleAccess;
applyRoleAccess=function(){
  _hodApplyRoleAccess();
  if(currentUser?.role!=="HOD")return;
  const allowed=new Set(["dashboard","department","reports"]);
  document.querySelectorAll(".nav-btn,.mobile-nav button").forEach(b=>b.classList.toggle("hidden",!allowed.has(b.dataset.view)));
  document.getElementById("departmentNav")?.classList.remove("hidden");
  document.getElementById("departmentMobileNav")?.classList.remove("hidden");
  if(!allowed.has(document.querySelector(".view.active")?.id||""))showView("department");
  applyHodViewOnly()
};

const _hodShowView=showView;
showView=function(id){
  if(currentUser?.role==="HOD"&&!new Set(["dashboard","department","reports"]).has(id))id="department";
  const out=_hodShowView(id);applyHodViewOnly();return out
};

const _hodOpenApp=openApp;
openApp=function(){
  _hodOpenApp();
  if(currentUser?.role==="HOD"){applyHodViewOnly();showView("department")}
};
