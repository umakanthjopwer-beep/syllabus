(function(){
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  // Keep a valid login across refreshes. The API session already lives for 14 days;
  // only clear it when the server explicitly reports an authentication/session failure.
  restoreSession=async function(){
    const token=remoteToken();
    if(!token)return;

    const loginScreen=document.getElementById("loginScreen");
    const card=loginScreen?.querySelector(".login-card");
    const restoreBox=document.createElement("div");
    restoreBox.id="sessionRestoreBox";
    restoreBox.style.cssText="max-width:420px;margin:18vh auto 0;padding:24px;text-align:center;font-family:Arial,sans-serif;color:#173f78";
    restoreBox.innerHTML="<strong style=\"font-size:18px\">Restoring your session…</strong><div style=\"margin-top:8px;font-size:13px;color:#74839a\">Please wait a moment.</div>";
    if(loginScreen){
      if(card)card.style.display="none";
      loginScreen.appendChild(restoreBox);
    }

    let lastError=null;
    const delays=[0,500,1400];
    for(const delay of delays){
      if(delay)await wait(delay);
      try{
        await reloadRemote();
        restoreBox.remove();
        if(card)card.style.display="";
        openApp();
        return;
      }catch(err){
        lastError=err;
        const msg=String(err?.message||"");
        if(/session expired|session.*invalid|please sign in again|unauthori[sz]ed/i.test(msg))break;
      }
    }

    restoreBox.remove();
    if(card)card.style.display="";
    const msg=String(lastError?.message||"");
    const authFailure=/session expired|session.*invalid|please sign in again|unauthori[sz]ed/i.test(msg);
    if(authFailure){
      localStorage.removeItem(REMOTE_TOKEN_KEY);
      currentUser=null;
      showLoginError("Your session has expired. Please sign in again.");
    }else{
      // Preserve the valid token on temporary network/bootstrap errors.
      showLoginError("Could not restore the saved session just now. Refresh once to retry; your login is still saved.");
    }
  };

  // The report renderer rebuilds its select options. Preserve the user's new
  // selection in REPORT_STATE before re-rendering so the dropdown does not jump back.
  const baseRenderReports=renderReports;
  function bindReportDropdownFixes(){
    const week=document.getElementById("printReportWeek");
    const subject=document.getElementById("printReportSubject");
    const status=document.getElementById("printReportStatus");

    if(week){
      week.onchange=()=>{
        const op=week.selectedOptions?.[0];
        REPORT_STATE.weekStart=op?.dataset.start||"";
        REPORT_STATE.weekEnd=op?.dataset.end||"";
        REPORT_STATE.weekLabel=op?.value||"";
        renderReports();
      };
    }
    if(subject){
      subject.onchange=()=>{
        REPORT_STATE.subject=subject.value||REPORT_ALL_SUBJECTS;
        renderReports();
      };
    }
    if(status){
      status.onchange=()=>{
        REPORT_STATE.status=status.value||REPORT_ALL_STATUSES;
        renderReports();
      };
    }
  }

  renderReports=function(){
    baseRenderReports();
    bindReportDropdownFixes();
  };
})();
