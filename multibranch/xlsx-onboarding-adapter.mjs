const EXPECTED_SHEETS=['Branch','Classes_Sections','Teachers','Teaching_Mappings','HODs','Subjects'];

export function workbookObjectFromXlsx(XLSX,arrayBuffer){
  if(!XLSX?.read||!XLSX?.utils?.sheet_to_json)throw new Error('XLSX parser is unavailable.');
  const wb=XLSX.read(arrayBuffer,{type:'array',cellDates:true});
  const missing=EXPECTED_SHEETS.filter(name=>!wb.Sheets?.[name]);
  if(missing.length)throw new Error(`Missing required sheet(s): ${missing.join(', ')}.`);
  const out={};
  for(const name of EXPECTED_SHEETS){
    out[name]=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:false});
  }
  return out;
}

export async function parseOnboardingFile(file,{XLSX=globalThis.XLSX}={}){
  if(!file)throw new Error('Choose an onboarding Excel workbook.');
  const name=String(file.name||'').toLowerCase();
  if(!name.endsWith('.xlsx')&&!name.endsWith('.xls'))throw new Error('Onboarding file must be an Excel workbook (.xlsx or .xls).');
  const buffer=await file.arrayBuffer();
  return workbookObjectFromXlsx(XLSX,buffer);
}

export { EXPECTED_SHEETS };
