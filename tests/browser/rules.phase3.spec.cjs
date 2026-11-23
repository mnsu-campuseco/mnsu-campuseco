/**
 * Phase 3 — the rules, driven through the real pages.
 *
 * tools/smoke-test.cjs already proves the server enforces these rules over
 * HTTP. This suite asks a different question: does a person clicking the
 * actual portals meet those rules, see the refusal, and get a usable message?
 * The API could be perfect and the page still swallow the error.
 *
 * These tests share one database and run in order. Each one that writes picks
 * its own tracking number so a reseed is not needed between tests.
 */
'use strict';

const { test, expect } = require('@playwright/test');

const PASSWORD = 'CampusEco2026';
const DESTINATION = 'Trafton Science Center — Array B';

/** A tracking number no other test will use. */
function tracking(tag) {
  return ('T' + tag + Date.now().toString().slice(-9)).toUpperCase().slice(0, 20);
}

async function signIn(page, username) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('text=Signed in as')).toBeVisible();
}

/**
 * Pick a cart by its id.
 *
 * Not as simple as selectOption({ label }). AngularJS ng-options rewrites the
 * value attributes to its own keys ("string:cart-01"), and Playwright's label
 * option takes a string rather than a pattern, while the visible text carries
 * the route and a battery percentage that changes between runs. So the option
 * is found by the id in its text and then selected by whatever value Angular
 * gave it.
 */
async function selectCart(page, cartId) {
  const value = await page
    .locator('#cart option', { hasText: cartId })
    .first()
    .getAttribute('value');

  if (value === null) {
    throw new Error(`No cart option matching "${cartId}"`);
  }
  await page.locator('#cart').selectOption(value);
}

async function checkIn(page, number, options = {}) {
  await page.locator('#tracking').fill(number);
  await page.locator('#weight').fill(String(options.weight ?? 3.2));
  await page.locator('#length').fill('24');
  await page.locator('#width').fill('18');
  await page.locator('#height').fill('12');
  await page.locator('#destination').selectOption({ label: DESTINATION });
  if (options.recipient) {
    await page.locator('#recipient').fill(options.recipient);
  }
  await page.getByRole('button', { name: /Check in|Saving/ }).click();
}

/* ------------------------------------------------------------------ */

test('the hub operator page reads its totals from the database', async ({ page }) => {
  await page.goto('/pages/operator-live.html');
  await signIn(page, 'operator1');

  // The seed is three packages: one at hub, one en route, one delivered.
  await expect(page.locator('.stats')).toContainText('3');
  await expect(page.locator('table')).toContainText('CE-20261001');
  await expect(page.locator('table')).toContainText('CE-20261003');
});

test('a duplicate tracking number is refused, and nothing is written', async ({ page }) => {
  const number = tracking('DUP');

  await page.goto('/pages/operator-live.html');
  await signIn(page, 'operator1');

  await checkIn(page, number);
  await expect(page.locator('.feedback').first()).toContainText('checked in');
  await expect(page.locator('table')).toContainText(number);

  const rowsAfterFirst = await page.locator('table tbody tr').count();

  // Same number again. This is refused by the UNIQUE index in MySQL, not by
  // anything in the page.
  await checkIn(page, number);
  await expect(page.locator('.feedback.error')).toContainText('already checked in');

  // The refusal must not have written a second row.
  expect(await page.locator('table tbody tr').count()).toBe(rowsAfterFirst);
});

test('check-in validation refuses an impossible weight', async ({ page }) => {
  await page.goto('/pages/operator-live.html');
  await signIn(page, 'operator1');

  await checkIn(page, tracking('HEAVY'), { weight: 900 });
  await expect(page.locator('.feedback.error')).toContainText('Weight');
});

test('a cart below the battery threshold cannot claim, a charged one can', async ({ page }) => {
  const number = tracking('CLAIM');

  // Check one in as the operator first, so there is something to claim.
  await page.goto('/pages/operator-live.html');
  await signIn(page, 'operator1');
  await checkIn(page, number);
  await expect(page.locator('.feedback').first()).toContainText('checked in');

  // One browser holds one session, so the operator signs out before the
  // courier signs in. Two real people would use two browsers.
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.goto('/pages/courier-live.html');
  await signIn(page, 'courier1');

  await page.locator('#driver-id').fill('ECO-0417');

  const row = page.locator('tr', { hasText: number });
  // cart-03 is seeded at 19%, below the 20% the server requires.
  await selectCart(page, 'cart-03');
  await row.getByRole('button', { name: 'Claim' }).click();
  await expect(page.locator('.feedback.error')).toContainText('battery');

  // cart-01 is seeded at 88%.
  await selectCart(page, 'cart-01');
  await row.getByRole('button', { name: 'Claim' }).click();
  await expect(page.locator('.feedback').first()).toContainText('claimed');
});

test('the portal only ever offers the next legal milestone', async ({ page }) => {
  const number = tracking('SEQ');

  await page.goto('/pages/operator-live.html');
  await signIn(page, 'operator1');
  await checkIn(page, number);
  await expect(page.locator('.feedback').first()).toContainText('checked in');
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.goto('/pages/courier-live.html');
  await signIn(page, 'courier1');
  await page.locator('#driver-id').fill('ECO-0417');
  await selectCart(page, 'cart-01');

  const row = page.locator('tr', { hasText: number });
  await row.getByRole('button', { name: 'Claim' }).click();
  await expect(page.locator('.feedback').first()).toContainText('claimed');

  // At hub, so the only button is Loaded. There is deliberately no way to
  // jump to Delivered from here; the server refuses it too, which
  // tools/smoke-test.cjs covers.
  await expect(row.getByRole('button', { name: 'Mark Loaded' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Mark Delivered' })).toHaveCount(0);

  await row.getByRole('button', { name: 'Mark Loaded' }).click();
  await expect(row.getByRole('button', { name: 'Mark En Route' })).toBeVisible();

  await row.getByRole('button', { name: 'Mark En Route' }).click();
  await expect(row.getByRole('button', { name: 'Mark Delivered' })).toBeVisible();

  await row.getByRole('button', { name: 'Mark Delivered' }).click();

  // Delivered packages leave the open queue.
  await expect(page.locator('tr', { hasText: number })).toHaveCount(0);
});

test('the recipient timeline is the audit trail, and a delivery signs once', async ({ page }) => {
  await page.goto('/pages/enduser-live.html');

  // CE-20261002 is seeded as already delivered.
  await page.locator('#tracking-lookup').fill('CE-20261002');
  // The lookup form's own submit button. "Track" also appears on each
  // row of the My packages panel, so this is scoped to the form.
  await page.locator('form').filter({ has: page.locator('#tracking-lookup') })
    .getByRole('button', { name: 'Track' }).click();

  await expect(page.locator('.timeline')).toContainText('At hub');
  await expect(page.locator('.timeline')).toContainText('Delivered');

  await page.locator('#signature').fill('Playwright Recipient');
  await page.getByRole('button', { name: 'Confirm receipt' }).click();
  await expect(page.locator('.feedback').first()).toContainText(/Receipt recorded/);

  // Once signed, the form is replaced by who signed and when, so the page
  // gives no way to attempt a second signature at all — the same shape as the
  // milestone buttons, where only the next legal action is ever offered.
  //
  // The rule itself is enforced by the UNIQUE index on receipts.package_id,
  // and tools/smoke-test.cjs proves that by posting a second signature
  // straight at the API and getting a 409 back. That belongs there rather
  // than here: this suite is about what a person using the page can reach.
  await expect(page.locator('#signature')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm receipt' })).toHaveCount(0);
  await expect(page.locator('text=Signed by')).toBeVisible();
});

test('a recipient sees only the packages addressed to them', async ({ page }) => {
  await page.goto('/pages/enduser-live.html');

  // Signed out there is no "my packages" panel at all.
  await expect(page.getByRole('heading', { name: 'My packages' })).toHaveCount(0);

  await signIn(page, 'student1');
  await expect(page.getByRole('heading', { name: 'My packages' })).toBeVisible();

  const panel = page.locator('section.panel', { hasText: 'My packages' });

  // The seed addresses CE-20261001 and CE-20261002 to student1 and leaves
  // CE-20261003 with no recipient.
  await expect(panel).toContainText('CE-20261001');
  await expect(panel).toContainText('CE-20261002');
  await expect(panel).not.toContainText('CE-20261003');
});

test('the page reports a refusal rather than failing silently', async ({ page }) => {
  // Signing in as a courier and opening the operator portal: the role guard
  // should produce a message on the page, not a blank screen.
  await page.goto('/pages/operator-live.html');
  await signIn(page, 'courier1');

  await checkIn(page, tracking('ROLE'));
  await expect(page.locator('.feedback.error')).toContainText(/role|not/i);
});

test('no page in the suite logs an uncaught error', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));

  for (const path of [
    '/index.html',
    '/pages/operator-live.html',
    '/pages/courier-live.html',
    '/pages/enduser-live.html',
  ]) {
    await page.goto(path);
    await page.waitForTimeout(600);
  }

  expect(failures).toEqual([]);
});
