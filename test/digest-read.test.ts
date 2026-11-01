import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    const render = night.rows.find((row) => row.job === 'digest/render');
    expect(render).toMatchObject({ owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null });

    const refresh = night.rows.find((row) => row.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null, owner: 'rook' });

    const sync = night.rows.find((row) => row.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: null });

    const backup = night.rows.find((row) => row.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
  });
});
