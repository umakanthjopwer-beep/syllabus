// Platform Admin branch onboarding UI.
(function(){
  const BRANCH_API="https://sqgytgudepsgucpkecbl.supabase.co/functions/v1/branch-onboarding";
  let ONBOARDING_WORKBOOK=null,BRANCH_ADMIN_READY=false,LAST_CREDENTIALS=[];

  function h(v){return typeof esc==="function"?esc(String(v??"")):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
  async function branchApi(action,payload={}){
    const token=typeof remoteToken==="function"?remoteToken():localStorage.getItem("khalsa_syllabus_api_token")||"";
    if(!token)throw new Error("Please sign in again.");
    const r=await fetch(BRANCH_API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action,...payload})});let out={};try{out=await r.json()}catch(e){}
    if(!r.ok)throw Object.assign(new Error(out.error||out.errors?.join(" ")||`Request failed (${r.status})`),{details:out});return out
  }

  function openBranchesView(btn){
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
    document.getElementById("branches")?.classList.add("active");btn?.classList.add("active");
    refreshBranchList()
  }

  function ensureBranchAdminView(){
    if(BRANCH_ADMIN_READY)return;const nav=document.getElementById("sideNav"),main=document.querySelector(".main-content");if(!nav||!main)return;
    const btn=document.createElement("button");btn.className="nav-btn";btn.dataset.view="branches";btn.innerHTML="<span>B</span>Branches";btn.onclick=()=>openBranchesView(btn);nav.appendChild(btn);
    const sec=document.createElement("section");sec.id="branches";sec.className="view";sec.innerHTML=`
      <div class="page-head"><div><div class="eyebrow blue-text">PLATFORM ADMIN</div><h2>Branch Onboarding</h2><p>Create a completely isolated school branch from one validated Excel workbook.</p></div><button id="downloadBranchTemplate" class="outline-btn">↓ Download Template</button></div>
      <div class="panel">
        <div class="panel-head"><div><div class="eyebrow">NEW BRANCH</div><h3>Validate onboarding workbook</h3></div><span class="soft-badge">No Khalsa data is copied</span></div>
        <div class="form-grid">
          <label class="full">Completed Onboarding Workbook<input id="branchWorkbookFile" type="file" accept=".xlsx,.xls" /></label>
        </div>
        <div id="branchWorkbookSummary" class="status-text"></div>
        <div class="row-actions"><p id="branchOnboardingStatus" class="status-text"></p><button id="validateBranchWorkbook" class="outline-btn">Validate Workbook</button><button id="activateBranchWorkbook" class="primary" disabled>Activate Branch</button></div>
      </div>
      <div id="branchCredentialsPanel" class="panel hidden">
        <div class="panel-head"><div><div class="eyebrow">LOGIN CREDENTIALS</div><h3>Temporary branch logins</h3></div><button id="downloadBranchCredentials" class="outline-btn">↓ Download Credentials</button></div>
        <p class="muted">Passwords are shown only from this onboarding result. Users must change the temporary password after login.</p>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Temporary Password</th></tr></thead><tbody id="branchCredentialsTable"></tbody></table></div>
      </div>
      <div class="panel"><div class="panel-head"><div><div class="eyebrow">BRANCHES</div><h3>Registered branches</h3></div><button id="refreshBranches" class="outline-btn">Refresh</button></div><div class="table-wrap"><table><thead><tr><th>Branch Code</th><th>Branch</th><th>School</th><th>Location</th><th>Academic Year</th><th>Status</th></tr></thead><tbody id="branchListTable"></tbody></table></div></div>`;
    main.appendChild(sec);BRANCH_ADMIN_READY=true;
    document.getElementById("downloadBranchTemplate").onclick=downloadTemplate;
    document.getElementById("branchWorkbookFile").onchange=loadWorkbook;
    document.getElementById("validateBranchWorkbook").onclick=validateWorkbook;
    document.getElementById("activateBranchWorkbook").onclick=activateWorkbook;
    document.getElementById("refreshBranches").onclick=refreshBranchList;
    document.getElementById("downloadBranchCredentials").onclick=downloadCredentials;
  }

  async function discoverPlatformAdmin(){
    if(BRANCH_ADMIN_READY||!currentUser||currentUser.role!=="Super Admin")return;
    try{const r=await branchApi("status");if(r.platform_admin){ensureBranchAdminView();renderBranchList(r.branches||[])}}catch(e){}
  }

  function templateSheet(headers){return XLSX.utils.aoa_to_sheet([headers])}
  function downloadTemplate(){
    if(!window.XLSX){alert("Excel library is not available. Refresh the app once.");return}
    const wb=XLSX.utils.book_new();
    const instructions=[
      ["Syllabus Tracker - Branch Onboarding Template"],
      ["Complete all required sheets. Do not rename sheet names or column headings."],
      ["Every active teacher receives a Teacher login automatically. HOD rows promote that person's login to HOD. Dean receives Super Admin."],
      ["Branch Code must be unique, for example: KUKATPALLY-CBSE."],
      ["New branch weekly syllabus entry starts CLOSED until that branch Admin opens it."],
      ["Year Plans are uploaded after branch activation from that branch login; Khalsa Year Plans are never copied."]
    ];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(instructions),"Instructions");
    XLSX.utils.book_append_sheet(wb,templateSheet(["Branch Code","Branch Name","School Name","Location","Academic Year","Dean / Branch Super Admin Name","Dean Mobile Number / Login Username"]),"Branch");
    XLSX.utils.book_append_sheet(wb,templateSheet(["Class Display Name","Internal Batch Code","Grade","Orientation / Programme","Floor (optional)","Active"]),"Classes_Sections");
    XLSX.utils.book_append_sheet(wb,templateSheet(["Employee ID / Code (if available)","Teacher Full Name","Designation","Department","Primary Subject","Mobile Number / Login Username","Active"]),"Teachers");
    XLSX.utils.book_append_sheet(wb,templateSheet(["Subject Name","Department","Active for Syllabus Tracking"]),"Subjects");
    XLSX.utils.book_append_sheet(wb,templateSheet(["Class Display Name","Internal Batch Code","Subject","Department","Teacher Full Name","Periods Per Week","Week Pattern","Class Teacher","Co-Class Teacher","Active for Syllabus Tracking"]),"Teaching_Mappings");
    XLSX.utils.book_append_sheet(wb,templateSheet(["HOD Name","Department","Mobile Number / Login Username","Employee ID / Code (if available)"]),"HODs");
    XLSX.writeFile(wb,"Syllabus_Branch_Onboarding_Template.xlsx")
  }

  async function readWorkbook(file){
    if(!window.XLSX)throw new Error("Excel library is not available.");const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:"array"}),out={};
    for(const name of ["Branch","Classes_Sections","Teachers","Subjects","Teaching_Mappings","HODs"]){const ws=wb.Sheets[name];out[name]=ws?XLSX.utils.sheet_to_json(ws,{defval:"",raw:false}):[]}
    return out
  }
  function workbookSummary(w){
    const branch=w?.Branch?.[0]||{};return `<b>${h(branch["Branch Code"]||"Branch not entered")}</b> · ${h(branch["Branch Name"]||"")}<br><small>Sections: ${w.Classes_Sections?.length||0} · Teachers: ${w.Teachers?.length||0} · Subjects: ${w.Subjects?.length||0} · Mappings: ${w.Teaching_Mappings?.length||0} · HODs: ${w.HODs?.length||0}</small>`
  }
  async function loadWorkbook(e){
    ONBOARDING_WORKBOOK=null;document.getElementById("activateBranchWorkbook").disabled=true;const f=e.target.files?.[0],summary=document.getElementById("branchWorkbookSummary"),status=document.getElementById("branchOnboardingStatus");if(!f){summary.innerHTML="";return}
    try{ONBOARDING_WORKBOOK=await readWorkbook(f);summary.innerHTML=workbookSummary(ONBOARDING_WORKBOOK);status.textContent="Workbook loaded. Validate before activation.";status.classList.remove("bad")}
    catch(err){status.textContent=err.message||String(err);status.classList.add("bad")}
  }
  async function validateWorkbook(){
    const btn=document.getElementById("validateBranchWorkbook"),status=document.getElementById("branchOnboardingStatus"),activate=document.getElementById("activateBranchWorkbook");if(!ONBOARDING_WORKBOOK){status.textContent="Select the completed onboarding workbook first.";status.classList.add("bad");return}
    setBusy(btn,true,"Validating…");activate.disabled=true;
    try{const r=await branchApi("validate",{workbook:ONBOARDING_WORKBOOK});status.textContent=`Validated: ${r.summary.sections} sections, ${r.summary.teachers} teachers, ${r.summary.subjects} subjects, ${r.summary.mappings} mappings, ${r.summary.user_logins} logins.${r.warnings?.length?` Warning: ${r.warnings.join(" ")}`:""}`;status.classList.remove("bad");activate.disabled=false}
    catch(e){const d=e.details||{};status.textContent=(d.errors||[e.message]).join(" ");status.classList.add("bad")}
    finally{setBusy(btn,false)}
  }
  async function activateWorkbook(){
    const btn=document.getElementById("activateBranchWorkbook"),status=document.getElementById("branchOnboardingStatus");if(!ONBOARDING_WORKBOOK)return;
    if(!confirm("Activate this new branch? It will receive completely separate users, classes, mappings and login credentials."))return;
    setBusy(btn,true,"Activating…");
    try{const r=await branchApi("create",{workbook:ONBOARDING_WORKBOOK});LAST_CREDENTIALS=r.temporary_passwords||[];status.textContent=`${r.branch.branch_code} activated successfully. Weekly entry starts closed. Download and distribute the temporary credentials securely.`;status.classList.remove("bad");renderCredentials();await refreshBranchList();ONBOARDING_WORKBOOK=null;const file=document.getElementById("branchWorkbookFile");if(file)file.value="";document.getElementById("branchWorkbookSummary").innerHTML="";btn.disabled=true}
    catch(e){status.textContent=e.message||String(e);status.classList.add("bad")}
    finally{setBusy(btn,false)}
  }
  function renderCredentials(){
    const panel=document.getElementById("branchCredentialsPanel"),tbody=document.getElementById("branchCredentialsTable");if(!panel||!tbody)return;panel.classList.toggle("hidden",!LAST_CREDENTIALS.length);tbody.innerHTML=LAST_CREDENTIALS.map(x=>`<tr><td>${h(x.name)}</td><td>${h(x.role)}</td><td>${h(x.username)}</td><td><code>${h(x.temporary_password)}</code></td></tr>`).join("")
  }
  function downloadCredentials(){
    if(!LAST_CREDENTIALS.length)return;const q=v=>`"${String(v??"").replaceAll('"','""')}"`,csv=["Name,Role,Username,Temporary Password",...LAST_CREDENTIALS.map(x=>[x.name,x.role,x.username,x.temporary_password].map(q).join(","))].join("\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${window.multibranchReportFilePrefix?.()||"Syllabus"}_New_Branch_Credentials.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
  }
  function renderBranchList(rows){const tbody=document.getElementById("branchListTable");if(!tbody)return;tbody.innerHTML=rows.length?rows.map(b=>`<tr><td><b>${h(b.branch_code)}</b></td><td>${h(b.branch_name)}</td><td>${h(b.school_name)}</td><td>${h(b.location||"—")}</td><td>${h(b.academic_year)}</td><td><span class="soft-badge">${b.active?"ACTIVE":"INACTIVE"}</span></td></tr>`).join(""):'<tr><td colspan="6">No branches found.</td></tr>'}
  async function refreshBranchList(){try{const r=await branchApi("status");renderBranchList(r.branches||[])}catch(e){}}

  // Chain after the existing remote-data and branch-identity wrappers.
  if(typeof applyRemoteData==="function"){
    const previous=applyRemoteData;applyRemoteData=function(r){const out=previous(r);setTimeout(discoverPlatformAdmin,0);return out}
  }
})();
