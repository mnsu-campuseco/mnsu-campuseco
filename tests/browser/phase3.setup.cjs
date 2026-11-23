/**
 * Runs once before the Phase 3 browser suite.
 *
 * Phase 2 keeps its state in localStorage, so a test can reset it from inside
 * the browser. Phase 3 keeps its state in MySQL, which the browser cannot
 * touch, so the reset has to happen here instead.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

module.exports = async () => {
  const root = path.resolve(__dirname, '..', '..');

  try {
    const output = execFileSync(process.execPath, [path.join('tools', 'reset-db.cjs')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
    });

    if (!output.includes('Reset complete')) {
      throw new Error('reset-db.cjs ran but did not report success:\n' + output);
    }
    console.log('  [phase3 setup] demo data reloaded');
  } catch (error) {
    // Fail loudly here rather than letting every test fail one by one with a
    // confusing assertion about missing packages.
    throw new Error(
      'Could not reload the demo data before the Phase 3 suite.\n' +
        'Check that MySQL is running and that db/schema.sql has been loaded.\n' +
        String(error.message)
    );
  }
};
