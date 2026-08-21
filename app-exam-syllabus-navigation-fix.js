// Ensures the separate Exam Syllabus module remains reachable after core role/navigation guards bind.
(function(){
  const EXAM_VIEW="examSyllabus";
  const EXAM_ROLES=new Set(["Super Admin","Principal","Admin","HOD","Teacher"]);
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];

  function openExam(){
    const view=q("#examSyllabus");
    if(!view)return;
    qa(".view").forEach(v=>v.classList.toggle("active",v===view));
    qa(".nav-btn,.mobile-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===EXAM_VIEW));
    window.scrollTo({top:0,behavior:"smooth"});
    const refresh=q("#examRefreshBtn");
    if(refresh&&typeof refresh.onclick==="function")refresh.onclick(new Event("click"));
    else refresh?.click();
  }

  function rebind(){
    const allowed=!!currentUser&&EXAM_ROLES.has(currentUser.role);
    qa(`[data-view="${EXAM_VIEW}"]`).forEach(b=>{
      b.classList.toggle("hidden",!allowed);
      b.onclick=e=>{e?.preventDefault?.();openExam()};
    });
    const quick=q("#dashExamSyllabusBtn");
    if(quick)quick.onclick=e=>{e?.preventDefault?.();openExam()};
  }

  const oldApply=typeof applyRoleAccess==="function"?applyRoleAccess:null;
  if(oldApply)applyRoleAccess=function(){const r=oldApply.apply(this,arguments);setTimeout(rebind,0);return r};

  const oldOpen=typeof openApp==="function"?openApp:null;
  if(oldOpen)openApp=function(){const r=oldOpen.apply(this,arguments);setTimeout(rebind,0);return r};

  const oldInit=typeof init==="function"?init:null;
  if(oldInit)init=function(){const r=oldInit.apply(this,arguments);setTimeout(rebind,0);return r};

  window.openExamSyllabusModule=openExam;
  setTimeout(rebind,100);
})();
