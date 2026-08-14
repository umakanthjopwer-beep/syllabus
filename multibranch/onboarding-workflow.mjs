import { validateOnboarding } from './onboarding-validator.mjs';

function slug(value){
  return String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function requiredBranchCode(workbook){
  const row=workbook?.Branch?.[0];
  const code=String(row?.['Branch Code']??'').trim();
  if(!code) throw new Error('Branch Code is required before staging onboarding.');
  return code;
}
function makeId(branchCode,type,index,label=''){
  const suffix=slug(label)||String(index+1);
  return `${slug(branchCode)}-${type}-${suffix}`;
}

export function stageBranchOnboarding(workbook,{existingBranchCodes=[]}={}){
  const branchCode=requiredBranchCode(workbook);
  if(existingBranchCodes.map(x=>String(x).trim().toLowerCase()).includes(branchCode.toLowerCase())){
    throw new Error(`Branch Code '${branchCode}' already exists.`);
  }
  const branchId=`branch-${slug(branchCode)}`;
  const validation=validateOnboarding(workbook,{branchId});
  if(!validation.ok){
    return {status:'invalid',branchId,branchCode,validation,staged:null};
  }

  const sectionByBatch=new Map();
  const sections=validation.normalized.sections.map((row,i)=>{
    const id=makeId(branchCode,'section',i,row.internal_batch);
    const out={id,...row};
    sectionByBatch.set(row.internal_batch.toLowerCase(),out);
    return out;
  });

  const subjectByDeptName=new Map();
  const subjects=validation.normalized.subjects.map((row,i)=>{
    const id=makeId(branchCode,'subject',i,`${row.department}-${row.name}`);
    const out={id,...row};
    subjectByDeptName.set(`${row.department}::${row.name}`.toLowerCase(),out);
    return out;
  });

  const teacherByName=new Map();
  const teachers=validation.normalized.teachers.map((row,i)=>{
    const id=makeId(branchCode,'teacher',i,row.employee_code||row.username||row.name);
    const out={id,...row};
    const key=row.name.toLowerCase();
    if(!teacherByName.has(key))teacherByName.set(key,[]);
    teacherByName.get(key).push(out);
    return out;
  });

  const mappings=(workbook.Teaching_Mappings||[]).map((row,i)=>{
    const batch=String(row['Internal Batch Code']??'').trim();
    const dept=String(row['Department']??'').trim();
    const subjectName=String(row['Subject']??'').trim();
    const teacherName=String(row['Teacher Full Name']??'').trim();
    const section=sectionByBatch.get(batch.toLowerCase());
    const subject=subjectByDeptName.get(`${dept}::${subjectName}`.toLowerCase());
    const teacherMatches=teacherByName.get(teacherName.toLowerCase())||[];
    if(!section||!subject||teacherMatches.length!==1) throw new Error(`Validated mapping could not be resolved at row ${i+2}.`);
    return {
      id:makeId(branchCode,'mapping',i,`${batch}-${subjectName}-${teacherMatches[0].id}`),
      branch_id:branchId,
      section_id:section.id,
      subject_id:subject.id,
      teacher_id:teacherMatches[0].id,
      periods_per_week:Number(row['Periods Per Week']),
      week_pattern:String(row['Week Pattern']??'').trim(),
      class_teacher:/^(yes|y|true|1)$/i.test(String(row['Class Teacher']??'').trim()),
      co_class_teacher:/^(yes|y|true|1)$/i.test(String(row['Co-Class Teacher']??'').trim()),
      active_for_syllabus:/^(yes|y|true|1|active)$/i.test(String(row['Active for Syllabus Tracking']??'').trim())
    };
  });

  const hods=(workbook.HODs||[]).map((row,i)=>({
    id:makeId(branchCode,'hod',i,row['Mobile Number / Login Username']||row['HOD Name']),
    branch_id:branchId,
    name:String(row['HOD Name']??'').trim(),
    department:String(row['Department']??'').trim(),
    username:String(row['Mobile Number / Login Username']??'').trim(),
    employee_code:String(row['Employee ID / Code (if available)']??'').trim(),
    role:'HOD'
  }));

  const branch={id:branchId,...validation.normalized.branch};
  const deanRow=workbook.Branch[0];
  const dean={
    id:makeId(branchCode,'user',0,deanRow['Dean Mobile Number / Login Username']),
    branch_id:branchId,
    name:String(deanRow['Dean / Branch Super Admin Name']??'').trim(),
    username:String(deanRow['Dean Mobile Number / Login Username']??'').trim(),
    role:'Branch Super Admin',
    access_enabled:true
  };

  const staged={branch,users:[dean,...hods],teachers,sections,subjects,mappings};
  return {
    status:'ready',branchId,branchCode,validation,staged,
    summary:{users:staged.users.length,teachers:teachers.length,sections:sections.length,subjects:subjects.length,mappings:mappings.length}
  };
}

export function reviewStagedBranch(stagedPackage){
  if(stagedPackage?.status!=='ready'||!stagedPackage.staged)throw new Error('A validated staged package is required.');
  const {branch,users,teachers,sections,subjects,mappings}=stagedPackage.staged;
  const branchId=branch.id;
  const all=[branch,...users,...teachers,...sections,...subjects,...mappings];
  const bad=all.filter(x=>x.branch_id!=null&&x.branch_id!==branchId);
  if(bad.length)throw new Error('Staged package contains cross-branch rows.');
  const sectionIds=new Set(sections.map(x=>x.id)),subjectIds=new Set(subjects.map(x=>x.id)),teacherIds=new Set(teachers.map(x=>x.id));
  for(const m of mappings){
    if(!sectionIds.has(m.section_id)||!subjectIds.has(m.subject_id)||!teacherIds.has(m.teacher_id))throw new Error(`Mapping '${m.id}' has an invalid relationship.`);
  }
  return {ok:true,branchId,counts:{users:users.length,teachers:teachers.length,sections:sections.length,subjects:subjects.length,mappings:mappings.length}};
}

export function activateStagedBranch(stagedPackage,repository){
  reviewStagedBranch(stagedPackage);
  const branchId=stagedPackage.branchId;
  if((repository.branches||[]).some(x=>String(x.id)===branchId||String(x.branch_code).toLowerCase()===stagedPackage.branchCode.toLowerCase())){
    throw new Error('Branch already exists in repository.');
  }
  const next={
    branches:[...(repository.branches||[]),stagedPackage.staged.branch],
    users:[...(repository.users||[]),...stagedPackage.staged.users],
    teachers:[...(repository.teachers||[]),...stagedPackage.staged.teachers],
    sections:[...(repository.sections||[]),...stagedPackage.staged.sections],
    subjects:[...(repository.subjects||[]),...stagedPackage.staged.subjects],
    mappings:[...(repository.mappings||[]),...stagedPackage.staged.mappings],
    yearPlans:[...(repository.yearPlans||[])],
    weeklyStatus:[...(repository.weeklyStatus||[])]
  };
  return next;
}
