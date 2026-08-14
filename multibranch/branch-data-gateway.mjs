function text(v){return String(v??'').trim()}

export function requireAuthContext(ctx){
  const branchId=text(ctx?.user?.branch_id);
  if(!ctx?.user?.id||!branchId||text(ctx?.branch?.id)!==branchId) throw new Error('Valid branch-authenticated context is required.');
  return {user:ctx.user,branch:ctx.branch,branchId};
}

export function scopedRows(ctx,rows){
  const {branchId}=requireAuthContext(ctx);
  return (rows||[]).filter(r=>text(r?.branch_id)===branchId);
}

export function scopedFind(ctx,rows,id){
  const row=(rows||[]).find(r=>text(r?.id)===text(id));
  if(!row) return null;
  const {branchId}=requireAuthContext(ctx);
  if(text(row.branch_id)!==branchId) throw new Error('Cross-branch record access blocked.');
  return row;
}

export function stampForWrite(ctx,payload={}){
  const {branchId}=requireAuthContext(ctx);
  const incoming=text(payload.branch_id);
  if(incoming && incoming!==branchId) throw new Error('Cross-branch write blocked.');
  const next={...payload,branch_id:branchId};
  delete next.requested_branch_id;
  return next;
}

export function assertRelated(ctx,...records){
  const {branchId}=requireAuthContext(ctx);
  for(const r of records.flat().filter(Boolean)) if(text(r.branch_id)!==branchId) throw new Error('Cross-branch relationship blocked.');
  return true;
}

export function adminRows(ctx,rows){
  const {user}=requireAuthContext(ctx);
  if(!['Super Admin','Principal','Admin'].includes(user.role)) throw new Error('Admin access required.');
  return scopedRows(ctx,rows);
}

export function bootstrapBundle(ctx,datasets){
  requireAuthContext(ctx);
  const out={branch:ctx.branch,user:ctx.user};
  for(const [name,rows] of Object.entries(datasets||{})) out[name]=scopedRows(ctx,rows);
  return out;
}
