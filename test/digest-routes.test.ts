import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, digestJson } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import type { RigConfig } from '../src/config.js';

const base: Omit<RigConfig, 'runsDir'> = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

function writeNight(dir: string, night: string, body: string) {
  writeFileSync(join(dir, `${night}.jsonl`), body);
}

describe('digest routes', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function app() {
    dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    return createApp({ ...base, runsDir: dir });
  }

  it('returns 200 and the same jobs, in the same order, on the page and in JSON', async () => {
    const rig = app();
    writeNight(
      dir,
      '2026-10-28',
      [
        '{"at":"2026-10-28T01:00:00+01:00","job":"b","status":"ok","owner":"rook"}',
        '{"at":"2026-10-28T02:00:00+01:00","job":"a","status":"fail","owner":null,"error":"quota exceeded"}',
        '{"at":"2026-10-28T03:00:00+01:00","job":"c","status":"retry","owner":"rook"}',
        '{"at":"2026-10-28T03:01:00+01:00","job":"c","status":"retry","owner":"rook"}',
        '{"at":"2026-10-28T03:02:00+01:00","job":"c","status":"retry","owner":"rook"}',
      ].join('\n'),
    );

    const page = await rig.request('/digest/2026-10-28');
    const json = await rig.request('/api/digest/2026-10-28');
    const html = await page.text();
    const body = await json.json();
    const read = readNight(dir, '2026-10-28');

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(body).toEqual(digestJson(read));
    expect(body.rows.map((row: { job: string }) => row.job)).toEqual(['a', 'b', 'c']);
    const a = html.indexOf('>a<');
    const b = html.indexOf('>b<');
    const c = html.indexOf('>c<');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(html).toContain('—');
    expect(html).toContain('quota exceeded');
    expect(html).toContain('class="warn"');
  });

  it('returns 404 when the night file is missing', async () => {
    const rig = app();
    expect((await rig.request('/digest/2026-01-01')).status).toBe(404);
    expect((await rig.request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('renders nothing ran for an empty file, and JSON has no rows', async () => {
    const rig = app();
    writeNight(dir, '2026-10-28', '');
    const page = await rig.request('/digest/2026-10-28');
    const json = await rig.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await json.json()).toEqual({ rows: [], badLines: 0 });
  });

  it('still renders a night that contains a bad line', async () => {
    const rig = app();
    writeNight(
      dir,
      '2026-10-28',
      '{"at":"2026-10-28T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\n{"at":"2026-10-28T02:00:00","job":"lane/sy',
    );
    const page = await rig.request('/digest/2026-10-28');
    const json = await rig.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('lane/sync');
    expect(await json.json()).toMatchObject({ badLines: 1, rows: [{ job: 'lane/sync' }] });
  });
});
