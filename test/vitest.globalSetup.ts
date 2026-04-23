import { mkdirSync } from 'fs';

/**
 * Pre-create all top-level directories used by tests with user permissions.
 * Without this, the first Docker command would create target/ as root-owned,
 * causing EACCES errors for all subsequent tests that try to write there.
 */
export function setup() {
  const dirs = ['target', 'target/tests', 'target/tests.encrypt', 'target/test-config-loader-legacy-upgrade'];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
}
