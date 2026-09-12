// Direct self-service forgot-password bridge v40.
(function(){
  const API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/password-reset-api";
  async function api(action,payload){const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});let o={};try{o=await r.json()}catch(_){}if(!r.ok)throw new Error(o.error||`Reset failed (${r.status})`);return o}
  async function run(){
    const username=(document.querySelector("#loginUsername")?.value||"").trim()||prompt("Enter your username:")||"";if(!username)return;
    const identity=prompt("Enter your Employee ID:")||"";if(!identity)return;
    const password=prompt("Enter a new password (minimum 8 characters):")||"";if(password.length<8){alert("Password must contain at least 8 characters.");return}
    const confirm=prompt("Confirm the new password:")||"";if(password!==confirm){alert("Passwords do not match.");return}
    try{const s=await api("self_start",{username,identity});const d=await api("self_complete",{username,reset_key:s.reset_key,password});alert(d.message||"Password reset successfully. Sign in with your new password.");const p=document.querySelector("#loginPassword");if(p){p.value="";p.focus()}}catch(e){alert(e.message||String(e))}
  }
  function bind(){const b=document.querySelector("#forgotPasswordBtnV38");if(b){b.textContent="Forgot password?";b.onclick=run;b.dataset.directReset="40"}}
  setInterval(bind,1000);setTimeout(bind,200)
})();
