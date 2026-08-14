export function normalizeBranchId(value) {
  const id = String(value ?? '').trim();
  if (!id) throw new Error('Branch context is required.');
  return id;
}

export function scopeRows(rows, branchId) {
  const id = normalizeBranchId(branchId);
  return (rows || []).filter(row => String(row?.branch_id ?? '') === id);
}

export function stampBranch(values, branchId) {
  const id = normalizeBranchId(branchId);
  const incoming = values?.branch_id == null ? '' : String(values.branch_id);
  if (incoming && incoming !== id) throw new Error('Cross-branch write blocked.');
  return { ...(values || {}), branch_id: id };
}

export function assertSameBranch(record, branchId) {
  const id = normalizeBranchId(branchId);
  if (!record || String(record.branch_id ?? '') !== id) {
    throw new Error('Cross-branch access blocked.');
  }
  return record;
}

export function findScopedById(rows, id, branchId) {
  const record = (rows || []).find(row => String(row?.id ?? '') === String(id));
  if (!record) return null;
  return assertSameBranch(record, branchId);
}

export function updateScopedById(rows, id, patch, branchId) {
  const branch = normalizeBranchId(branchId);
  const current = findScopedById(rows, id, branch);
  if (!current) throw new Error('Record not found.');
  const next = stampBranch({ ...current, ...(patch || {}) }, branch);
  return (rows || []).map(row => String(row?.id ?? '') === String(id) ? next : row);
}

export function joinScoped({ leftRows, rightRows, leftKey, rightKey, branchId }) {
  const branch = normalizeBranchId(branchId);
  const left = scopeRows(leftRows, branch);
  const right = scopeRows(rightRows, branch);
  const byKey = new Map(right.map(row => [String(row?.[rightKey] ?? ''), row]));
  return left.map(row => ({ left: row, right: byKey.get(String(row?.[leftKey] ?? '')) || null }));
}

export function validateRecordGraph({ record, related = [], branchId }) {
  const branch = normalizeBranchId(branchId);
  assertSameBranch(record, branch);
  for (const item of related) assertSameBranch(item, branch);
  return true;
}
