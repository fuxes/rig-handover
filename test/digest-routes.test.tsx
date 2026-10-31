import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

// Temp dir only: runs/ is read-only.
function runsWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const line = (at: string, job: string, status: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

const good = [
  line('2026-10-29T23:00:06+01:00', 'lane/sync', 'ok'),
  line('2026-10-29T23:00:02+01:00', 'rig/rotate-logs', 'ok', 'lane-07'),
  line('2026-10-30T01:00:00+01:00', 'notes/backup', 'fail', null),
  line('2026-10-30T02:00:00+01:00', 'lane/sync', 'retry'),
].join('\n');

// Job names in the order the page lists them (first cell of each body row).
const pageJobs = (html: string) => [...html.matchAll(/<tr[^>]*>\s*<td>([^<]+)<\/td>/g)].map((m) => m[1]);

const routes = [
  { name: 'page', json: false, path: (night: string) => `/digest/${night}` },
  { name: 'json', json: true, path: (night: string) => `/api/digest/${night}` },
] as const;

describe.each(routes)('$name route', ({ json, path }) => {
  it('200 for a normal night', async () => {
    const app = createApp({ ...base, runsDir: runsWith({ '2026-10-29.jsonl': good }) });
    const res = await app.request(path('2026-10-29'));
    expect(res.status).toBe(200);
  });

  it('404 for a night with no file', async () => {
    const app = createApp({ ...base, runsDir: runsWith({}) });
    const res = await app.request(path('2026-01-01'));
    expect(res.status).toBe(404);
  });

  it('empty night: nothing ran, no rows', async () => {
    const app = createApp({ ...base, runsDir: runsWith({ '2026-10-29.jsonl': '\n\n' }) });
    const res = await app.request(path('2026-10-29'));
    if (json) {
      expect(await res.json()).toMatchObject({ rows: [] });
    } else {
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('nothing ran');
    }
  });

  it('bad line: still 200, counted, good rows still shown', async () => {
    const app = createApp({ ...base, runsDir: runsWith({ '2026-10-29.jsonl': `${good}\n{not json` }) });
    const res = await app.request(path('2026-10-29'));
    expect(res.status).toBe(200);
    if (json) {
      const body = (await res.json()) as { badLines: number; rows: { job: string }[] };
      expect(body.badLines).toBe(1);
      expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup', 'rig/rotate-logs']);
    } else {
      const html = await res.text();
      expect(html).toContain('1 line(s) did not parse');
      expect(pageJobs(html)).toEqual(['lane/sync', 'notes/backup', 'rig/rotate-logs']);
    }
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const app = createApp({ ...base, runsDir: runsWith({ '2026-10-29.jsonl': `${good}\n{not json` }) });
    const html = await (await app.request('/digest/2026-10-29')).text();
    const json = (await (await app.request('/api/digest/2026-10-29')).json()) as { rows: { job: string }[] };
    expect(pageJobs(html)).toEqual(json.rows.map((r) => r.job));
    expect(pageJobs(html)).toHaveLength(3);
  });
});
