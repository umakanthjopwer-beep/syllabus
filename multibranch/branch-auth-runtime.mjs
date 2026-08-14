function text(v){return String(v??'').trim()}
function key(v){return text(v).toLowerCase()}

export function publicBranch(branch){
  if(!branch) return null;
  return {
    id:text(branch.id),
    code:text(branch.branch_code||branch.code),
    name:text(branch.branch_name||branch.name),
    schoolName:text(branch.school_name||branch.schoolName),
    location:text(branch.location),
    academicYear:text(branch.academic_year||branch.academicYear)
  };
}

export function publicUser(user){
  if(!user) return null;
  return {
    id:text(user.id),
    teacher_id:user.teacher_id??null,
    name:text(user.name),
    username:text(user.username),
    role:text(user.role),
    primary_department:text(user.primary_department),
    branch_id:text(user.branch_id),
    access_enabled:user.access_enabled!==false,
    must_change_password:!!user.must_change_password
  };
}

export function resolveLoginUser({users,branches,username,branchCode=''}){
  const uname=key(username), code=key(branchCode);
  if(!uname) throw new Error('Username is required.');
  let candidates=(users||[]).filter(u=>key(u.username)===uname && u.access_enabled!==false);
  if(code){
    const branch=(branches||[]).find(b=>key(b.branch_code)===code && b.active!==false);
    if(!branch) throw new Error('Branch code was not found or is inactive.');
    candidates=candidates.filter(u=>text(u.branch_id)===text(branch.id));
  }
  if(candidates.length===0) return null;
  if(candidates.length>1 && !code) throw new Error('This username exists in more than one branch. Enter the branch code.');
  if(candidates.length>1) throw new Error('Duplicate username exists inside the selected branch.');
  const user=candidates[0];
  const branch=(branches||[]).find(b=>text(b.id)===text(user.branch_id));
  if(!branch||branch.active===false) throw new Error('The user branch is inactive.');
  return {user,branch};
}

export function createSessionRecord({user,tokenHash,expiresAt}){
  if(!user?.id||!user?.branch_id) throw new Error('User branch is required before creating a session.');
  return {user_id:text(user.id),branch_id:text(user.branch_id),token_hash:text(tokenHash),expires_at:expiresAt};
}

export function authenticateSession({sessions,users,branches,tokenHash,now=new Date()}){
  const session=(sessions||[]).find(s=>text(s.token_hash)===text(tokenHash));
  if(!session) return null;
  if(new Date(session.expires_at).getTime()<=now.getTime()) return null;
  const user=(users||[]).find(u=>text(u.id)===text(session.user_id) && u.access_enabled!==false);
  if(!user) return null;
  if(text(session.branch_id)!==text(user.branch_id)) throw new Error('Session branch mismatch.');
  const branch=(branches||[]).find(b=>text(b.id)===text(user.branch_id) && b.active!==false);
  if(!branch) return null;
  return {session,user,branch};
}

export function loginResponse({token,user,branch}){
  if(text(user?.branch_id)!==text(branch?.id)) throw new Error('User/branch mismatch.');
  return {token, user:publicUser(user), branch:publicBranch(branch)};
}
