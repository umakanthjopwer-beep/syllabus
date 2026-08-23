// Session persistence v29: keep valid staff sessions across refresh and prevent stale 401 responses from deleting a newer login token.
(function(){
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const authMessage=/session\s*(has\s*)?expired|invalid\s*(session|token)|unauthori[sz]ed|please\s+sign\s+in\s+again/i;

  // Replace the central API helper with a race-safe version.
  remoteCall=async function(action,payload={},needsAuth=true){
    const headers={"Content-Type":"application/json"};
    const requestToken=needsAuth?remoteToken():"";
    if(needsAuth){
      if(!requestToken){const e=new Error("Please sign in again.");e.status=401;e.authExpired=true;throw e}
      headers.Authorization=`Bearer ${requestToken}`;
    }
    let r;
    try{
      r=await fetch(REMOTE_API,{method:"POST",headers,body:JSON.stringify({action,...payload})});
    }catch(networkError){
      const e=new Error("Unable to connect. Please check the internet connection and try again.");
      e.networkError=true;e.cause=networkError;throw e;
    }
    let out={};try{out=await r.json()}catch(_){}
    if(!r.ok){
      const e=new Error(out.error||`Request failed (${r.status})`);
      e.status=r.status;
      e.authExpired=needsAuth&&r.status===401&&authMessage.test(String(out.error||"Session expired"));
      // Critical: an older request must never delete a newer token created by a fresh login.
      if(e.authExpired&&remoteToken()===requestToken)localStorage.removeItem(REMOTE_TOKEN_KEY);
      throw e;
    }
    return out;
  };

  async function bootstrapWithRetry(attempts=3){
    let last;
    for(let i=0;i<attempts;i++){
      try{return await reloadRemote()}
      catch(e){
        last=e;
        if(e?.authExpired||!remoteToken())throw e;
        if(i<attempts-1)await delay(350*(i+1));
      }
    }
    throw last;
  }

  restoreSession=async function(){
    if(!remoteToken())return;
    try{
      await bootstrapWithRetry(3);
      openApp();
    }catch(e){
      currentUser=null;
      // Keep the token on temporary/network/server errors. Only a confirmed auth failure logs the user out.
      if(e?.authExpired||!remoteToken()){
        localStorage.removeItem(REMOTE_TOKEN_KEY);
        try{showLoginError("Your session has expired. Please sign in again.")}catch(_){}
        return;
      }
      try{showLoginError("Could not reconnect to the server. Your login is still saved; refresh once when the connection is stable.")}catch(_){}
    }
  };

  login=async function(){
    const username=norm($("#loginUsername").value),password=$("#loginPassword").value,btn=$("#loginBtn");
    if(!username||!password){showLoginError("Enter both username and password.");return}
    setBusy(btn,true,"Signing in…");
    try{
      const r=await remoteCall("login",{username,password},false);
      if(!r?.token)throw new Error("Login succeeded but no session token was returned.");
      localStorage.setItem(REMOTE_TOKEN_KEY,r.token);
      await bootstrapWithRetry(3);
      $("#loginPassword").value="";
      try{$("#loginError")?.classList.add("hidden")}catch(_){}
      openApp();
    }catch(e){
      // Do not destroy a freshly-issued token for a temporary bootstrap/network failure.
      if(e?.authExpired)localStorage.removeItem(REMOTE_TOKEN_KEY);
      showLoginError(e.message||"Unable to sign in.");
    }finally{setBusy(btn,false)}
  };

  // Do not let browser refresh/pagehide behave like logout. Logout remains explicit via the existing Logout buttons.
  window.__SESSION_PERSISTENCE_V29__=true;
})();
