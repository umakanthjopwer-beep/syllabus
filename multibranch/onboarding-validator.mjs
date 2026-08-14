const REQUIRED_BRANCH=['Branch Code','Branch Name','School Name','Location','Academic Year','Dean / Branch Super Admin Name','Dean Mobile Number / Login Username'];
const REQUIRED_SECTION=['Class Display Name','Internal Batch Code','Grade','Orientation / Programme','Active'];
const REQUIRED_TEACHER=['Teacher Full Name','Designation','Department','Primary Subject','Mobile Number / Login Username','Active'];
const REQUIRED_MAPPING=['Class Display Name','Internal Batch Code','Subject','Department','Teacher Full Name','Periods Per Week','Week Pattern','Class Teacher','Co-Class Teacher','Active for Syllabus Tracking'];
const REQUIRED_HOD=['HOD Name','Department','Mobile Number / Login Username'];
const REQUIRED_SUBJECT=['Subject Name','Department','Active for Syllabus Tracking'];

function text(v){return String(v??'').trim()}
function yesNo(v){const s=text(v).toLowerCase();return ['yes','y','true','1','active'].includes(s)?true:['no','n','false','0','inactive'].includes(s)?false:null}
function key(v){return text(v).toLowerCase()}
function rowLabel(sheet,index){return `${sheet} row ${index+2}`}
function requireFields(row,fields,sheet,index,errors){for(const f of fields)if(!text(row?.[f]))errors.push(`${rowLabel(sheet,index)}: ${f} is required.`)}
function duplicates(values){const seen=new Set(),dups=new Set();for(const v of values){const k=key(v);if(!k)continue;if(seen.has(k))dups.add(k);seen.add(k)}return dups}

export function validateOnboarding(workbook,{branchId='pending-branch'}={}){
  const errors=[],warnings=[];
  const branchRows=workbook?.Branch||[];
  const sections=workbook?.Classes_Sections||[];
  const teachers=workbook?.Teachers||[];
  const mappings=workbook?.Teaching_Mappings||[];
  const hods=workbook?.HODs||[];
  const subjects=workbook?.Subjects||[];

  if(branchRows.length!==1)errors.push('Branch sheet must contain exactly one data row.');
  branchRows.forEach((r,i)=>requireFields(r,REQUIRED_BRANCH,'Branch',i,errors));
  sections.forEach((r,i)=>requireFields(r,REQUIRED_SECTION,'Classes_Sections',i,errors));
  teachers.forEach((r,i)=>requireFields(r,REQUIRED_TEACHER,'Teachers',i,errors));
  mappings.forEach((r,i)=>requireFields(r,REQUIRED_MAPPING,'Teaching_Mappings',i,errors));
  hods.forEach((r,i)=>requireFields(r,REQUIRED_HOD,'HODs',i,errors));
  subjects.forEach((r,i)=>requireFields(r,REQUIRED_SUBJECT,'Subjects',i,errors));

  for(const dup of duplicates(sections.map(r=>r['Internal Batch Code'])))errors.push(`Duplicate Internal Batch Code in this branch: ${dup}.`);
  for(const dup of duplicates(sections.map(r=>r['Class Display Name'])))errors.push(`Duplicate Class Display Name in this branch: ${dup}.`);
  for(const dup of duplicates(subjects.map(r=>`${r['Department']}::${r['Subject Name']}`)))errors.push(`Duplicate subject in the same department: ${dup}.`);
  for(const dup of duplicates(teachers.map(r=>r['Mobile Number / Login Username'])))errors.push(`Duplicate teacher login username in this branch: ${dup}.`);
  for(const dup of duplicates(hods.map(r=>r['Mobile Number / Login Username'])))warnings.push(`HOD login username is repeated in HOD sheet: ${dup}.`);

  const sectionByBatch=new Map(sections.map(r=>[key(r['Internal Batch Code']),r]));
  const subjectKeys=new Set(subjects.map(r=>key(`${r['Department']}::${r['Subject Name']}`)));
  const teachersByName=new Map();
  teachers.forEach(r=>{const k=key(r['Teacher Full Name']);if(!teachersByName.has(k))teachersByName.set(k,[]);teachersByName.get(k).push(r)});

  teachersByName.forEach((rows,name)=>{if(rows.length>1){const ids=rows.map(r=>text(r['Employee ID / Code (if available)'])).filter(Boolean);if(ids.length!==rows.length||new Set(ids.map(key)).size!==rows.length)errors.push(`Duplicate teacher name '${name}' requires a unique Employee ID / Code for every matching teacher.`)}});

  mappings.forEach((r,i)=>{
    const where=rowLabel('Teaching_Mappings',i);
    const batch=key(r['Internal Batch Code']);
    const section=sectionByBatch.get(batch);
    if(!section)errors.push(`${where}: Internal Batch Code '${text(r['Internal Batch Code'])}' does not exist in Classes_Sections.`);
    else if(key(section['Class Display Name'])!==key(r['Class Display Name']))errors.push(`${where}: Class Display Name does not match Internal Batch Code '${text(r['Internal Batch Code'])}'.`);
    const skey=key(`${r['Department']}::${r['Subject']}`);
    if(!subjectKeys.has(skey))errors.push(`${where}: Subject '${text(r['Subject'])}' is not defined under department '${text(r['Department'])}'.`);
    const matches=teachersByName.get(key(r['Teacher Full Name']))||[];
    if(matches.length===0)errors.push(`${where}: Teacher '${text(r['Teacher Full Name'])}' does not exist in Teachers.`);
    if(matches.length>1)errors.push(`${where}: Teacher '${text(r['Teacher Full Name'])}' is ambiguous; mapping must use a unique teacher identifier before import.`);
    const periods=Number(r['Periods Per Week']);if(!Number.isFinite(periods)||periods<0)errors.push(`${where}: Periods Per Week must be a non-negative number.`);
  });

  const normalized={
    branch:branchRows[0]?{branch_id:branchId,branch_code:text(branchRows[0]['Branch Code']),branch_name:text(branchRows[0]['Branch Name']),school_name:text(branchRows[0]['School Name']),location:text(branchRows[0]['Location']),academic_year:text(branchRows[0]['Academic Year'])}:null,
    sections:sections.map(r=>({branch_id:branchId,section:text(r['Class Display Name']),internal_batch:text(r['Internal Batch Code']),grade:text(r['Grade']),orientation:text(r['Orientation / Programme']),floor:text(r['Floor (optional)']),active:yesNo(r['Active'])})),
    teachers:teachers.map(r=>({branch_id:branchId,name:text(r['Teacher Full Name']),employee_code:text(r['Employee ID / Code (if available)']),designation:text(r['Designation']),department:text(r['Department']),primary_subject:text(r['Primary Subject']),username:text(r['Mobile Number / Login Username']),email:text(r['Email (optional)']),active:yesNo(r['Active'])})),
    subjects:subjects.map(r=>({branch_id:branchId,name:text(r['Subject Name']),department:text(r['Department']),active_for_syllabus:yesNo(r['Active for Syllabus Tracking'])}))
  };
  return {ok:errors.length===0,errors,warnings,normalized};
}
