import { describe, it } from 'vitest';
import { dbChecks } from './checks';
import { nodePlatform } from './node';

describe('database on Node SQLite', () => {
  // The 500-entry error log check takes ~7 s on slow Windows machines.
  for (const check of dbChecks) it(check.name, () => check.run(nodePlatform()), 30_000);
});
