function text(v){return String(v??'').trim()}

export function branchIdentity(branch){
  if(!branch?.id) throw new Error('Branch identity is required.');
  const school=text(branch.schoolName||branch.school_name)||'Sri Chaitanya School';
  const name=text(branch.name||branch.branch_name)||'School Branch';
  const location=text(branch.location);
  const code=text(branch.code||branch.branch_code);
  const academicYear=text(branch.academicYear||branch.academic_year)||'2026-27';
  return {
    school,
    name,
    code,
    location,
    academicYear,
    shortTitle:code?`${name} · ${code}`:name,
    topTitle:[name,location].filter(Boolean).join(' · '),
    documentTitle:`${name} | Syllabus Tracker`
  };
}

export function branchLoginFields({branchCode='' }={}){
  return {branchCode:text(branchCode),username:'',password:''};
}

export function needsBranchCode(matches){return Number(matches||0)>1}
