import { stageBranchOnboarding, reviewStagedBranch } from './onboarding-workflow.mjs';

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function summaryCards(summary={}){return Object.entries(summary).map(([k,v])=>`<div class="mb-card"><b>${esc(k.replace(/([A-Z])/g,' $1'))}</b><strong>${esc(v)}</strong></div>`).join('')}

export function mountBranchOnboarding(root,{parseWorkbook,existingBranchCodes=()=>[],onReady=()=>{}}={}){
  if(!root)throw new Error('Onboarding root element is required.');
  if(typeof parseWorkbook!=='function')throw new Error('parseWorkbook(file) is required.');
  let state={phase:'idle',file:null,package:null,error:'',warnings:[]};

  function render(){
    const ready=state.package?.status==='ready';
    const invalid=state.package?.status==='invalid';
    root.innerHTML=`
      <section class="mb-onboard">
        <div class="mb-head"><div><h2>Branch Onboarding</h2><p>Development-only staging. No live data is written from this screen.</p></div><span class="mb-badge">${esc(state.phase)}</span></div>
        <div class="mb-stepbar"><span class="${state.phase!=='idle'?'done':''}">1 Upload</span><span class="${['review','ready'].includes(state.phase)?'done':''}">2 Validate</span><span class="${state.phase==='ready'?'done':''}">3 Review</span><span>4 Activate later</span></div>
        <label class="mb-drop"><input id="mbFile" type="file" accept=".xlsx,.xls"><b>${state.file?esc(state.file.name):'Choose branch onboarding Excel'}</b><small>Required sheets: Branch, Classes_Sections, Teachers, Teaching_Mappings, HODs, Subjects</small></label>
        <div class="mb-actions"><button id="mbValidate" ${state.phase==='loading'?'disabled':''}>Validate & Stage</button><button id="mbReset" class="secondary">Reset</button></div>
        ${state.error?`<div class="mb-error">${esc(state.error)}</div>`:''}
        ${invalid?`<div class="mb-error"><b>Cannot stage this branch.</b><ul>${state.package.validation.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
        ${ready?`<div class="mb-ok"><b>Validation passed. Branch is staged only.</b></div><div class="mb-grid">${summaryCards(state.package.summary)}</div><div class="mb-review"><b>${esc(state.package.staged.branch.branch_name)}</b><span>${esc(state.package.staged.branch.branch_code)}</span><span>${esc(state.package.staged.branch.location)}</span><span>${esc(state.package.staged.branch.academic_year)}</span></div><button id="mbReady">Mark Reviewed & Ready for Test Import</button>`:''}
        ${state.warnings.length?`<div class="mb-warn"><b>Warnings</b><ul>${state.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
      </section>`;
    const fileInput=root.querySelector('#mbFile'); if(fileInput)fileInput.onchange=e=>{state.file=e.target.files?.[0]||null;state.error='';render()};
    const reset=root.querySelector('#mbReset'); if(reset)reset.onclick=()=>{state={phase:'idle',file:null,package:null,error:'',warnings:[]};render()};
    const validate=root.querySelector('#mbValidate'); if(validate)validate.onclick=async()=>{
      if(!state.file){state.error='Choose an onboarding Excel workbook first.';render();return}
      state.phase='loading';state.error='';render();
      try{
        const workbook=await parseWorkbook(state.file);
        const staged=stageBranchOnboarding(workbook,{existingBranchCodes:existingBranchCodes()});
        state.package=staged;state.warnings=staged.validation?.warnings||[];state.phase=staged.status==='ready'?'review':'invalid';
      }catch(e){state.phase='idle';state.error=e?.message||String(e)}
      render();
    };
    const readyBtn=root.querySelector('#mbReady'); if(readyBtn)readyBtn.onclick=()=>{
      try{reviewStagedBranch(state.package);state.phase='ready';onReady(state.package);render()}catch(e){state.error=e?.message||String(e);render()}
    };
  }

  if(!document.getElementById('mbOnboardingStyles')){
    const s=document.createElement('style');s.id='mbOnboardingStyles';s.textContent=`
      .mb-onboard{font-family:Arial,sans-serif;background:#fff;border:1px solid #d8dee8;border-radius:16px;padding:20px;max-width:1100px;margin:auto}.mb-head{display:flex;justify-content:space-between;gap:16px;align-items:start}.mb-head h2{margin:0 0 4px}.mb-head p{margin:0;color:#64748b}.mb-badge{background:#eef2ff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700}.mb-stepbar{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.mb-stepbar span{padding:9px;border-radius:9px;background:#f1f5f9;text-align:center;font-size:12px}.mb-stepbar .done{background:#dcfce7}.mb-drop{display:grid;gap:6px;border:2px dashed #cbd5e1;border-radius:12px;padding:18px;cursor:pointer}.mb-drop input{display:block}.mb-drop small{color:#64748b}.mb-actions{display:flex;gap:10px;margin:14px 0}.mb-actions button,#mbReady{border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer;background:#1d4ed8;color:#fff}.mb-actions .secondary{background:#e2e8f0;color:#0f172a}.mb-error,.mb-warn,.mb-ok{margin:12px 0;padding:12px;border-radius:10px}.mb-error{background:#fee2e2;color:#991b1b}.mb-warn{background:#fef3c7}.mb-ok{background:#dcfce7;color:#166534}.mb-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0}.mb-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;display:grid;gap:5px}.mb-card b{font-size:11px;text-transform:capitalize;color:#64748b}.mb-card strong{font-size:20px}.mb-review{display:flex;gap:18px;flex-wrap:wrap;padding:12px;background:#f8fafc;border-radius:10px;margin-bottom:12px}@media(max-width:700px){.mb-stepbar,.mb-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s)
  }
  render();
  return {getState:()=>state,reset:()=>{state={phase:'idle',file:null,package:null,error:'',warnings:[]};render()}};
}
