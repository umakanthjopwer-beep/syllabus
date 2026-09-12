// Network/login stability v41: retry transient API failures and show accurate errors.
(function(){
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const authPattern=/session\s*(has\s*)?expired|invalid\s*(session|token)|unauthori[sz]ed|please\s+sign\s+in\s+again/i;
  remoteCall=async function(action,payload={},needsAuth=true){
    const requestToken=needsAuth?(typeof remoteToken==="function"?remoteToken():""):"";
    if(needsAuth&&!requestToken){const e=new Error("Please sign in again.");e.status=401;e.authExpired=true;throw e}
    let last=null;
    for(let attempt=0;attempt<3;attempt++){
      const headers={"Content-Type":"application/json"};if(needsAuth)headers.Authorization=`Bearer ${requestToken}`;
      try{
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
        let r;try{r=await fetch(REMOTE_API,{method:"POST",headers,body:JSON.stringify({action,...payload}),signal:controller.signal})}finally{clearTimeout(timer)}
        let out={};try{out=await r.json()}catch(_){}
        if(!r.ok){const e=new Error(out.error||`Request failed (${r.status})`);e.status=r.status;e.authExpired=needsAuth&&r.status===401&&authPattern.test(String(out.error||"Session expired"));if(e.authExpired&&typeof remoteToken==="function"&&remoteToken()===requestToken)localStorage.removeItem(REMOTE_TOKEN_KEY);throw e}
        return out
      }catch(e){
        if(e?.authExpired||e?.status&&e.status<500)throw e;last=e;if(attempt<2)await delay(500*(attempt+1))
      }
    }
    const e=new Error("Could not reach the school server after 3 attempts. Your internet may still be working; please tap Login again in a few seconds.");e.networkError=true;e.cause=last;throw e
  };
  window.__NETWORK_STABILITY_V41__=true;
})();
