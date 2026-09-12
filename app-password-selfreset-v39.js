// Secure self-service password reset v39.
// Staff request a reset, Admin approves identity, then staff choose their own new password.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/password-reset-api";
  const STORE="khalsa_self_password_reset_v39";
  const q=s=>document.querySelector(s);
  let adminRequests=[];
  let adminBusy=false;

  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
  function fmt(v){if(!v)return"";try{return new Date(v).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch(_){return String(v)}}
  function tokenNow(){try{return typeof remoteToken==="function"?remoteToken():localStorage.getItem(typeof REMOTE_TOKEN_KEY!=="undefined"?REMOTE_TOKEN_KEY:"khalsa_syllabus_api_token")||""}catch(_){return""}}
  function readState(){try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch(_){return null}}
  function writeState(v){try{v?localStorage.setItem(STORE,JSON.stringify(v)):localStorage.removeItem(STORE)}catch(_){}}
  function setText(id,text,bad=false){const el=q(id);if(!el)return;el.textContent=text||"";el.style.color=bad?"#b33a3a":"#2d6d4b"}
  async function call(action,payload={},auth=false){
    const headers={"Content-Type":"application/json"};
    if(auth){const t=tokenNow();if(!t)throw new Error("Please sign in again.");headers.Authorization=`Bearer ${t}`}
    const r=await fetch(API,{method:"POST",headers,body:JSON.stringify({action,...payload})});let out={};try{out=await r.json()}catch(_){}
    if(!r.ok)throw new Error(out.error||`Request failed (${r.status})`);return out
  }

  function ensureUi(){
    if(!q("#selfResetV39Styles")){const s=document.createElement("style");s.id="selfResetV39Styles";s.textContent=`
      #selfResetDialogV39 .self-reset-steps{display:grid;gap:12px}.self-reset-card{border:1px solid #d9e2ee;border-radius:12px;padding:12px;background:#f9fbfe}.self-reset-card strong{display:block;color:#24364d;font-size:12px}.self-reset-card small{display:block;color:#6b7a8e;margin-top:4px;line-height:1.45}.self-reset-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.self-reset-actions button{flex:1;min-width:120px}.self-reset-passwords{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.self-reset-passwords label{display:grid;gap:6px}.self-reset-passwords input{width:100%}.self-reset-admin{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}.self-reset-admin span{font-size:10px;font-weight:800;color:#9b551a}.self-reset-admin button{border:1px solid #ccd6e4;background:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:800;color:#1f5da8;cursor:pointer}.self-reset-admin .approve{background:#1f5da8;color:#fff;border-color:#1f5da8}@media(max-width:760px){.self-reset-passwords{grid-template-columns:1fr}}
    `;document.head.appendChild(s)}
    if(!q("#selfResetDialogV39"))document.body.insertAdjacentHTML("beforeend",`<dialog id="selfResetDialogV39" class="app-dialog"><div class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">FORGOT PASSWORD</div><h3>Reset your password</h3></div><button type="button" id="selfResetCloseV39" class="icon-close">×</button></div><p class="small-muted">For security, Admin approves your reset request. After approval, you choose your own new password here.</p><div class="self-reset-steps"><div class="self-reset-card"><strong>1. Request reset</strong><small>Enter your staff username and send the request.</small><label style="display:grid;gap:6px;margin-top:10px">Username<input id="selfResetUsernameV39" autocomplete="username"></label><div class="self-reset-actions"><button id="selfResetRequestV39" type="button" class="primary">Send Reset Request</button><button id="selfResetCheckV39" type="button" class="outline-btn">Check Approval</button></div></div><div id="selfResetPasswordCardV39" class="self-reset-card hidden"><strong>2. Set your new password</strong><small>Use at least 8 characters. This password is private and is not shown to Admin.</small><div class="self-reset-passwords"><label>New password<input id="selfResetNewV39" type="password" minlength="8" autocomplete="new-password"></label><label>Confirm password<input id="selfResetConfirmV39" type="password" minlength="8" autocomplete="new-password"></label></div><div class="self-reset-actions"><button id="selfResetShowV39" type="button" class="outline-btn">Show Password</button><button id="selfResetSaveV39" type="button" class="primary">Set New Password</button></div></div></div><div id="selfResetStatusV39" class="status-text" style="margin-top:12px"></div></div></dialog>`);
    const close=q("#selfResetCloseV39");if(close&&!close.dataset.bound){close.dataset.bound="1";close.onclick=()=>q("#selfResetDialogV39")?.close()}
    const request=q("#selfResetRequestV39");if(request&&!request.dataset.bound){request.dataset.bound="1";request.onclick=requestReset}
    const check=q("#selfResetCheckV39");if(check&&!check.dataset.bound){check.dataset.bound="1";check.onclick=checkReset}
    const save=q("#selfResetSaveV39");if(save&&!save.dataset.bound){save.dataset.bound="1";save.onclick=completeReset}
    const show=q("#selfResetShowV39");if(show&&!show.dataset.bound){show.dataset.bound="1";show.onclick=()=>{const a=q("#selfResetNewV39"),b=q("#selfResetConfirmV39");if(!a||!b)return;const reveal=a.type==="password";a.type=b.type=reveal?"text":"password";show.textContent=reveal?"Hide Password":"Show Password"}}
  }

  function currentUsername(){return (q("#selfResetUsernameV39")?.value||q("#loginUsername")?.value||"").trim()}
  function resetUiFor(username){ensureUi();const u=q("#selfResetUsernameV39");if(u)u.value=username||"";q("#selfResetPasswordCardV39")?.classList.add("hidden");if(q("#selfResetNewV39"))q("#selfResetNewV39").value="";if(q("#selfResetConfirmV39"))q("#selfResetConfirmV39").value="";setText("#selfResetStatusV39","");const st=readState();if(st&&String(st.username||"").toLowerCase()===String(username||"").toLowerCase())setText("#selfResetStatusV39","A reset request is already saved on this device. Tap Check Approval.")}
  function openReset(){const username=(q("#loginUsername")?.value||"").trim();resetUiFor(username);const d=q("#selfResetDialogV39");if(d&&!d.open)d.showModal()}

  async function requestReset(){
    const username=currentUsername(),btn=q("#selfResetRequestV39");if(!username){setText("#selfResetStatusV39","Enter your username.",true);return}
    try{if(typeof setBusy==="function")setBusy(btn,true,"Sending…");const r=await call("request",{username},false);if(r.reset_key){writeState({username,reset_key:r.reset_key,request_id:r.request_id||"",expires_at:r.expires_at||""});setText("#selfResetStatusV39","Reset request sent. Ask Admin to approve it, then tap Check Approval.")}else{writeState(null);setText("#selfResetStatusV39",r.message||"If the username is valid, the request was sent.")}}
    catch(e){setText("#selfResetStatusV39",e.message||String(e),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}
  }
  async function checkReset(){
    const username=currentUsername(),st=readState(),btn=q("#selfResetCheckV39");if(!st||String(st.username||"").toLowerCase()!==username.toLowerCase()){setText("#selfResetStatusV39","Send a reset request from this device first.",true);return}
    try{if(typeof setBusy==="function")setBusy(btn,true,"Checking…");const r=await call("status",{username,reset_key:st.reset_key},false);if(r.status==="approved"){q("#selfResetPasswordCardV39")?.classList.remove("hidden");setText("#selfResetStatusV39","Approved. Enter and save your new password.")}else if(r.status==="pending"){q("#selfResetPasswordCardV39")?.classList.add("hidden");setText("#selfResetStatusV39","Waiting for Admin approval.")}else{writeState(null);q("#selfResetPasswordCardV39")?.classList.add("hidden");setText("#selfResetStatusV39",r.message||"Reset request expired. Send a new request.",true)}}
    catch(e){setText("#selfResetStatusV39",e.message||String(e),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}
  }
  async function completeReset(){
    const username=currentUsername(),st=readState(),a=q("#selfResetNewV39")?.value||"",b=q("#selfResetConfirmV39")?.value||"",btn=q("#selfResetSaveV39");
    if(!st||String(st.username||"").toLowerCase()!==username.toLowerCase()){setText("#selfResetStatusV39","Your reset request is not available on this device. Start a new request.",true);return}
    if(a.length<8){setText("#selfResetStatusV39","Password must contain at least 8 characters.",true);return}
    if(a!==b){setText("#selfResetStatusV39","Passwords do not match.",true);return}
    try{if(typeof setBusy==="function")setBusy(btn,true,"Saving…");const r=await call("complete",{username,reset_key:st.reset_key,password:a},false);writeState(null);if(q("#loginUsername"))q("#loginUsername").value=username;if(q("#loginPassword"))q("#loginPassword").value="";setText("#selfResetStatusV39",r.message||"Password reset successfully.");setTimeout(()=>{q("#selfResetDialogV39")?.close();q("#loginPassword")?.focus();alert("Password reset successfully. Sign in with your new password.")},650)}
    catch(e){setText("#selfResetStatusV39",e.message||String(e),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}
  }

  function bindForgot(){ensureUi();const old=q("#forgotPasswordDialogV38");if(old?.open)try{old.close()}catch(_){}const b=q("#forgotPasswordBtnV38");if(b){b.textContent="Forgot password?";b.onclick=openReset;b.dataset.selfreset="39"}}

  async function fetchAdminRequests(force=false){
    if(adminBusy||typeof isAdmin!=="function"||!isAdmin()||!tokenNow())return adminRequests;adminBusy=true;
    try{const r=await call("list",{},true);adminRequests=Array.isArray(r.requests)?r.requests:[];return adminRequests}catch(e){console.warn("Self reset requests",e);return adminRequests}finally{adminBusy=false}
  }
  async function approveReset(id){try{await call("approve",{request_id:id},true);await fetchAdminRequests(true);decorateAdmin(true);alert("Reset approved. The staff member can now set their own new password from Forgot password.")}catch(e){alert(e.message||String(e))}}
  async function rejectReset(id){try{await call("reject",{request_id:id},true);await fetchAdminRequests(true);decorateAdmin(true)}catch(e){alert(e.message||String(e))}}
  window.approveSelfPasswordResetV39=approveReset;
  window.rejectSelfPasswordResetV39=rejectReset;

  async function decorateAdmin(refresh=false){
    if(typeof isAdmin!=="function"||!isAdmin())return;if(refresh||!adminRequests.length)await fetchAdminRequests(refresh);
    const rows=[...document.querySelectorAll("#userList .user-row")];rows.forEach((row,i)=>{const u=data?.users?.[i];if(!u)return;row.querySelector(".self-reset-admin")?.remove();const req=adminRequests.find(r=>r.user_id===u.id&&(r.status==="pending"||r.status==="approved"));if(!req)return;const box=document.createElement("div");box.className="self-reset-admin";if(req.status==="pending"){box.innerHTML=`<span>Forgot-password request · ${esc(fmt(req.requested_at))}</span><button type="button" class="approve">Approve Self-Reset</button><button type="button" class="reject">Reject</button>`;box.querySelector(".approve").onclick=()=>approveReset(req.id);box.querySelector(".reject").onclick=()=>rejectReset(req.id)}else{box.innerHTML=`<span>Self-reset approved · waiting for staff to set password</span>`}const target=row.children?.[1]||row;target.appendChild(box)})
  }

  try{if(typeof renderUsers==="function"){const prev=renderUsers;renderUsers=function(){const out=prev.apply(this,arguments);setTimeout(()=>decorateAdmin(true),80);return out}}}catch(_){}
  try{const prevInit=init;init=function(){const out=prevInit();setTimeout(bindForgot,0);setTimeout(bindForgot,250);setTimeout(()=>decorateAdmin(true),500);return out}}catch(_){}
  try{const prevOpen=openApp;openApp=function(){const out=prevOpen();setTimeout(bindForgot,0);setTimeout(()=>decorateAdmin(true),250);return out}}catch(_){}
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(bindForgot,0)});
})();