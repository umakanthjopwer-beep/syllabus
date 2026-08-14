// DEVELOPMENT ONLY: not referenced by the live app loader.
// Provides branch-context helpers for the future multi-branch version.
(function(){
  const KEY='khalsa-syllabus-branch-context-v1';

  function normalizeBranch(branch){
    if(!branch||!branch.id)return null;
    return {
      id:String(branch.id),
      code:String(branch.branch_code||branch.code||''),
      name:String(branch.branch_name||branch.name||''),
      schoolName:String(branch.school_name||branch.schoolName||'Sri Chaitanya School'),
      location:String(branch.location||''),
      academicYear:String(branch.academic_year||branch.academicYear||'2026-27')
    }
  }

  function getBranch(){
    try{return normalizeBranch(JSON.parse(sessionStorage.getItem(KEY)||'null'))}catch(e){return null}
  }
  function setBranch(branch){
    const b=normalizeBranch(branch);
    if(!b){sessionStorage.removeItem(KEY);return null}
    sessionStorage.setItem(KEY,JSON.stringify(b));return b
  }
  function clearBranch(){sessionStorage.removeItem(KEY)}
  function requireBranch(){
    const b=getBranch();
    if(!b)throw new Error('Branch context is required before loading school data.');
    return b
  }
  function scoped(rows){
    const b=requireBranch();
    return (rows||[]).filter(r=>String(r.branch_id||'')===b.id)
  }
  function payload(values){
    const b=requireBranch();
    return {...values,branch_id:b.id}
  }
  function assertSameBranch(record){
    const b=requireBranch();
    if(!record||String(record.branch_id||'')!==b.id)throw new Error('Cross-branch access blocked.');
    return record
  }

  window.MultiBranchCore={getBranch,setBranch,clearBranch,requireBranch,scoped,payload,assertSameBranch};
})();