export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type StatusCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightRead = {
  rows: DigestRow[];
  badLines: number;
  counts: StatusCounts;
};

export type ReadNight = (runsDir: string, night: string) => NightRead;
