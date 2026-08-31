// Auth/session/password v38: stable account identity, safe self-password flow, visible temporary passwords for Admin.
(function(){
  const RESET_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/password-reset-api";
  const PARENT_PERSIST_KEY="khalsa_superadmin_return_token_persistent_v38";
  const PARENT_INFO_PERSIST_KEY="khalsa_superadmin_return_info_persistent_v38";
  const TEMP_STORE_KEY="khalsa_admin_temp_passwords_v38";
  const IMP_SESSION_KEY="khalsa_superadmin_return_token_v1";
  const IMP_INFO_SESSION_KEY="khalsa_superadmin_return_info_v1";
  const q=s=>document.querySelector(s);
  let requests=[];
  let requestBusy=false;

  function tokenKey(){try{return REMOTE_TOKEN_KEY}catch(_){return"khalsa_syllabus_api_token"}}
  function currentToken(){try{return typeof remoteToken==="function"?remoteToken():localStorage.getItem(tokenKey())||""}catch(_){return""}}
  function readJson(key,store=localStorage){try{return JSON.parse(store.getItem(key)||"{}")}catch(_){return{}}}
  function writeJson(key,val,store=localStorage){try{store.setItem(key,JSON.stringify(val))}catch(_){}}
  function tempMap(){return readJson(TEMP_STORE_KEY)}
  function storeTemp(userId,password){if(!userId||!password)return;const m=tempMap();m[userId]={password:String(password),issuedAt:new Date().toISOString()};writeJson(TEMP_STORE_KEY,m)}
  function clearTemp(userId){const m=tempMap();if(userId in m){delete m[userId];writeJson(TEMP_STORE_KEY,m)}}
  function savedTemp(userId){return tempMap()[userId]?.password||""}
  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
  function fmt(v){if(!v)return"";try{return new Date(v).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch(_){return String(v)}}
  function setMsg(sel,msg,bad=false){const el=q(sel);if(!el)return;el.textContent=msg||"";el.style.color=bad?"#b33a3a":"#2b6c49"}

  // Persist Admin-issued temporary passwords on the Admin browser so Show/Copy survives refresh.
  try{
    const oldRememberTemp=rememberTemp;
    rememberTemp=function(userId,password){try{oldRememberTemp(userId,password)}catch(_){}storeTemp(userId,password)};
  }catch(_){}
  try{
    const oldTempFor=tempFor;
    tempFor=function(userId){let v="";try{v=oldTempFor(userId)||""}catch(_){}return v||savedTemp(userId)};
  }catch(_){}

  async function resetCall(action,payload={},auth=false){
    const headers={"Content-Type":"application/json"};
    if(auth){const t=currentToken();if(!t)throw new Error("Please sign in again.");headers.Authorization=`Bearer ${t}`}
    const r=await fetch(RESET_API,{method:"POST",headers,body:JSON.stringify({action,...payload})});let out={};try{out=await r.json()}catch(_){}
    if(!r.ok)throw new Error(out.error||`Request failed (${r.status})`);return out
  }

  function ensureStyles(){if(q("#authV38Styles"))return;const s=document.createElement("style");s.id="authV38Styles";s.textContent=`
    .auth-v38-linkrow{display:flex;justify-content:flex-end;margin:2px 0 8px}.auth-v38-link{border:0;background:transparent;color:#1f5da8;font-weight:800;padding:5px 0;cursor:pointer}
    .auth-v38-temp{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px;font-size:11px;color:#5f6e81}.auth-v38-temp strong{color:#9a4d12}.auth-v38-temp button{border:1px solid #ccd6e4;background:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:800;color:#1f5da8;cursor:pointer}
    .auth-v38-private{display:block;margin-top:5px;font-size:10px;color:#6c7889}.auth-v38-request{display:block;margin-top:4px;font-size:10px;font-weight:800;color:#a54b12}
    #changePasswordTopV38,#switchAccountTopV38{white-space:nowrap}.profile-password-v38{border:1px solid #ccd6e4;background:#fff;border-radius:7px;padding:5px 7px;font-size:10px;font-weight:800;color:#1f5da8;cursor:pointer;margin-left:4px}
    #mobilePasswordV38,#mobileSwitchV38{border:1px solid #d7dfeb;background:#fff;border-radius:9px;padding:7px 8px;font-size:10px;font-weight:800;color:#1b4e89}
    @media(max-width:760px){#changePasswordTopV38,#switchAccountTopV38{display:none!important}}
  `;document.head.appendChild(s)}

  function ensureDialogs(){ensureStyles();
    if(!q("#forgotPasswordDialogV38"))document.body.insertAdjacentHTML("beforeend",`<dialog id="forgotPasswordDialogV38" class="app-dialog"><form id="forgotPasswordFormV38" class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">FORGOT PASSWORD</div><h3>Request password reset</h3></div><button type="button" id="forgotPasswordCloseV38" class="icon-close">×</button></div><p class="small-muted">Enter your username. The reset request will be visible to the school Super Admin.</p><label>Username<input id="forgotPasswordUsernameV38" autocomplete="username" required></label><div id="forgotPasswordStatusV38" class="status-text"></div><div class="row-actions"><span></span><button type="submit" class="primary">Send Reset Request</button></div></form></dialog>`);
    if(!q("#changePasswordDialogV38"))document.body.insertAdjacentHTML("beforeend",`<dialog id="changePasswordDialogV38" class="app-dialog"><form id="changePasswordFormV38" class="dialog-card"><div class="dialog-head"><div><div class="eyebrow">PASSWORD</div><h3 id="changePasswordTitleV38">Set / Change Password</h3></div><button type="button" id="changePasswordCloseV38" class="icon-close">×</button></div><p id="changePasswordNoteV38" class="small-muted">Set your own password with at least 8 characters.</p><div class="form-grid"><label>New password<span class="password-field"><input id="selfPasswordV38" type="password" minlength="8" autocomplete="new-password" required><button id="selfPasswordShowV38" type="button" class="link-btn">Show</button></span></label><label>Confirm password<input id="selfPasswordConfirmV38" type="password" minlength="8" autocomplete="new-password" required></label></div><div id="changePasswordStatusV38" class="status-text"></div><div class="row-actions"><span></span><button type="submit" class="primary">Save Password</button></div></form></dialog>`);
    const fc=q("#forgotPasswordCloseV38");if(fc&&!fc.dataset.bound){fc.dataset.bound="1";fc.onclick=()=>q("#forgotPasswordDialogV38")?.close()}
    const ff=q("#forgotPasswordFormV38");if(ff&&!ff.dataset.bound){ff.dataset.bound="1";ff.onsubmit=submitForgot}
    const cc=q("#changePasswordCloseV38");if(cc&&!cc.dataset.bound){cc.dataset.bound="1";cc.onclick=()=>{const d=q("#changePasswordDialogV38");if(d?.dataset.required!=="1")d?.close()}}
    const sf=q("#selfPasswordShowV38");if(sf&&!sf.dataset.bound){sf.dataset.bound="1";sf.onclick=()=>{const i=q("#selfPasswordV38");if(!i)return;i.type=i.type==="password"?"text":"password";sf.textContent=i.type==="password"?"Show":"Hide"}}
    const cf=q("#changePasswordFormV38");if(cf&&!cf.dataset.bound){cf.dataset.bound="1";cf.onsubmit=submitChange}
  }

  function ensureLoginControls(){ensureDialogs();const loginBtn=q("#loginBtn");if(loginBtn&&!q("#forgotPasswordBtnV38")){const row=document.createElement("div");row.className="auth-v38-linkrow";row.innerHTML='<button id="forgotPasswordBtnV38" type="button" class="auth-v38-link">Forgot password?</button>';loginBtn.before(row);q("#forgotPasswordBtnV38").onclick=()=>{q("#forgotPasswordUsernameV38").value=(q("#loginUsername")?.value||"").trim();setMsg("#forgotPasswordStatusV38","");q("#forgotPasswordDialogV38")?.showModal()}}
    const show=q("#togglePassword");if(show&&!show.dataset.v38){show.dataset.v38="1";show.addEventListener("click",()=>{const i=q("#loginPassword");if(!i)return;setTimeout(()=>{show.textContent=i.type==="password"?"Show":"Hide"},0)})}
  }

  function openPassword(required=false){ensureDialogs();const d=q("#changePasswordDialogV38");if(!d)return;d.dataset.required=required?"1":"0";q("#changePasswordCloseV38").style.visibility=required?"hidden":"visible";q("#changePasswordTitleV38").textContent=required?"Set Your Password":"Set / Change Password";q("#changePasswordNoteV38").textContent=required?"The current password is temporary. Set your own private password to continue.":"Set a new private password with at least 8 characters.";q("#changePasswordFormV38")?.reset();if(q("#selfPasswordV38"))q("#selfPasswordV38").type="password";q("#selfPasswordShowV38").textContent="Show";setMsg("#changePasswordStatusV38","");if(!d.open)d.showModal()}

  function ensureAppButtons(){
    const top=q(".top-actions");if(top&&!q("#changePasswordTopV38")){const b=document.createElement("button");b.id="changePasswordTopV38";b.type="button";b.className="top-btn";b.textContent="Set / Change Password";b.onclick=()=>openPassword(false);const logout=q("#logoutTopBtn");top.insertBefore(b,logout||null)}
    if(top&&!q("#switchAccountTopV38")){const b=document.createElement("button");b.id="switchAccountTopV38";b.type="button";b.className="top-btn";b.textContent="Switch User";b.onclick=switchUser;const logout=q("#logoutTopBtn");top.insertBefore(b,logout||null)}
    const mobile=q(".mobile-header");if(mobile&&!q("#mobilePasswordV38")){const b=document.createElement("button");b.id="mobilePasswordV38";b.type="button";b.textContent="Password";b.onclick=()=>openPassword(false);mobile.insertBefore(b,q("#mobileHelpBtn")||null)}
    if(mobile&&!q("#mobileSwitchV38")){const b=document.createElement("button");b.id="mobileSwitchV38";b.type="button";b.textContent="Switch";b.onclick=switchUser;mobile.insertBefore(b,q("#mobileHelpBtn")||null)}
    const profile=q(".profile-box");if(profile&&!q("#profilePasswordV38")){const b=document.createElement("button");b.id="profilePasswordV38";b.type="button";b.className="profile-password-v38";b.textContent="Password";b.title="Set or change my password";b.onclick=()=>openPassword(false);profile.insertBefore(b,q("#logoutBtn")||null)}
  }

  async function submitForgot(e){e.preventDefault();const username=(q("#forgotPasswordUsernameV38")?.value||"").trim(),btn=q('#forgotPasswordFormV38 button[type="submit"]');if(!username)return;if(typeof setBusy==="function")setBusy(btn,true,"Sending…");try{const r=await resetCall("request",{username},false);setMsg("#forgotPasswordStatusV38",r.message||"Reset request sent.");setTimeout(()=>q("#forgotPasswordDialogV38")?.close(),1000)}catch(err){setMsg("#forgotPasswordStatusV38",err.message||String(err),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}}

  async function submitChange(e){e.preventDefault();const a=q("#selfPasswordV38")?.value||"",b=q("#selfPasswordConfirmV38")?.value||"",btn=q('#changePasswordFormV38 button[type="submit"]');if(a.length<8){setMsg("#changePasswordStatusV38","Password must contain at least 8 characters.",true);return}if(a!==b){setMsg("#changePasswordStatusV38","Passwords do not match.",true);return}const username=currentUser?.username||"";if(!username){setMsg("#changePasswordStatusV38","Current user not found. Please sign in again.",true);return}if(typeof setBusy==="function")setBusy(btn,true,"Saving…");try{await remoteCall("change_password",{password:a});localStorage.removeItem(tokenKey());const lr=await remoteCall("login",{username,password:a},false);if(!lr?.token)throw new Error("Password changed, but a new session could not be created.");localStorage.setItem(tokenKey(),lr.token);await reloadRemote();try{await resetCall("resolve_self",{},true)}catch(_){}q("#changePasswordDialogV38")?.close();if(typeof openApp==="function")openApp();alert("Password saved successfully. You remain signed in.")}catch(err){setMsg("#changePasswordStatusV38",err.message||String(err),true)}finally{if(typeof setBusy==="function")setBusy(btn,false)}}

  async function switchUser(){try{if(typeof logout==="function")await logout()}catch(_){try{localStorage.removeItem(tokenKey())}catch(_){}}try{clearImpersonationAll()}catch(_){}try{q("#loginUsername").value="";q("#loginPassword").value="";q("#loginScreen")?.classList.remove("hidden");q("#appShell")?.classList.add("hidden");q("#loginUsername")?.focus()}catch(_){}}

  function clearImpersonationAll(){try{if(typeof clearImpersonationState==="function")clearImpersonationState()}catch(_){}try{sessionStorage.removeItem(IMP_SESSION_KEY);sessionStorage.removeItem(IMP_INFO_SESSION_KEY)}catch(_){}try{localStorage.removeItem(PARENT_PERSIST_KEY);localStorage.removeItem(PARENT_INFO_PERSIST_KEY)}catch(_){}}

  async function retryBootstrap(attempts=3){let last;for(let i=0;i<attempts;i++){try{return await reloadRemote()}catch(e){last=e;if(e?.authExpired||!currentToken())throw e;if(i<attempts-1)await new Promise(r=>setTimeout(r,300*(i+1)))}}throw last}

  // If a Super Admin refreshed/closed the browser while impersonating, return to the Admin token instead of restoring the Teacher token.
  function recoverParentToken(){let p="";try{p=sessionStorage.getItem(IMP_SESSION_KEY)||""}catch(_){}if(!p)try{p=localStorage.getItem(PARENT_PERSIST_KEY)||""}catch(_){}if(!p)return false;try{localStorage.setItem(tokenKey(),p);sessionStorage.removeItem(IMP_SESSION_KEY);sessionStorage.removeItem(IMP_INFO_SESSION_KEY);localStorage.removeItem(PARENT_PERSIST_KEY);localStorage.removeItem(PARENT_INFO_PERSIST_KEY);return true}catch(_){return false}}

  try{
    restoreSession=async function(){recoverParentToken();if(!currentToken())return;try{await retryBootstrap(3);openApp()}catch(e){currentUser=null;if(e?.authExpired||!currentToken()){localStorage.removeItem(tokenKey());try{showLoginError("Your session has expired. Please sign in again.")}catch(_){}}else{try{showLoginError("Could not reconnect. Your login is still saved; refresh when the connection is stable.")}catch(_){}}}}
  }catch(_){}

  try{
    login=async function(){const username=(q("#loginUsername")?.value||"").trim(),password=q("#loginPassword")?.value||"",btn=q("#loginBtn");if(!username||!password){showLoginError("Enter both username and password.");return}clearImpersonationAll();if(typeof setBusy==="function")setBusy(btn,true,"Signing in…");try{const r=await remoteCall("login",{username,password},false);if(!r?.token)throw new Error("Login failed.");localStorage.setItem(tokenKey(),r.token);await retryBootstrap(3);q("#loginPassword").value="";q("#loginError")?.classList.add("hidden");openApp()}catch(e){showLoginError(e.message||"Unable to sign in.")}finally{if(typeof setBusy==="function")setBusy(btn,false)}}
  }catch(_){}

  // Persist the Super Admin return token across a browser close/refresh during impersonation.
  try{
    if(typeof window.loginAsUser==="function"){
      const oldLoginAs=window.loginAsUser;
      window.loginAsUser=async function(id){const parent=currentToken(),info=currentUser?{id:currentUser.id,name:currentUser.name,username:currentUser.username,role:currentUser.role}:null;const out=await oldLoginAs(id);try{if(typeof impersonationActive==="function"&&impersonationActive()&&parent){localStorage.setItem(PARENT_PERSIST_KEY,parent);if(info)localStorage.setItem(PARENT_INFO_PERSIST_KEY,JSON.stringify(info))}}catch(_){}return out}
    }
    if(typeof window.returnToSuperAdmin==="function"){
      const oldReturn=window.returnToSuperAdmin;window.returnToSuperAdmin=async function(){const out=await oldReturn();try{localStorage.removeItem(PARENT_PERSIST_KEY);localStorage.removeItem(PARENT_INFO_PERSIST_KEY)}catch(_){}return out}
    }
  }catch(_){}

  async function fetchRequests(){if(requestBusy||typeof isAdmin!=="function"||!isAdmin()||!currentToken())return;requestBusy=true;try{const r=await resetCall("list",{},true);requests=Array.isArray(r.requests)?r.requests:[]}catch(e){console.warn("Password reset requests",e)}finally{requestBusy=false}}

  function decorateUsers(){if(typeof isAdmin!=="function"||!isAdmin())return;const rows=[...document.querySelectorAll("#userList .user-row")];rows.forEach((row,i)=>{const u=data?.users?.[i];if(!u)return;const old=row.querySelector(".password-admin-meta");if(old)old.remove();let box=row.querySelector(".auth-v38-passwordbox");if(box)box.remove();box=document.createElement("div");box.className="auth-v38-passwordbox";const info=row.children?.[1]||row;const temp=savedTemp(u.id)||(()=>{try{return typeof tempFor==="function"?tempFor(u.id):""}catch(_){return""}})();if(!u.mustChangePassword&&temp)clearTemp(u.id);const effective=!u.mustChangePassword?"":temp;if(effective){box.className="auth-v38-passwordbox auth-v38-temp";const label=document.createElement("strong");label.textContent="Temporary password: ••••••••";box.appendChild(label);const show=document.createElement("button");show.type="button";show.textContent="Show";let shown=false;show.onclick=()=>{shown=!shown;label.textContent=shown?`Temporary password: ${effective}`:"Temporary password: ••••••••";show.textContent=shown?"Hide":"Show"};box.appendChild(show);const copy=document.createElement("button");copy.type="button";copy.textContent="Copy";copy.onclick=async()=>{try{await navigator.clipboard.writeText(effective);alert("Temporary password copied.")}catch(_){prompt("Copy temporary password",effective)}};box.appendChild(copy)}else{box.className="auth-v38-passwordbox auth-v38-private";box.textContent=u.mustChangePassword?"Temporary password exists but was issued from another Admin device. Reset again to view/share it.":"Password: Private — set by the user (not readable by Admin)."}const req=requests.find(r=>r.user_id===u.id&&r.status==="pending");if(req){const note=document.createElement("span");note.className="auth-v38-request";note.textContent=`Password reset requested · ${fmt(req.requested_at)}`;box.appendChild(note)}info.appendChild(box)})}

  try{
    if(typeof renderUsers==="function"){const oldRenderUsers=renderUsers;renderUsers=function(){const out=oldRenderUsers.apply(this,arguments);decorateUsers();setTimeout(async()=>{await fetchRequests();decorateUsers()},40);return out}}
  }catch(_){}

  try{
    if(typeof openApp==="function"){
      const oldOpenApp=openApp;
      openApp=function(){const must=!!currentUser?.mustChangePassword,imp=(typeof impersonationActive==="function"&&impersonationActive());if(currentUser&&must)currentUser.mustChangePassword=false;const out=oldOpenApp.apply(this,arguments);if(currentUser)currentUser.mustChangePassword=must;setTimeout(async()=>{ensureAppButtons();if(must&&!imp)openPassword(true);if(typeof isAdmin==="function"&&isAdmin()){await fetchRequests();decorateUsers()}},90);return out}
    }
  }catch(_){}

  try{
    const oldLogout=logout;logout=async function(){try{clearImpersonationAll()}catch(_){}return oldLogout.apply(this,arguments)}
  }catch(_){}

  try{
    const oldInit=init;init=function(){const out=oldInit.apply(this,arguments);ensureLoginControls();ensureAppButtons();return out}
  }catch(_){}

  ensureStyles();ensureDialogs();ensureLoginControls();
  window.__AUTH_SESSION_PASSWORD_V38__=true;
})();