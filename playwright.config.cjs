const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  // Spelt out rather than left to the default. The specs here are .cjs
  // because the project is not an ES module, and relying on the default
  // pattern to pick that up left "No tests found" with no explanation.
  testMatch: '**/*.spec.cjs',
  // The Phase 3 specs live in the same folder but need MySQL, PHP and the
  // Node runtime, none of which this config starts. Without this they are
  // collected here too and run against the static server on :4173, where
  // there is no API behind them.
  testIgnore: '**/*.phase3.spec.cjs',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
