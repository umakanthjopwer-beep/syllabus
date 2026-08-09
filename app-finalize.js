let editingUserId=null;

function injectFinalize(){
  if(!document.getElementById("passwordChangeDialog")){
    document.body.insertAdjacentHTML("beforeend",`
      <dialog id="passwordChangeDialog" class="app-dialog"><form id="passwordChangeForm" class="dialog-card">
        <div class="dialog-head"><div><div class="eyebrow">SECURITY</div><h3>Create your private password</h3></div></div>
        <p class="small-muted">This is your first login. Replace the temporary password before continuing.</p>
        <div class="form-grid">
          <label>New password<input id="newPrivatePassword" type="password" minlength="8" required></label>
          <label>Confirm password<input id="confirmPrivatePassword" type="password" minlength="8" required></label>
        </div>
        <div id="passwordChangeError" class="login-error hidden"></div>
        <div class="row-actions"><span></span><button class="primary" type="submit">Save password</button></div>
      </form></dialog>
      <dialog id="userEditDialog" class="app-dialog"><form id="userEditForm" class="dialog-card">
        <div class="dialog-head"><div><div class="eyebrow">EDIT USER</div><h3>Role & assigned scope</h3></div><button type="button" id="closeUserEditBtn" class="icon-close">×</button></div>
        <div class="form-grid">
          <label>Name<input id="editUserName" required></label>
          <label>Username<input id="editUsername" required></label>
          <label>Role<select id="editUserRole"><option>Super Admin</option><option>Principal</option><option>Admin</option><option>HOD</option><option>Teacher</option></select></label>
          <label>Primary Department<select id="editUserDepartment"></select></label>
        </div>
        <div class="scope-block"><div class="scope-title"><strong>Departments</strong></div><div id="editUserDepartments" class="choice-grid three"></div></div>
        <div class="scope-block"><div class="scope-title"><strong>Classes & Sections</strong><button type="button" id="editUserUseHandling" class="mini-btn">Use Handling Classes</button></div><div id="editUserSections" class="choice-grid four"></div></div>
        <div class="scope-block"><div class="scope-title"><strong>Subjects</strong></div><div id="editUserSubjects" class="choice-grid four"></div></div>
        <p class="small-muted">Changing login scope does not change the Teaching / Handling master. Use Handling Classes to restore the imported teacher assignments.</p>
        <div class="row-actions"><span id="userEditStatus" class="status-text"></span><button class="primary" type="submit">Save user</button></div>
      </form></dialog>`);
    fillSelect(document.getElementById("editUserDepartment"),DEPARTMENT_ORDER,DEPARTMENT_ORDER[0]);
    document.getElementById("passwordChangeForm").onsubmit=savePrivatePassword;
    document.getElementById("closeUserEditBtn").onclick=()=>document.getElementById("userEditDialog").close();
    document.getElementById("userEditForm").onsubmit=saveUserEdit;
    document.getElementById("editUserUseHandling").onclick=useHandlingForEditedUser;
  }
  if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{})}
}

function openApp(){
  document.getElementById("loginError").classList.add("hidden");
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  document.getElementById("profileName").textContent=currentUser.name;
  document.getElementById("profileRole").textContent=currentUser.role;
  applyRoleAccess();renderAll();
  if(currentUser.mustChangePassword) setTimeout(()=>document.getElementById("passwordChangeDialog").showModal(),50);
}
function savePrivatePassword(e){
  e.preventDefault();
  const a=document.getElementById("newPrivatePassword").value,b=document.getElementById("confirmPrivatePassword").value,err=document.getElementById("passwordChangeError");
  if(a.length<8||a!==b){err.textContent=a!==b?"Passwords do not match.":"Password must contain at least 8 characters.";err.classList.remove("hidden");return}
  const u=data.users.find(x=>x.id===currentUser.id);if(!u)return;
  u.password=a;u.mustChangePassword=false;currentUser=u;persist();err.classList.add("hidden");document.getElementById("passwordChangeForm").reset();document.getElementById("passwordChangeDialog").close();
}

function addUser(e){
  e.preventDefault();if(!isAdmin())return;
  const name=norm(document.getElementById("newUserName").value),username=norm(document.getElementById("newUsername").value),role=document.getElementById("newUserRole").value,department=document.getElementById("newUserDepartment").value;
  if(!name||!username)return;if(data.users.some(x=>same(x.username,username))){alert("Username already exists.");return}
  const maps=teacherMappingsFor(name),password=tempPassword(),selected=data.uiScope||{};
  let departments=selected.departments?.length?[...selected.departments]:[...new Set(maps.map(m=>m.department).filter(Boolean))];
  let sections=selected.sections?.length?[...selected.sections]:[...new Set(maps.map(m=>m.section))];
  let subjects=selected.subjects?.length?[...selected.subjects]:[...new Set(maps.map(m=>m.subject))];
  if(role==="HOD"){departments=selected.departments?.length?[...selected.departments]:[department];const deptSet=new Set(departments);const dm=data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&deptSet.has(m.department));sections=selected.sections?.length?[...selected.sections]:[...new Set(dm.map(m=>m.section))];subjects=selected.subjects?.length?[...selected.subjects]:[...new Set(dm.map(m=>m.subject))]}
  if(ADMIN_ROLES.has(role)){departments=[...DEPARTMENT_ORDER];sections=SECTIONS.map(x=>x.section);subjects=[...ALL_SUBJECTS]}
  data.users.push({id:uid(),name,username,password,role,department,departments,sections,subjects,accessEnabled:true,mustChangePassword:true});
  persist();document.getElementById("userForm").reset();document.getElementById("userDialog").close();data.uiScope={departments:[],sections:[],subjects:[]};renderUsers();
  alert(`User created.\nUsername: ${username}\nTemporary password: ${password}\nUse Share to send login details.`)
}

function renderUsers(){
  if(!isAdmin())return;
  const counts={};Object.keys(ROLE_META).forEach(r=>counts[r]=data.users.filter(u=>u.role===r).length);
  document.getElementById("roleCards").innerHTML=Object.entries(ROLE_META).map(([role,m])=>`<article class="role-card ${role==="Teacher"?"teacher":""}"><div class="role-top"><div class="role-icon ${role==="Teacher"?"green":""}">${m.code}</div><div><h3>${role}</h3><p>${m.description}</p></div></div><span class="role-count">${counts[role]||0} users</span></article>`).join("");
  renderScope();
  document.getElementById("userList").innerHTML=data.users.map(u=>`<div class="user-row"><div class="initial">${esc(initials(u.name))}</div><div><strong>${esc(u.name)} · ${esc(u.role)}</strong><small>@${esc(u.username)}${u.department?" · "+esc(u.department):""} · ${u.accessEnabled===false?"Access disabled":"Access active"}${u.mustChangePassword?" · Temporary password":""}</small></div><div class="plan-actions"><button onclick="shareUser('${u.id}')">Share</button><button onclick="editUser('${u.id}')">Edit</button><button onclick="resetUserPassword('${u.id}')">Reset Password</button>${u.id==="u-super"?'<span class="soft-badge">Protected</span>':`<button onclick="toggleUser('${u.id}')">${u.accessEnabled===false?"Enable":"Disable"}</button><button class="danger" onclick="deleteUser('${u.id}')">Delete</button>`}</div></div>`).join("")
}
window.editUser=id=>{
  if(!isAdmin())return;const u=data.users.find(x=>x.id===id);if(!u)return;editingUserId=id;
  document.getElementById("editUserName").value=u.name||"";document.getElementById("editUsername").value=u.username||"";document.getElementById("editUserRole").value=u.role||"Teacher";document.getElementById("editUserDepartment").value=u.department||DEPARTMENT_ORDER[0];
  renderUserEditChoices(u);document.getElementById("userEditStatus").textContent="";document.getElementById("userEditDialog").showModal()
};
function renderUserEditChoices(u){
  const deps=new Set(u.departments||[]),secs=new Set(u.sections||[]),subs=new Set((u.subjects||[]).map(canonicalSubject));
  document.getElementById("editUserDepartments").innerHTML=DEPARTMENT_ORDER.map(d=>editChoice("eu-dept",d,DEPARTMENTS[d].join(" · "),deps.has(d))).join("");
  document.getElementById("editUserSections").innerHTML=SECTIONS.map(s=>editChoice("eu-sec",s.section,`${s.batch} · ${s.program}`,secs.has(s.section))).join("");
  document.getElementById("editUserSubjects").innerHTML=ALL_SUBJECTS.map(s=>editChoice("eu-sub",s,departmentForSubject(s),subs.has(s))).join("");
  document.querySelectorAll("#userEditDialog .choice-card input").forEach(i=>i.onchange=()=>i.closest(".choice-card").classList.toggle("selected",i.checked));
}
function editChoice(cls,value,sub,checked){return`<label class="choice-card ${checked?"selected":""}"><input class="${cls}" type="checkbox" value="${esc(value)}" ${checked?"checked":""}><div><strong>${esc(value)}</strong><small>${esc(sub)}</small></div></label>`}
function useHandlingForEditedUser(){
  const u=data.users.find(x=>x.id===editingUserId);if(!u)return;const maps=teacherMappingsFor(document.getElementById("editUserName").value||u.name);
  const draft={departments:[...new Set(maps.map(m=>m.department).filter(Boolean))],sections:[...new Set(maps.map(m=>m.section))],subjects:[...new Set(maps.map(m=>m.subject))]};
  if(document.getElementById("editUserRole").value==="HOD"){const d=document.getElementById("editUserDepartment").value,dm=data.setup.handlingMappings.filter(m=>m.activeForSyllabus&&m.department===d);draft.departments=[d];draft.sections=[...new Set(dm.map(m=>m.section))];draft.subjects=[...new Set(dm.map(m=>m.subject))]}
  renderUserEditChoices({...u,...draft})
}
function saveUserEdit(e){
  e.preventDefault();if(!isAdmin())return;const u=data.users.find(x=>x.id===editingUserId);if(!u)return;
  const username=norm(document.getElementById("editUsername").value);if(data.users.some(x=>x.id!==u.id&&same(x.username,username))){setStatus("#userEditStatus","Username already exists.",true);return}
  u.name=norm(document.getElementById("editUserName").value);u.username=username;u.role=document.getElementById("editUserRole").value;u.department=document.getElementById("editUserDepartment").value;
  u.departments=[...document.querySelectorAll(".eu-dept:checked")].map(i=>i.value);u.sections=[...document.querySelectorAll(".eu-sec:checked")].map(i=>i.value);u.subjects=[...document.querySelectorAll(".eu-sub:checked")].map(i=>i.value);
  if(ADMIN_ROLES.has(u.role)){u.departments=[...DEPARTMENT_ORDER];u.sections=SECTIONS.map(x=>x.section);u.subjects=[...ALL_SUBJECTS]}
  if(u.role==="HOD"&&!u.departments.length)u.departments=[u.department];persist();editingUserId=null;document.getElementById("userEditDialog").close();renderUsers()
}
window.resetUserPassword=id=>{
  if(!isAdmin())return;const u=data.users.find(x=>x.id===id);if(!u)return;const p=tempPassword();u.password=p;u.mustChangePassword=true;u.accessEnabled=true;persist();renderUsers();alert(`Password reset.\nUsername: ${u.username}\nTemporary password: ${p}\nUse Share to send the new details.`)
};

const _trackerInit=init;
init=function(){injectFinalize();_trackerInit()};
