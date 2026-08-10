const WEEKLY_ACCESS_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/weekly-entry-access";
let WEEKLY_ACCESS={globalOpen:false,canEdit:false,isController:false,requestStatus:"none",requestId:null,pendingRequests:[]};

async function weeklyAccessCall(action,payload={}){
  const token=typeof remoteToken==="function"?remoteToken():"";
  if(!token)throw new Error("Please sign in again.");
  const r=await fetch(WEEKLY_ACCESS_API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload})});
  let out={};try{out=await r.json()}catch(e){}
  if(!r.ok)throw new Error(out.error||`Access request failed (${r.status})`);
  return out;
}
function weeklyController(){return currentUser&&["Super Admin","Admin"].includes(currentUser.role)}
function ensureWeeklyAccessStyles(){
  if(document.getElementById("weeklyAccessStyles"))return;
  const st=document.createElement("style");st.id="weeklyAccessStyles";st.textContent=`
  .weekly-access-panel{border:1px solid #d9e2ef;background:#fff}.weekly-access-head{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}.weekly-access-state{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;font-size:11px;font-weight:800}.weekly-access-state.open{background:#e8f6ed;color:#207344}.weekly-access-state.locked{background:#fff1e7;color:#9a5a19}.weekly-access-state.personal{background:#eaf2ff;color:#315f9a}.weekly-access-actions{display:flex;gap:8px;flex-wrap:wrap}.weekly-access-note{margin:9px 0 0;color:#68788f;font-size:12px}.weekly-request-list{display:grid;gap:8px;margin-top:14px}.weekly-request-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px}.weekly-request-row small{display:block;color:#7c899c;margin-top:2px}.weekly-request-buttons{display:flex;gap:6px;flex-shrink:0}.weekly-request-empty{margin-top:12px;color:#7c899c;font-size:12px}.weekly-entry-locked{opacity:.68}.weekly-entry-locked input,.weekly-entry-locked textarea{background:#f6f8fb!important}
  @media(max-width:760px){.weekly-access-head,.weekly-request-row{align-items:flex-start;flex-direction:column}.weekly-access-actions,.weekly-request-buttons{width:100%}.weekly-access-actions button,.weekly-request-buttons button{flex:1}}
  `;document.head.appendChild(st)
}
function ensureWeeklyAccessPanel(){
  ensureWeeklyAccessStyles();
  const weekly=document.getElementById("weekly"),head=weekly?.querySelector(".page-head");if(!weekly||!head||document.getElementById("weeklyEntryAccessPanel"))return;
  const box=document.createElement("div");box.id="weeklyEntryAccessPanel";box.className="panel weekly-access-panel";head.insertAdjacentElement("afterend",box)
}
function setWeeklyEntryFieldsEnabled(enabled){
  const ids=["wkTakenPeriods","wkActual","wkLagPeriods","wkReason"];
  for(const id of ids){const el=document.getElementById(id);if(el)el.disabled=!enabled}
  const save=document.getElementById("saveWeeklyBtn");if(save)save.disabled=!enabled;
  const form=document.querySelector("#weekly .panel .form-grid");if(form)form.classList.toggle("weekly-entry-locked",!enabled)
}
function requestLabel(){
  if(WEEKLY_ACCESS.requestStatus==="pending")return"Access requested";
  if(WEEKLY_ACCESS.requestStatus==="approved")return"Temporary access approved";
  return"Request Entry Access"
}
function renderWeeklyAccessControl(){
  ensureWeeklyAccessPanel();const box=document.getElementById("weeklyEntryAccessPanel");if(!box)return;
  const control=weeklyController()||WEEKLY_ACCESS.isController;
  const personal=!WEEKLY_ACCESS.globalOpen&&WEEKLY_ACCESS.requestStatus==="approved"&&!control;
  const open=!!WEEKLY_ACCESS.globalOpen;
  const canEdit=control||!!WEEKLY_ACCESS.canEdit;
  let stateClass=open?"open":personal?"personal":"locked",stateText=open?"ENTRY OPEN FOR ALL":personal?"TEMPORARY ENTRY ACCESS":"ENTRY LOCKED · VIEW ONLY";
  const adminActions=control?`<div class="weekly-access-actions"><button id="weeklyGlobalToggle" class="${open?"outline-btn":"primary"}">${open?"Close Weekly Entry":"Open Weekly Entry for All"}</button></div>`:"";
  let userActions="";
  if(!control&&!open){const disabled=WEEKLY_ACCESS.requestStatus==="pending"||WEEKLY_ACCESS.requestStatus==="approved";userActions=`<div class="weekly-access-actions"><button id="weeklyRequestAccess" class="outline-btn" ${disabled?"disabled":""}>${esc(requestLabel())}</button></div>`}
  const pending=control?(WEEKLY_ACCESS.pendingRequests||[]):[];
  const requests=control?`<div class="weekly-request-list">${pending.length?pending.map(r=>`<div class="weekly-request-row"><div><strong>${esc(r.user?.name||r.user?.username||"Staff user")}</strong><small>${esc(r.user?.role||"")} · requested ${new Date(r.requested_at).toLocaleString("en-IN")}</small></div><div class="weekly-request-buttons"><button class="mini-btn" data-weekly-reject="${esc(r.id)}">Reject</button><button class="primary" data-weekly-approve="${esc(r.id)}">Approve</button></div></div>`).join(""):`<div class="weekly-request-empty">No pending weekly-entry requests.</div>`}</div>`:"";
  box.innerHTML=`<div class="weekly-access-head"><div><div class="eyebrow">ENTRY CONTROL</div><h3 style="margin:4px 0 0">Weekly syllabus update access</h3></div><span class="weekly-access-state ${stateClass}">${stateText}</span>${adminActions||userActions}</div><p class="weekly-access-note">Weekly status records and reports stay viewable at all times. Only editing and saving are controlled.</p>${requests}`;
  setWeeklyEntryFieldsEnabled(canEdit);
  const toggle=document.getElementById("weeklyGlobalToggle");if(toggle)toggle.onclick=()=>setWeeklyEntryOpen(!open);
  const req=document.getElementById("weeklyRequestAccess");if(req)req.onclick=requestWeeklyEntryAccess;
  box.querySelectorAll("[data-weekly-approve]").forEach(b=>b.onclick=()=>respondWeeklyEntryRequest(b.dataset.weeklyApprove,"approve"));
  box.querySelectorAll("[data-weekly-reject]").forEach(b=>b.onclick=()=>respondWeeklyEntryRequest(b.dataset.weeklyReject,"reject"));
}
async function refreshWeeklyAccess(showError=false){
  if(!currentUser||!remoteToken())return WEEKLY_ACCESS;
  try{WEEKLY_ACCESS=await weeklyAccessCall("status");renderWeeklyAccessControl();return WEEKLY_ACCESS}catch(e){if(showError)setStatus("#weeklyStatus",e.message,true);return WEEKLY_ACCESS}
}
async function setWeeklyEntryOpen(open){
  const btn=document.getElementById("weeklyGlobalToggle");if(btn)setBusy(btn,true,open?"Opening…":"Closing…");
  try{WEEKLY_ACCESS=await weeklyAccessCall("set_global",{open});renderWeeklyAccessControl();setStatus("#weeklyStatus",open?"Weekly syllabus entry is now open for staff.":"Weekly syllabus entry is now closed. Viewing remains available.")}catch(e){setStatus("#weeklyStatus",e.message,true)}finally{if(btn)setBusy(btn,false)}
}
async function requestWeeklyEntryAccess(){
  const btn=document.getElementById("weeklyRequestAccess");if(btn)setBusy(btn,true,"Requesting…");
  try{WEEKLY_ACCESS=await weeklyAccessCall("request");renderWeeklyAccessControl();setStatus("#weeklyStatus",WEEKLY_ACCESS.requestStatus==="approved"?"Entry access is approved.":"Access request sent to Super Admin / Admin.")}catch(e){setStatus("#weeklyStatus",e.message,true)}finally{if(btn)setBusy(btn,false)}
}
async function respondWeeklyEntryRequest(requestId,decision){
  try{WEEKLY_ACCESS=await weeklyAccessCall("respond",{request_id:requestId,decision});renderWeeklyAccessControl();setStatus("#weeklyStatus",decision==="approve"?"Weekly entry access approved for this staff member.":"Weekly entry request rejected.")}catch(e){setStatus("#weeklyStatus",e.message,true)}
}

const _weeklyControlledSave=saveWeekly;
saveWeekly=async function(){
  try{const access=await weeklyAccessCall("check");WEEKLY_ACCESS=access;renderWeeklyAccessControl();if(!access.canEdit){setStatus("#weeklyStatus","Weekly syllabus entry is locked. You can view records, but editing requires Admin approval.",true);return}}catch(e){setStatus("#weeklyStatus",e.message,true);return}
  return _weeklyControlledSave()
};
const _weeklyAccessReload=reloadRemote;
reloadRemote=async function(){const r=await _weeklyAccessReload();await refreshWeeklyAccess(false);return r};
const _weeklyAccessShowView=showView;
showView=function(view){const r=_weeklyAccessShowView(view);if(view==="weekly")refreshWeeklyAccess(false);return r};
const _weeklyAccessInit=init;
init=function(){_weeklyAccessInit();ensureWeeklyAccessPanel();renderWeeklyAccessControl();setInterval(()=>{if(currentUser&&document.getElementById("weekly")?.classList.contains("active"))refreshWeeklyAccess(false)},60000)};
