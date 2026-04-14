// tests/run.js — minimal test runner. No deps.
// Discovers *.test.js in tests/ and runs them.
import { readdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(here).filter(f => f.endsWith('.test.js'));

let passed = 0, failed = 0;
for (const f of files) {
  const mod = await import(pathToFileURL(join(here, f)).href);
  for (const [name, fn] of Object.entries(mod)) {
    if (!name.startsWith('test_')) continue;
    try {
      await fn();
      console.log(`  ✓ ${f} :: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${f} :: ${name}\n    ${e.message}`);
      failed++;
    }
  }
}
console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed ? 1 : 0);
