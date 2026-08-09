async function sha256Text(value){
  const bytes=new TextEncoder().encode(String(value));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function login(){
  const username=norm(document.getElementById("loginUsername").value),password=document.getElementById("loginPassword").value;
  if(!username||!password){showLoginError("Enter both username and password.");return}
  const user=data.users.find(x=>same(x.username,username));
  if(!user||user.accessEnabled===false){showLoginError("Access is not active. Contact the school Admin.");return}
  let ok=false;
  if(user.passwordHash)ok=(await sha256Text(password))===user.passwordHash;
  else ok=String(user.password||"")===password;
  if(!ok){showLoginError("Incorrect username or password.");return}
  currentUser=user;sessionStorage.setItem("khalsa_tracker_user",user.username);openApp();
}
