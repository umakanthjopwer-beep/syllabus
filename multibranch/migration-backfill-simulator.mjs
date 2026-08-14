const BRANCH_TABLES=[
  'app_users','app_sessions','teachers','sections','subjects','teaching_mappings',
  'user_departments','user_sections','user_subjects','weekly_entry_requests','weekly_status',
  'year_plans','year_plan_assignments','year_plan_subjects','year_plan_weeks','safe_yearplan_recapture_state'
];

const clone=v=>JSON.parse(JSON.stringify(v));
const id=v=>String(v??'');

export function counts(snapshot){
  return Object.fromEntries(BRANCH_TABLES.map(t=>[t,(snapshot[t]||[]).length]));
}

export function backfillKhalsa(input,branch={id:'branch-khalsa',branch_code:'KHALSA-CBSE'}){
  const s=clone(input);
  s.branches=[...(s.branches||[]).filter(b=>id(b.id)!==id(branch.id)),clone(branch)];

  for(const t of ['teachers','sections','subjects','app_users','year_plans']){
    s[t]=(s[t]||[]).map(r=>({...r,branch_id:r.branch_id||branch.id}));
  }
  const userById=new Map((s.app_users||[]).map(r=>[id(r.id),r]));
  const sectionById=new Map((s.sections||[]).map(r=>[id(r.id),r]));
  const subjectById=new Map((s.subjects||[]).map(r=>[id(r.id),r]));
  const planById=new Map((s.year_plans||[]).map(r=>[id(r.id),r]));

  s.app_sessions=(s.app_sessions||[]).map(r=>({...r,branch_id:r.branch_id||userById.get(id(r.user_id))?.branch_id}));
  s.teaching_mappings=(s.teaching_mappings||[]).map(r=>({...r,branch_id:r.branch_id||sectionById.get(id(r.section_id))?.branch_id}));
  for(const t of ['user_departments','user_sections','user_subjects','weekly_entry_requests']){
    s[t]=(s[t]||[]).map(r=>({...r,branch_id:r.branch_id||userById.get(id(r.user_id))?.branch_id}));
  }
  for(const t of ['year_plan_assignments','year_plan_subjects','year_plan_weeks']){
    s[t]=(s[t]||[]).map(r=>({...r,branch_id:r.branch_id||planById.get(id(r.year_plan_id))?.branch_id}));
  }
  s.weekly_status=(s.weekly_status||[]).map(r=>({...r,branch_id:r.branch_id||sectionById.get(id(r.section_id))?.branch_id}));
  s.safe_yearplan_recapture_state=(s.safe_yearplan_recapture_state||[]).map(r=>({...r,branch_id:r.branch_id||planById.get(id(r.plan_id))?.branch_id}));

  s.branch_settings=[...(s.branch_settings||[])];
  const weekly=(s.app_settings||[]).find(r=>r.key==='weekly_entry');
  if(weekly){
    s.branch_settings=s.branch_settings.filter(r=>!(id(r.branch_id)===id(branch.id)&&r.key==='weekly_entry'));
    s.branch_settings.push({branch_id:branch.id,key:'weekly_entry',value:clone(weekly.value),updated_by:weekly.updated_by||null});
  }
  return s;
}

export function validateBranchOwnership(s){
  const errors=[];
  for(const t of BRANCH_TABLES){for(const r of s[t]||[])if(!r.branch_id)errors.push(`${t}: null branch_id`)}
  const by=(t)=>new Map((s[t]||[]).map(r=>[id(r.id),r]));
  const users=by('app_users'),teachers=by('teachers'),sections=by('sections'),subjects=by('subjects'),plans=by('year_plans');
  const same=(table,row,parent,label)=>{if(parent&&id(row.branch_id)!==id(parent.branch_id))errors.push(`${table}: ${label} cross-branch`)};

  for(const r of s.app_sessions||[])same('app_sessions',r,users.get(id(r.user_id)),'user');
  for(const r of s.app_users||[])if(r.teacher_id)same('app_users',r,teachers.get(id(r.teacher_id)),'teacher');
  for(const r of s.teaching_mappings||[]){same('teaching_mappings',r,sections.get(id(r.section_id)),'section');same('teaching_mappings',r,subjects.get(id(r.subject_id)),'subject');if(r.teacher_id)same('teaching_mappings',r,teachers.get(id(r.teacher_id)),'teacher')}
  for(const r of s.user_departments||[])same('user_departments',r,users.get(id(r.user_id)),'user');
  for(const r of s.user_sections||[]){same('user_sections',r,users.get(id(r.user_id)),'user');same('user_sections',r,sections.get(id(r.section_id)),'section')}
  for(const r of s.user_subjects||[]){same('user_subjects',r,users.get(id(r.user_id)),'user');same('user_subjects',r,subjects.get(id(r.subject_id)),'subject')}
  for(const r of s.weekly_entry_requests||[]){same('weekly_entry_requests',r,users.get(id(r.user_id)),'user');if(r.responded_by)same('weekly_entry_requests',r,users.get(id(r.responded_by)),'responder')}
  for(const r of s.year_plans||[]){same('year_plans',r,subjects.get(id(r.subject_id)),'subject');if(r.uploaded_by)same('year_plans',r,users.get(id(r.uploaded_by)),'uploader')}
  for(const r of s.year_plan_assignments||[]){same('year_plan_assignments',r,plans.get(id(r.year_plan_id)),'plan');same('year_plan_assignments',r,sections.get(id(r.section_id)),'section')}
  for(const r of s.year_plan_subjects||[]){same('year_plan_subjects',r,plans.get(id(r.year_plan_id)),'plan');same('year_plan_subjects',r,subjects.get(id(r.subject_id)),'subject')}
  for(const r of s.year_plan_weeks||[]){same('year_plan_weeks',r,plans.get(id(r.year_plan_id)),'plan');if(r.subject_id)same('year_plan_weeks',r,subjects.get(id(r.subject_id)),'subject')}
  for(const r of s.weekly_status||[]){same('weekly_status',r,sections.get(id(r.section_id)),'section');same('weekly_status',r,subjects.get(id(r.subject_id)),'subject');if(r.teacher_id)same('weekly_status',r,teachers.get(id(r.teacher_id)),'teacher');if(r.year_plan_id)same('weekly_status',r,plans.get(id(r.year_plan_id)),'plan');if(r.submitted_by)same('weekly_status',r,users.get(id(r.submitted_by)),'submitter');if(r.reentry_requested_by)same('weekly_status',r,users.get(id(r.reentry_requested_by)),'reentry user')}
  for(const r of s.safe_yearplan_recapture_state||[])same('safe_yearplan_recapture_state',r,plans.get(id(r.plan_id)),'plan');
  return errors;
}

export function perBranchUnique(snapshot,table,field){
  const seen=new Set(),errors=[];
  for(const r of snapshot[table]||[]){const k=`${id(r.branch_id)}::${String(r[field]??'').trim().toLowerCase()}`;if(seen.has(k))errors.push(k);seen.add(k)}
  return errors;
}

export {BRANCH_TABLES};
