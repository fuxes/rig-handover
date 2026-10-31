import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'rig-runs-'));

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => [r.job, r.owner, r.runs, r.retries, r.lastStatus])).toEqual([
      ['digest/render', null, 1, 0, 'ok'],
      ['fixtures/refresh', 'rook', 4, 3, 'ok'],
      ['lane/sync', 'rook', 8, 1, 'ok'],
      ['notes/backup', 'lane-07', 1, 0, 'fail'],
      ['rig/rotate-logs', 'lane-07', 1, 0, 'ok'],
    ]);
    const backup = night?.rows.find((r) => r.job === 'notes/backup');
    expect(backup?.lastError).toBe('quota exceeded');
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');
    expect(sync?.lastError).toBeNull();
  });

  it('returns null when the night has no file', () => {
    expect(readNight(tmp(), '2026-01-01')).toBeNull();
  });

  it('empty file: no rows, no bad lines', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'n.jsonl'), '\n\n');
    expect(readNight(dir, 'n')).toEqual({ night: 'n', rows: [], badLines: 0 });
  });

  it('keeps null owners, counts wrong shapes, takes last by time', () => {
    const dir = tmp();
    const lines = [
      { at: '2026-10-29T03:00:00+01:00', job: 'a', status: 'fail', owner: null, error: 'boom' },
      { at: '2026-10-29T01:00:00+01:00', job: 'a', status: 'retry', owner: null },
      { at: '2026-10-29T01:00:00+01:00', job: 'b', status: 'weird', owner: 'x' },
      { at: '2026-10-29T01:00:00+01:00', status: 'ok', owner: 'x' },
    ].map((l) => JSON.stringify(l));
    writeFileSync(join(dir, 'n.jsonl'), [...lines, '[1]', 'null'].join('\n'));
    expect(readNight(dir, 'n')).toEqual({
      night: 'n',
      badLines: 4,
      rows: [
        {
          job: 'a',
          owner: null,
          runs: 2,
          retries: 1,
          lastStatus: 'fail',
          lastError: 'boom',
          firstAt: '2026-10-29T01:00:00+01:00',
          lastAt: '2026-10-29T03:00:00+01:00',
        },
      ],
    });
  });
});
