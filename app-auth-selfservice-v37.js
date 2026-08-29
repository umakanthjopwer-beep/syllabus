// Authentication self-service v37: no page-wide mutation loop; safe forgot/change-password UI.
(function(){
  const RESET_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/password-reset-api";
  const q=s=>document.querySelector(s);
  let resetRequests=[];
  let adminRefreshBusy=false;

  async function resetCall(action,payload={},auth=false){
    const headers={"Content-Type":"application/json"};
    if(auth){
      const t=typeof remoteToken==="function"?remoteToken():"";
      if(!t)throw new Error("Please sign in again.");
      headers.Authorization=`Bearer ${t}`;
    }
    const r=await fetch(RESET_API,{method:"POST",headers,body:JSON.stringify({action,...payload})});
    let out={};try{out=await r.json()}catch(_){}
    if(!r.ok)throw new Error(out.error||`Request failed (${r.status})`);
    return out;
  }
  function fmt(v){if(!v)return"";try{return new Date(v).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch(_){return String(v)}}
  function setText(sel,msg,bad=false){const el=q(sel);if(!el)return;el.textContent=msg||"";el.style.color=bad?"#b33a3a":"#2b6c49"}

  function ensureStyles(){
    if(q("#authSelfServiceStylesV37"))return;
    const s=document.createElement("style");s.id="authSelfServiceStylesV37";
    s.textContent=`.auth-link-row{display:flex;justify-content:flex-end;margin-top:-4px;margin-bottom:8px}.auth-link-btn{border:0;background:transparent;color:#1f5da8;font-weight:800;padding:6px 0;cursor:pointer}.password-request-badge-v37{display:block;margin-top:5px;font-size:11px;font-weight:800;color:#a54b12}.password-request-complete-v37{display:block;margin-top:5px;font-size:10px;color:#607086}#changePasswordTopBtn,#mobileChangePasswordBtn{white-space:nowrap}#mobileChangePasswordBtn{border:1px solid #d7dfeb;background:#fff;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:800;color:#1b4e89}@media(max-width:760px){#changePasswordTopBtn{display:none!important}}`;
    document.head.appendChild(s);
  }

  function ensureDialogs(){
    ensureStyles();
    if(!q("#forgotPasswordDialog")){
      document.body.insertAdjacentHTML("beforeend",`<dialog id="forgotPasswordDialog" class="app-dialog"><form id="forgotPasswordForm" class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">FORGOT PASSWORD</div><h3>Request password reset</h3></div><button type="button" id="forgotPasswordClose" class="icon-close">×</button></div><p class="small-muted">Enter your Syllabus Tracker username. The school Super Admin will receive the reset request.</p><label>Username<input id="forgotPasswordUsername" autocomplete="username" required></label><div id="forgotPasswordStatus" class="status-text"></div><div class="row-actions"><span></span><button type="submit" class="primary">Send Reset Request</button></div></form></dialog>`);
      q("#forgotPasswordClose").onclick=()=>q("#forgotPasswordDialog")?.close();
      q("#forgotPasswordForm").onsubmit=submitForgot;
    }
    if(!q("#changePasswordDialog")){
      document.body.insertAdjacentHTML("beforeend",`<dialog id="changePasswordDialog" class="app-dialog"><form id="changePasswordForm" class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">PASSWORD</div><h3 id="changePasswordTitle">Change password</h3></div><button type="button" id="changePasswordClose" class="icon-close">×</button></div><p id="changePasswordNote" class="small-muted">Choose a new password with at least 8 characters.</p><div class="form-grid"><label>New password<span class="password-field"><input id="selfNewPassword" type="password" minlength="8" autocomplete="new-password" required><button id="selfShowPassword" type="button" class="link-btn">Show</button></span></label><label>Confirm password<input id="selfConfirmPassword" type="password" minlength="8" autocomplete="new-password" required></label></div><div id="changePasswordStatus" class="status-text"></div><div class="row-actions"><span></span><button type="submit" class="primary">Save New Password</button></div></form></dialog>`);
      q("#changePasswordClose").onclick=()=>{const d=q("#changePasswordDialog");if(d?.dataset.required!=="1")d?.close()};
      q("#selfShowPassword").onclick=()=>{const i=q("#selfNewPassword");if(!i)return;i.type=i.type==="password"?"text":"password";q("#selfShowPassword").textContent=i.type==="password"?"Show":"Hide"};
      q("#changePasswordForm").onsubmit=submitChangePassword;
    }
  }

  function ensureLoginForgot(){
    const btn=q("#loginBtn");if(!btn||q("#forgotPasswordBtn"))return;
    const row=document.createElement("div");row.className="auth-link-row";
    row.innerHTML='<button id="forgotPasswordBtn" type="button" class="auth-link-btn">Forgot password?</button>';
    btn.before(row);
    q("#forgotPasswordBtn").onclick=()=>{ensureDialogs();const u=q("#forgotPasswordUsername");if(u)u.value=(q("#loginUsername")?.value||"").trim();setText("#forgotPasswordStatus","");q("#forgotPasswordDialog")?.showModal()};
  }

  function ensureChangeButtons(){
    const top=q(".top-actions");
    if(top&&!q("#changePasswordTopBtn")){
      const b=document.createElement("button");b.id="changePasswordTopBtn";b.type="button";b.className="top-btn";b.textContent="Password";b.onclick=()=>openChangePassword(false);const logout=q("#logoutTopBtn");top.insertBefore(b,logout||null);
    }
    const mobile=q(".mobile-header");
    if(mobile&&!q("#mobileChangePasswordBtn")){
      const b=document.createElement("button");b.id="mobileChangePasswordBtn";b.type="button";b.textContent="Password";b.onclick=()=>openChangePassword(false);const help=q("#mobileHelpBtn");mobile.insertBefore(b,help||null);
    }
  }

  function openChangePassword(required=false){
    ensureDialogs();const d=q("#changePasswordDialog");if(!d)return;
    d.dataset.required=required?"1":"0";
    if(q("#changePasswordClose"))q("#changePasswordClose").style.visibility=required?"hidden":"visible";
    if(q("#changePasswordTitle"))q("#changePasswordTitle").textContent=required?"Set your new password":"Change password";
    if(q("#changePasswordNote"))q("#changePasswordNote").textContent=required?"You are using a temporary password. Set your own password to continue.":"Choose a new password with at least 8 characters.";
    q("#changePasswordForm")?.reset();setText("#changePasswordStatus","");if(!d.open)d.showModal();
  }

  async function submitForgot(e){
    e.preventDefault();const username=(q("#forgotPasswordUsername")?.value||"").trim(),btn=q('#forgotPasswordForm button[type="submit"]');if(!username)return;
    if(typeof setBusy==="function")setBusy(btn,true,"Sending…");
    try{const r=await resetCall("request",{username},false);setText("#forgotPasswordStatus",r.message||"Reset request sent.");setTimeout(()=>q("#forgotPasswordDialog")?.close(),1200)}catch(err){setText("#forgotPasswordStatus",err.message||String(err),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}
  }

  async function submitChangePassword(e){
    e.preventDefault();const a=q("#selfNewPassword")?.value||"",b=q("#selfConfirmPassword")?.value||"",btn=q('#changePasswordForm button[type="submit"]');
    if(a.length<8){setText("#changePasswordStatus","Password must contain at least 8 characters.",true);return}
    if(a!==b){setText("#changePasswordStatus","Passwords do not match.",true);return}
    const username=currentUser?.username||"";if(!username){setText("#changePasswordStatus","User session not found. Please sign in again.",true);return}
    if(typeof setBusy==="function")setBusy(btn,true,"Saving…");
    try{
      await remoteCall("change_password",{password:a});
      try{localStorage.removeItem(REMOTE_TOKEN_KEY)}catch(_){}
      const lr=await remoteCall("login",{username,password:a},false);if(!lr?.token)throw new Error("Password changed, but automatic sign-in failed.");
      localStorage.setItem(REMOTE_TOKEN_KEY,lr.token);await reloadRemote();
      try{await resetCall("resolve_self",{},true)}catch(_){}
      q("#changePasswordDialog")?.close();if(typeof openApp==="function")openApp();alert("Password changed successfully.");
    }catch(err){setText("#changePasswordStatus",err.message||String(err),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}
  }

  async function loadResetRequests(){
    if(typeof isAdmin!=="function"||!isAdmin()||!remoteToken())return[];
    const r=await resetCall("list",{},true);resetRequests=Array.isArray(r.requests)?r.requests:[];return resetRequests;
  }

  function decorateUsers(){
    if(typeof isAdmin!=="function"||!isAdmin())return;
    const rows=[...document.querySelectorAll("#userList .user-row")];
    rows.forEach((row,i)=>{
      const u=data?.users?.[i];if(!u)return;
      const req=resetRequests.find(r=>r.user_id===u.id&&r.status==="pending")||resetRequests.find(r=>r.user_id===u.id&&r.status==="completed");
      let note=row.querySelector(".password-request-note-v37");
      if(!req){if(note)note.remove();return}
      if(!note){note=document.createElement("small");note.className="password-request-note-v37";(row.children?.[1]||row).appendChild(note)}
      if(req.status==="pending"){
        note.className="password-request-note-v37 password-request-badge-v37";
        note.textContent=u.mustChangePassword?"Temporary password issued · waiting for teacher to set a new password":`Password reset requested · ${fmt(req.requested_at)}`;
      }else{
        note.className="password-request-note-v37 password-request-complete-v37";
        note.textContent=`Password reset completed · ${fmt(req.completed_at)}`;
      }
    });
  }

  async function refreshAdminRequests(){
    if(adminRefreshBusy)return;adminRefreshBusy=true;
    try{await loadResetRequests();decorateUsers()}catch(e){console.warn("Password reset requests",e)}finally{adminRefreshBusy=false}
  }

  ensureStyles();ensureDialogs();ensureLoginForgot();

  try{
    if(typeof openApp==="function"){
      const previousOpenApp=openApp;
      openApp=function(){const out=previousOpenApp.apply(this,arguments);setTimeout(()=>{try{ensureChangeButtons();if(currentUser?.mustChangePassword)openChangePassword(true);if(typeof isAdmin==="function"&&isAdmin())refreshAdminRequests()}catch(e){console.warn("Password UI after login",e)}},80);return out};
    }
  }catch(e){console.warn("Password openApp hook",e)}

  try{
    if(typeof renderUsers==="function"){
      const previousRenderUsers=renderUsers;
      renderUsers=function(){const out=previousRenderUsers.apply(this,arguments);setTimeout(()=>{try{refreshAdminRequests()}catch(_){}},60);return out};
    }
  }catch(e){console.warn("Password user-list hook",e)}

  window.__AUTH_SELF_SERVICE_V37__=true;
})();