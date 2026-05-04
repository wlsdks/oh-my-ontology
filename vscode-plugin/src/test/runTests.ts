/**
 * Entry point for `@vscode/test-electron` — downloads VSCode (cached
 * across runs), launches it headless with the plugin loaded, and runs
 * the mocha suite under `src/test/suite/`.
 *
 * Run via `npm run test:e2e`. CI runs the same script under xvfb on Linux.
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');
    // Use the dogfood vault as the workspace so the plugin's
    // auto-detection finds nodes during the e2e run.
    const workspaceFolder = path.resolve(__dirname, '..', '..', '..');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspaceFolder, '--disable-extensions', '--disable-workspace-trust'],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

void main();
