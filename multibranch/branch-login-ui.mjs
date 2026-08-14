import {branchIdentity} from './branch-ui-identity.mjs';

export function ensureBranchCodeField(doc=document){
  if(doc.getElementById('loginBranchCode')) return doc.getElementById('loginBranchCode');
  const username=doc.getElementById('loginUsername');
  const usernameLabel=username?.closest('label');
  if(!usernameLabel) throw new Error('Login username field was not found.');
  const label=doc.createElement('label');
  label.id='loginBranchCodeLabel';
  label.textContent='Branch Code';
  const input=doc.createElement('input');
  input.id='loginBranchCode';
  input.autocomplete='organization';
  input.placeholder='Example: KHALSA-CBSE';
  label.appendChild(input);
  usernameLabel.parentNode.insertBefore(label,usernameLabel);
  return input;
}

export function readBranchLogin(doc=document){
  return {
    branchCode:String(doc.getElementById('loginBranchCode')?.value||'').trim(),
    username:String(doc.getElementById('loginUsername')?.value||'').trim(),
    password:String(doc.getElementById('loginPassword')?.value||'')
  };
}

export function applyBranchIdentity(branch,doc=document){
  const x=branchIdentity(branch);
  doc.title=x.documentTitle;
  const loginBrand=doc.querySelector('#loginScreen .login-brand h1');
  if(loginBrand) loginBrand.textContent=x.name;
  const sideName=doc.querySelector('.side-brand strong');
  if(sideName) sideName.textContent=x.shortTitle;
  const topSchool=doc.querySelector('.school-title .eyebrow');
  if(topSchool) topSchool.textContent=x.school.toUpperCase();
  const topBranch=doc.querySelector('.school-title strong');
  if(topBranch) topBranch.textContent=x.topTitle;
  const workspace=doc.querySelector('.workspace-box small');
  if(workspace) workspace.textContent=`Saved centrally · ${x.academicYear}`;
  const yearLabel=doc.querySelector('#dashboard .page-head .eyebrow');
  if(yearLabel) yearLabel.textContent=`ACADEMIC YEAR ${x.academicYear}`;
  return x;
}

export function clearBranchCode(doc=document){
  const input=doc.getElementById('loginBranchCode');
  if(input) input.value='';
}
