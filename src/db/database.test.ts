import { describe, it } from 'vitest';
import { dbChecks } from './checks';
import { nodePlatform } from './node';

describe('database on Node SQLite', () => {
  for (const check of dbChecks) it(check.name, () => check.run(nodePlatform()));
});
