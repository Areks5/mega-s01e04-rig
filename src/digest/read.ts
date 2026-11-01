import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, NightRead, ReadNight, StatusCounts } from './types.js';

export class NightNotFound extends Error {
  constructor(night: string) {
    super(`no night ${night}`);
    this.name = 'NightNotFound';
  }
}

const STATUSES: readonly JobStatus[] = ['ok', 'retry', 'fail'];

type RawLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

function parseLine(line: string): RawLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== 'string' || typeof row.job !== 'string' || !isJobStatus(row.status)) return null;
  if (row.owner !== null && row.owner !== undefined && typeof row.owner !== 'string') return null;
  if (row.error !== undefined && row.error !== null && typeof row.error !== 'string') return null;
  return {
    at: row.at,
    job: row.job,
    status: row.status,
    owner: typeof row.owner === 'string' ? row.owner : null,
    error: typeof row.error === 'string' ? row.error : null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) throw new NightNotFound(night);
  const text = readFileSync(path, 'utf8');
  const byJob = new Map<string, DigestRow>();
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const existing = byJob.get(parsed.job);
    if (!existing) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }
    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    if (Date.parse(parsed.at) >= Date.parse(existing.lastAt)) {
      existing.lastAt = parsed.at;
      existing.lastStatus = parsed.status;
      existing.lastError = parsed.error;
      existing.owner = parsed.owner;
    }
    if (Date.parse(parsed.at) < Date.parse(existing.firstAt)) existing.firstAt = parsed.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines, counts };
};
