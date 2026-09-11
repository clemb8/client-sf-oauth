/**
 * E2E setup: load `.env` into the process environment.
 *
 * Uses Node's built-in dotenv parser (Node 20.6+), so the suite adds no
 * dependency to a package whose whole point is a small install footprint.
 *
 * A missing `.env` is not an error. Every suite checks its own variables and
 * skips itself when they are absent, so a contributor without a Salesforce org
 * can still run the full repository green.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');

if (existsSync(envPath)) {
  // Available from Node 20.6 / 21.7. Guarded so an older runtime degrades to
  // "read the real environment" rather than crashing the suite.
  const loader = (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (typeof loader === 'function') {
    loader.call(process, envPath);
  } else {
    console.warn(
      '[e2e] .env found but this Node version cannot read it (needs 20.6+). ' +
        'Export the variables in your shell, or upgrade Node.',
    );
  }
}
