const IMPERSONATE_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/syllabus-impersonate";
const SUPERADMIN_RETURN_TOKEN_KEY="khalsa_superadmin_return_token_v1";
const SUPERADMIN_RETURN_INFO_KEY="khalsa_superadmin_return_info_v1";

function impersonationActive(){return!!sessionStorage.getItem(SUPERADMIN_RETURN_TOKEN_KEY)}
function clearImpersonationState(){sessionStorage.removeItem(SUPERADMIN_RETURN_TOKEN_KEY);sessionStorage.removeItem(SUPERADMIN_RETURN_INFO_KEY)}
function returnSuperAdminInfo(){try{return JSON.parse(sessionStorage.getItem(SUPERADMIN_RETURN_INFO_KEY)||"null")}catch(e){return null}}

async function requestImpersonation(userId){
  const t=remoteToken();if(!t)throw new Error("Please sign in again.");
  const r=await fetch(IMPERSONATE_API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({user_id:userId})});let out={};try{out=await r.json()}catch(e){}
  if(!r.ok)throw new Error(out.error||`Unable to open staff login (${r.status})`);return out
}

function ensureImpersonationBar(){
  const shell=document.querySelector(".content-shell");if(!shell)return null;let bar=document.getElementById("impersonationBar");if(bar)return bar;
  bar=document.createElement("div");bar.id="impersonationBar";bar.style.cssText="display:none;position:sticky;top:0;z-index:1200;background:#fff3cd;border-bottom:1px solid #eed58b;padding:9px 14px;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:700;color:#654f0b";
  bar.innerHTML='<span id="impersonationText"></span><button id="returnSuperAdminBtn" type="button" style="border:1px solid #9a7b19;background:#fff;border-radius:8px;padding:7px 11px;font-weight:800;color:#654f0b;cursor:pointer">Return to Super Admin</button>';
  shell.insertBefore(bar,shell.firstChild);document.getElementById("returnSuperAdminBtn").onclick=returnToSuperAdmin;return bar
}
function updateImpersonationBar(){
  const bar=ensureImpersonationBar();if(!bar)return;if(!impersonationActive()){bar.style.display="none";return}
  bar.style.display="flex";const t=document.getElementById("impersonationText");if(t)t.innerHTML=`SUPER ADMIN VIEW · Logged in as <strong>${esc(currentUser?.name||"")}</strong> (${esc(currentUser?.role||"")})`;
}

window.loginAsUser=async id=>{
  if(currentUser?.role!=="Super Admin"||impersonationActive())return;const u=data.users.find(x=>x.id===id);if(!u||!["Teacher","HOD"].includes(u.role))return;if(u.accessEnabled===false){alert("This user's access is disabled. Enable the account first.");return}
  if(!confirm(`Open the app as ${u.name} (${u.role})?\n\nYou can return to Super Admin without entering any password.`))return;
  const originalToken=remoteToken(),originalInfo={id:currentUser.id,name:currentUser.name,username:currentUser.username,role:currentUser.role};
  try{const r=await requestImpersonation(id);sessionStorage.setItem(SUPERADMIN_RETURN_TOKEN_KEY,originalToken);sessionStorage.setItem(SUPERADMIN_RETURN_INFO_KEY,JSON.stringify(originalInfo));localStorage.setItem(REMOTE_TOKEN_KEY,r.token);await reloadRemote();if(currentUser)currentUser.mustChangePassword=false;openApp()}catch(e){clearImpersonationState();localStorage.setItem(REMOTE_TOKEN_KEY,originalToken);alert(e.message||String(e))}
};

window.returnToSuperAdmin=async()=>{
  const parent=sessionStorage.getItem(SUPERADMIN_RETURN_TOKEN_KEY);if(!parent){clearImpersonationState();updateImpersonationBar();return}
  try{if(remoteToken())await remoteCall("logout")}catch(e){}
  localStorage.setItem(REMOTE_TOKEN_KEY,parent);clearImpersonationState();
  try{await reloadRemote();openApp();if(typeof showView==="function")showView("users")}catch(e){localStorage.removeItem(REMOTE_TOKEN_KEY);alert("The Super Admin session has expired. Please sign in again.");location.reload()}
};

const _impersonateRenderUsers=renderUsers;
renderUsers=function(){
  _impersonateRenderUsers();if(currentUser?.role!=="Super Admin"||impersonationActive())return;const rows=[...document.querySelectorAll("#userList .user-row")];
  rows.forEach((row,i)=>{const u=data.users[i],actions=row.querySelector(".plan-actions");if(!u||!actions||!["Teacher","HOD"].includes(u.role)||actions.querySelector(".login-as-user-btn"))return;const b=document.createElement("button");b.type="button";b.className="login-as-user-btn";b.textContent=`Login as ${u.role}`;b.disabled=u.accessEnabled===false;b.title=u.accessEnabled===false?"Enable this account first":"Open this staff account without using their password";b.onclick=()=>loginAsUser(u.id);actions.insertBefore(b,actions.firstChild)})
};

const _impersonateOpenApp=openApp;
openApp=function(){if(impersonationActive()&&currentUser)currentUser.mustChangePassword=false;_impersonateOpenApp();updateImpersonationBar()};

const _impersonateLogout=logout;
logout=async function(){clearImpersonationState();return _impersonateLogout()};

const _impersonateInit=init;
init=function(){ensureImpersonationBar();_impersonateInit();updateImpersonationBar()};
