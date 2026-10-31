import type { Night, RunStatus } from './types.js';

// Jobs per last status; null when the night could not be read (view renders '—').
export function countJobs(night: Night | null): Record<RunStatus, number> | null {
  if (!night) return null;
  const c = { ok: 0, retry: 0, fail: 0 };
  for (const r of night.rows) c[r.lastStatus]++;
  return c;
}
