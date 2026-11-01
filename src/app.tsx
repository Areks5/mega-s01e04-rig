import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { NightNotFound, readNight } from './digest/read.js';
import type { NightRead } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function loadNight(config: RigConfig, night: string): NightRead | null {
  if (!NIGHT.test(night)) return null;
  try {
    return readNight(config.runsDir, night);
  } catch (error) {
    if (error instanceof NightNotFound) return null;
    throw error;
  }
}

export function digestJson(read: NightRead) {
  return { rows: read.rows, badLines: read.badLines };
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} runsDir={config.runsDir} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const read = loadNight(config, c.req.param('night'));
    if (!read) return c.text('not found', 404);
    return c.html(
      <Layout title={`digest ${c.req.param('night')}`} lane={lane()}>
        <DigestPage night={c.req.param('night')} read={read} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const read = loadNight(config, c.req.param('night'));
    if (!read) return c.json({ error: 'not found' }, 404);
    return c.json(digestJson(read));
  });

  return app;
}
