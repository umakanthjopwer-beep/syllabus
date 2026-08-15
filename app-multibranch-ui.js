// Multi-branch compatibility layer.
// Keeps existing Khalsa login behaviour while adding optional Branch Code and authenticated branch identity.
(function(){
  const BRANCH_CODE_KEY="syllabus_branch_code";
  window.CURRENT_SYLLABUS_BRANCH=window.CURRENT_SYLLABUS_BRANCH||null;

  function txt(v){return String(v??"").trim()}
  function branch(){return window.CURRENT_SYLLABUS_BRANCH||null}
  function schoolName(){return txt(branch()?.school_name)||"Sri Chaitanya School"}
  function branchName(){return txt(branch()?.branch_name)||txt(branch()?.branch_code)||"Syllabus Tracker"}
  function branchCode(){return txt(branch()?.branch_code)||txt(localStorage.getItem(BRANCH_CODE_KEY))}
  function academicYear(){return txt(branch()?.academic_year)||"2026-27"}
  function locationName(){return txt(branch()?.location)}
  function safeFilePart(v){return txt(v).replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"")||"Branch"}

  window.multibranchReportTitle=function(){return `${schoolName()}: ${branchName()}`};
  window.multibranchReportFilePrefix=function(){return safeFilePart(branchCode()||branchName())};

  function ensureBranchCodeInput(){
    const screen=document.getElementById("loginScreen"),user=document.getElementById("loginUsername");
    if(!screen||!user||document.getElementById("loginBranchCode"))return;
    const label=document.createElement("label");
    label.id="loginBranchCodeLabel";
    label.textContent="Branch Code";
    const input=document.createElement("input");
    input.id="loginBranchCode";
    input.setAttribute("autocomplete","organization");
    input.setAttribute("autocapitalize","characters");
    input.setAttribute("spellcheck","false");
    input.placeholder="Branch Code (optional if username is unique)";
    input.value=txt(localStorage.getItem(BRANCH_CODE_KEY));
    label.appendChild(input);
    const userLabel=user.closest("label");
    userLabel?.parentNode?.insertBefore(label,userLabel);

    const brand=screen.querySelector(".login-brand");
    const h1=brand?.querySelector("h1"),p=brand?.querySelector("p");
    if(h1)h1.textContent="Syllabus Tracker";
    if(p)p.textContent="Branch Academic Workspace";
    document.title="Syllabus Tracker | Staff Login";
  }

  function applyBranchIdentity(b){
    if(!b?.id)return;
    window.CURRENT_SYLLABUS_BRANCH=b;
    if(b.branch_code)localStorage.setItem(BRANCH_CODE_KEY,b.branch_code);
    try{if(typeof data!=="undefined")data.branch=b}catch(e){}

    const side=document.querySelector(".side-brand strong");if(side)side.textContent=branchName();
    const schoolEyebrow=document.querySelector(".school-title .eyebrow");if(schoolEyebrow)schoolEyebrow.textContent=schoolName().toUpperCase();
    const schoolLine=document.querySelector(".school-title strong");if(schoolLine)schoolLine.textContent=[branchName(),locationName()].filter(Boolean).join(" · ");
    const workspace=document.querySelector(".workspace-box small");if(workspace)workspace.textContent=`Saved centrally · ${academicYear()}`;
    const dashYear=document.querySelector("#dashboard .page-head .eyebrow");if(dashYear)dashYear.textContent=`ACADEMIC YEAR ${academicYear()}`;
    document.title=`${branchName()} | Syllabus Tracker`;
  }
  window.applySyllabusBranchIdentity=applyBranchIdentity;

  // Bootstrap response is the source of truth for visible branch identity.
  if(typeof applyRemoteData==="function"){
    const originalApplyRemoteData=applyRemoteData;
    applyRemoteData=function(r){
      const out=originalApplyRemoteData(r);
      if(r?.branch)applyBranchIdentity(r.branch);
      return out
    }
  }

  // Backward compatible login: existing Khalsa users can leave Branch Code blank while usernames remain unique.
  if(typeof login==="function"){
    login=async function(){
      const username=norm($("#loginUsername").value),password=$("#loginPassword").value,branch_code=txt(document.getElementById("loginBranchCode")?.value),btn=$("#loginBtn");
      if(!username||!password){showLoginError("Enter both username and password.");return}
      setBusy(btn,true,"Signing in…");
      try{
        const r=await remoteCall("login",{username,password,branch_code},false);
        localStorage.setItem(REMOTE_TOKEN_KEY,r.token);
        if(r?.branch?.branch_code)localStorage.setItem(BRANCH_CODE_KEY,r.branch.branch_code);
        if(r?.branch)applyBranchIdentity(r.branch);
        await reloadRemote();
        $("#loginPassword").value="";
        openApp()
      }catch(e){showLoginError(e.message||"Unable to sign in.")}
      finally{setBusy(btn,false)}
    }
  }

  // Final HTML report title follows the authenticated branch without rewriting the report engine.
  if(typeof reportSheetHtml==="function"){
    const originalReportSheetHtml=reportSheetHtml;
    reportSheetHtml=function(rows){
      const html=originalReportSheetHtml(rows);
      const title=typeof reportEsc==="function"?reportEsc(window.multibranchReportTitle()):window.multibranchReportTitle();
      return String(html).replaceAll("Sri Chaitanya School: Khalsa CBSE Branch",title)
    }
  }

  // Patch the styled Excel engine after it loads so both workbook title and filename are branch-aware.
  if(typeof ensureStyledExcelEngine==="function"){
    const originalEnsureStyledExcelEngine=ensureStyledExcelEngine;
    ensureStyledExcelEngine=async function(){
      const XL=await originalEnsureStyledExcelEngine();
      if(!XL.__multiBranchIdentityPatched){
        const originalAoa=XL.utils.aoa_to_sheet.bind(XL.utils);
        XL.utils.aoa_to_sheet=function(rows,...args){
          let next=rows;
          if(Array.isArray(rows)&&Array.isArray(rows[0])&&rows[0][0]==="Sri Chaitanya School: Khalsa CBSE Branch"){
            next=rows.map((r,i)=>i===0?[...r]:r);
            next[0][0]=window.multibranchReportTitle()
          }
          return originalAoa(next,...args)
        };
        const originalWrite=XL.writeFile.bind(XL);
        XL.writeFile=function(wb,fileName,...args){
          let name=String(fileName||"");
          if(name.startsWith("Khalsa_Weekly_Syllabus_"))name=name.replace(/^Khalsa_/,`${window.multibranchReportFilePrefix()}_`);
          return originalWrite(wb,name,...args)
        };
        XL.__multiBranchIdentityPatched=true
      }
      return XL
    }
  }

  ensureBranchCodeInput();
})();
