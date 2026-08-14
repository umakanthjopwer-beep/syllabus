export function normalizeId(value, label='id') {
  const id=String(value??'').trim();
  if(!id) throw new Error(`${label} is required.`);
  return id;
}

export function branchFromSession(session,user){
  if(!session||!user)throw new Error('Authenticated session is required.');
  if(String(session.user_id??'')!==String(user.id??''))throw new Error('Session user mismatch.');
  const branch=normalizeId(user.branch_id,'User branch');
  if(session.branch_id!=null && String(session.branch_id)!==branch)throw new Error('Session branch mismatch.');
  return branch;
}

export function authorizeRequest({session,user,requestedBranchId=null}){
  const branch=branchFromSession(session,user);
  if(requestedBranchId!=null && String(requestedBranchId)!==branch){
    throw new Error('Cross-branch request blocked.');
  }
  return branch;
}

export function serverScopedFilters({session,user,filters={}}){
  const branch=authorizeRequest({session,user,requestedBranchId:filters.branch_id});
  const safe={...(filters||{})};
  delete safe.branch_id;
  return {...safe,branch_id:branch};
}

export function serverStampedPayload({session,user,payload={}}){
  const branch=authorizeRequest({session,user,requestedBranchId:payload.branch_id});
  const safe={...(payload||{})};
  delete safe.branch_id;
  return {...safe,branch_id:branch};
}

export function authorizeRecord({session,user,record}){
  const branch=authorizeRequest({session,user});
  if(!record||String(record.branch_id??'')!==branch)throw new Error('Cross-branch record access blocked.');
  return record;
}
