// Authentication self-service v36: forgot-password requests, teacher self-change, stable re-login.
(function(){
  const RESET_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/password-reset-api";
  const q=s=>document.querySelector(s);
  let resetRequests=[];

  async function resetCall(action,payload={},auth=false){
    const headers={"Content-Type":"application/json"};
    if(auth){const t=typeof remoteToken==="function"?remoteToken():"";if(!t)throw new Error("Please sign in again.");headers.Authorization=`Bearer ${t}`}
    const r=await fetch(RESET_API,{method:"POST",headers,body:JSON.stringify({action,...payload})});
    let out={};try{out=await r.json()}catch(_){}
    if(!r.ok)throw new Error(out.error||`Request failed (${r.status})`);
    return out
  }
  function fmt(v){if(!v)return"";try{return new Date(v).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch(_){return String(v)}}
  function setText(sel,msg,bad=false){const el=q(sel);if(!el)return;el.textContent=msg||"";el.style.color=bad?"#b33a3a":"#2b6c49"}

  function ensureStyles(){
    if(q("#authSelfServiceStyles"))return;
    const s=document.createElement("style");s.id="authSelfServiceStyles";
    s.textContent=`
      .auth-link-row{display:flex;justify-content:flex-end;margin-top:-4px;margin-bottom:8px}.auth-link-btn{border:0;background:transparent;color:#1f5da8;font-weight:800;padding:6px 0;cursor:pointer}
      .password-request-badge{display:block;margin-top:5px;font-size:11px;font-weight:800;color:#a54b12}.password-request-complete{display:block;margin-top:5px;font-size:10px;color:#607086}
      #changePasswordTopBtn,#mobileChangePasswordBtn{white-space:nowrap}
      #mobileChangePasswordBtn{border:1px solid #d7dfeb;background:#fff;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:800;color:#1b4e89}
      @media(max-width:760px){#changePasswordTopBtn{display:none!important}}
    `;document.head.appendChild(s)
  }

  function ensureDialogs(){
    ensureStyles();
    if(!q("#forgotPasswordDialog")){
      document.body.insertAdjacentHTML("beforeend",`<dialog id="forgotPasswordDialog" class="app-dialog"><form id="forgotPasswordForm" class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">FORGOT PASSWORD</div><h3>Request password reset</h3></div><button type="button" id="forgotPasswordClose" class="icon-close">×</button></div><p class="small-muted">Enter your Syllabus Tracker username. A reset request will be shown to the school Super Admin.</p><label>Username<input id="forgotPasswordUsername" autocomplete="username" required></label><div id="forgotPasswordStatus" class="status-text"></div><div class="row-actions"><span></span><button type="submit" class="primary">Send Reset Request</button></div></form></dialog>`);
      q("#forgotPasswordClose").onclick=()=>q("#forgotPasswordDialog")?.close();
      q("#forgotPasswordForm").onsubmit=submitForgot
    }
    if(!q("#changePasswordDialog")){
      document.body.insertAdjacentHTML("beforeend",`<dialog id="changePasswordDialog" class="app-dialog"><form id="changePasswordForm" class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">PASSWORD</div><h3 id="changePasswordTitle">Change password</h3></div><button type="button" id="changePasswordClose" class="icon-close">×</button></div><p id="changePasswordNote" class="small-muted">Choose a new password with at least 8 characters.</p><div class="form-grid"><label>New password<span class="password-field"><input id="selfNewPassword" type="password" minlength="8" autocomplete="new-password" required><button id="selfShowPassword" type="button" class="link-btn">Show</button></span></label><label>Confirm password<input id="selfConfirmPassword" type="password" minlength="8" autocomplete="new-password" required></label></div><div id="changePasswordStatus" class="status-text"></div><div class="row-actions"><span></span><button type="submit" class="primary">Save New Password</button></div></form></dialog>`);
      q("#changePasswordClose").onclick=()=>{const d=q("#changePasswordDialog");if(d?.dataset.required!=="1")d?.close()};
      q("#selfShowPassword").onclick=()=>{const i=q("#selfNewPassword");if(!i)return;i.type=i.type==="password"?"text":"password";q("#selfShowPassword").textContent=i.type==="password"?"Show":"Hide"};
      q("#changePasswordForm").onsubmit=submitChangePassword
    }
  }

  function ensureLoginForgot(){
    try{
      const btn=q("#loginBtn"),card=q("#loginScreen .login-card");if(!btn||!card||q("#forgotPasswordBtn"))return;
      const row=document.createElement("div");row.className="auth-link-row";row.innerHTML='<button id="forgotPasswordBtn" type="button" class="auth-link-btn">Forgot password?</button>';
      btn.before(row);q("#forgotPasswordBtn").onclick=()=>{ensureDialogs();const u=q("#forgotPasswordUsername");if(u)u.value=(q("#loginUsername")?.value||"").trim();setText("#forgotPasswordStatus","");q("#forgotPasswordDialog")?.showModal()}
    }catch(e){console.warn("Forgot password UI",e)}
  }
  function ensureChangeButtons(){
    try{
      const top=q(".top-actions");if(top&&!q("#changePasswordTopBtn")){const b=document.createElement("button");b.id="changePasswordTopBtn";b.type="button";b.className="top-btn";b.textContent="Password";b.onclick=()=>openChangePassword(false);const logout=q("#logoutTopBtn");top.insertBefore(b,logout||null)}
      const mobile=q(".mobile-header");if(mobile&&!q("#mobileChangePasswordBtn")){const b=document.createElement("button");b.id="mobileChangePasswordBtn";b.type="button";b.textContent="Password";b.onclick=()=>openChangePassword(false);const help=q("#mobileHelpBtn");mobile.insertBefore(b,help||null)}
    }catch(e){console.warn("Change password buttons",e)}
  }
  function openChangePassword(required=false){
    ensureDialogs();
    const d=q("#changePasswordDialog");if(!d)return;
    d.dataset.required=required?"1":"0";
    const close=q("#changePasswordClose");if(close)close.style.visibility=required?"hidden":"visible";
    q("#changePasswordTitle").textContent=required?"Set your new password":"Change password";
    q("#changePasswordNote").textContent=required?"You are using a temporary/reset password. Set your own password to continue using the app normally.":"Choose a new password with at least 8 characters.";
    q("#changePasswordForm")?.reset();if(q("#selfNewPassword"))q("#selfNewPassword").type="password";if(q("#selfShowPassword"))q("#selfShowPassword").textContent="Show";setText("#changePasswordStatus","");
    if(!d.open)d.showModal()
  }

  async function submitForgot(e){
    e.preventDefault();const username=(q("#forgotPasswordUsername")?.value||"").trim(),btn=q('#forgotPasswordForm button[type="submit"]');if(!username)return;
    if(typeof setBusy==="function")setBusy(btn,true,"Sending…");
    try{const r=await resetCall("request",{username},false);setText("#forgotPasswordStatus",r.message||"Reset request sent.");setTimeout(()=>q("#forgotPasswordDialog")?.close(),1300)}catch(err){setText("#forgotPasswordStatus",err.message||String(err),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}
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
      localStorage.setItem(REMOTE_TOKEN_KEY,lr.token);
      await reloadRemote();
      try{await resetCall("resolve_self",{},true)}catch(_){}
      q("#changePasswordDialog")?.close();
      if(typeof openApp==="function")openApp();
      alert("Password changed successfully. You remain signed in.")
    }catch(err){
      const msg=err.message||String(err);setText("#changePasswordStatus",msg,true);
      if(!remoteToken()){
        try{currentUser=null;q("#appShell")?.classList.add("hidden");q("#loginScreen")?.classList.remove("hidden");if(q("#loginUsername"))q("#loginUsername").value=username;showLoginError("Password changed. Please sign in once with your new password.")}catch(_){}
      }
    }finally{if(typeof setBusy==="function")setBusy(btn,false)}
  }

  async function loadResetRequests(){
    try{if(typeof isAdmin!=="function"||!isAdmin()||!remoteToken())return[];const r=await resetCall("list",{},true);resetRequests=Array.isArray(r.requests)?r.requests:[];return resetRequests}catch(e){console.warn("Password reset requests",e);return[]}
  }
  function decorateUsers(){
    try{
      if(typeof isAdmin!=="function"||!isAdmin())return;
      const rows=[...document.querySelectorAll("#userList .user-row")];
      rows.forEach((row,i)=>{
        const u=data?.users?.[i];if(!u)return;
        row.querySelectorAll(".password-reset-badge-v36,.password-reset-complete-v36,.password-reset-now-v36").forEach(x=>x.remove());
        const requests=resetRequests.filter(r=>r.user_id===u.id),pending=requests.find(r=>r.status==="pending"),done=requests.find(r=>r.status==="completed");
        const info=row.children?.[1]||row;
        if(pending){const x=document.createElement("small");x.className="password-request-badge password-reset-badge-v36";x.textContent=u.mustChangePassword?`Reset requested · temporary password issued · waiting for teacher change`:`Password reset requested · ${fmt(pending.requested_at)}`;info.appendChild(x);const actions=row.querySelector(".plan-actions");if(actions&&typeof resetUserPassword==="function"){const b=document.createElement("button");b.type="button";b.className="password-reset-now-v36";b.textContent="Reset now";b.onclick=()=>resetUserPassword(u.id);actions.prepend(b)}}
        else if(done){const x=document.createElement("small");x.className="password-request-complete password-reset-complete-v36";x.textContent=`Password changed after reset: ${fmt(done.completed_at)}`;info.appendChild(x)}
      })
    }catch(e){console.warn("Password request badges",e)}
  }
  async function refreshAdminRequests(){await loadResetRequests();decorateUsers()}

  try{
    if(typeof openApp==="function"){
      const previousOpenApp=openApp;
      openApp=function(){const out=previousOpenApp.apply(this,arguments);setTimeout(()=>{ensureChangeButtons();refreshAdminRequests();if(currentUser?.mustChangePassword)openChangePassword(true)},80);return out}
    }
  }catch(e){console.warn("Password openApp hook",e)}
  try{
    if(typeof renderUsers==="function"){
      const previousRenderUsers=renderUsers;
      renderUsers=function(){const out=previousRenderUsers.apply(this,arguments);setTimeout(()=>{refreshAdminRequests()},30);return out}
    }
  }catch(e){console.warn("Password user-list hook",e)}

  const obs=new MutationObserver(()=>{ensureLoginForgot();ensureChangeButtons();decorateUsers()});
  try{obs.observe(document.documentElement,{childList:true,subtree:true})}catch(_){}
  setTimeout(()=>{ensureDialogs();ensureLoginForgot();ensureChangeButtons()},0);
  window.__AUTH_SELF_SERVICE_V36__=true;
})();