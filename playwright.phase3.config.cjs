const { defineConfig } = require('@playwright/test');

/**
 * Browser tests for the Phase 3 full-stack pages.
 *
 * Separate from playwright.config.cjs because the two phases need different
 * things running. Phase 2 is static files on :4173 and keeps its state in
 * localStorage, so a test can reset it by clearing storage. Phase 3 needs
 * MySQL, the PHP API on :8080 and the Node runtime on :3000, and its state
 * lives in the database, so resetting it means reloading the seed.
 *
 * Run it with:  npx playwright test --config=playwright.phase3.config.cjs
 */
module.exports = defineConfig({
  testDir: './tests/browser',
  // Spelt out rather than left to the default: these specs are .cjs because
  // the project is not an ES module.
  testMatch: '**/*.phase3.spec.cjs',

  // These tests share one database, so they run in order, one at a time.
  // Parallel workers would see each other's packages.
  fullyParallel: false,
  workers: 1,

  // Reload the seed once before the run so the suite starts from the same
  // state the demo does.
  globalSetup: require.resolve('./tests/browser/phase3.setup.cjs'),

  use: {
    baseURL: 'http://127.0.0.1:8080',
    browserName: 'chromium',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },

  webServer: {
    // Starts PHP and Node together, and refuses to start if either port is
    // already held by something else.
    command: 'node tools/stack.cjs',
    url: 'http://127.0.0.1:8080/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
