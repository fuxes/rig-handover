// The morning digest: one row per job from a night's run log (plan.md § 1).

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  // null when the log names no owner; views render it as '—'.
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // Times keep the log's offset (styleguide).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  // Lines that did not parse: counted, never thrown.
  badLines: number;
};

// Reads runs/<night>.jsonl. Returns null when the night has no file.
export type ReadNight = (runsDir: string, night: string) => Night | null;
