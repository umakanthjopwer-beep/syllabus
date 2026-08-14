const TOKEN_KEY='syllabus_api_token';
const CONTEXT_KEY='syllabus_branch_context';

function text(v){return String(v??'').trim()}

export function sanitizeLoginPayload({username,password,branchCode=''}){
  const payload={username:text(username),password:String(password??'')};
  if(text(branchCode)) payload.branch_code=text(branchCode);
  return payload;
}

export function acceptLoginResponse(storage,response){
  if(!response?.token||!response?.user?.id||!response?.branch?.id) throw new Error('Incomplete login response.');
  if(text(response.user.branch_id)!==text(response.branch.id)) throw new Error('Login branch mismatch.');
  storage.setItem(TOKEN_KEY,response.token);
  storage.setItem(CONTEXT_KEY,JSON.stringify({branch:response.branch,user:{id:response.user.id,role:response.user.role,branch_id:response.user.branch_id}}));
  return response.branch;
}

export function token(storage){return storage.getItem(TOKEN_KEY)||''}
export function branchContext(storage){
  try{return JSON.parse(storage.getItem(CONTEXT_KEY)||'null')}catch{return null}
}
export function clearSession(storage){storage.removeItem(TOKEN_KEY);storage.removeItem(CONTEXT_KEY)}

export function apiRequest({action,payload={},storage}){
  const t=token(storage);
  if(!t) throw new Error('Please sign in again.');
  const body={action,...payload};
  delete body.branch_id;
  delete body.requested_branch_id;
  delete body.branch;
  return {headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body};
}
