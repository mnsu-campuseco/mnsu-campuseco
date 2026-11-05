const { test, expect } = require('@playwright/test');
const KEY = 'campuseco.phase2.v2';
async function checkin(page, tracking = 'CE-20261004') {
  await page.locator('#tracking').fill(tracking);
  await page.locator('#weight').fill('3.2');
  for (const [key, value] of [
    ['length', '12'],
    ['width', '8'],
    ['height', '6'],
  ])
    await page.locator(`#${key}`).fill(value);
  await page.locator('#destination').selectOption({ index: 1 });
  await page.locator('#checkin-form button[type=submit]').click();
}
test('complete cross-portal delivery journey persists without submit reloads', async ({
  page,
  context,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/pages/operator.html');
  await page.evaluate(() => {
    window.journeyMarker = true;
  });
  await checkin(page);
  await expect(page.locator('#package-log')).toContainText('CE-20261004');
  expect(await page.evaluate(() => window.journeyMarker)).toBe(true);
  await checkin(page);
  await expect(page.locator('#feedback')).toContainText('already checked in');
  const crew = await context.newPage();
  await crew.goto('/pages/courier.html');
  await crew.locator('#driver-id').fill('ECO-1234');
  await crew.locator('#cart').selectOption('cart-01');
  await crew.locator('#shift-form button[type=submit]').click();
  await expect(crew.locator('#shift-summary')).toContainText('ECO-1234');
  await crew.locator('[data-claim="CE-20261004"]').click();
  await expect(page.locator('#package-log tr').filter({ hasText: 'CE-20261004' })).toContainText(
    'ECO-1234'
  );
  for (const status of ['Loaded', 'En Route', 'Delivered']) {
    await crew.locator('#package').selectOption('CE-20261004');
    await expect(crew.locator(`[name="status"][value="${status}"]`)).toBeChecked();
    await crew.locator('#milestone-form button').click();
    await expect(crew.locator('#feedback')).toContainText('milestone updated');
  }
  await page.goto('/pages/enduser.html');
  await page.locator('#tracking-number').fill('CE-20261004');
  await page.locator('#tracking-form button').click();
  await expect(page.locator('#tracking-result')).toContainText('Delivered');
  await expect(page.locator('#tracking-history tbody tr')).toHaveCount(5);
  await page.locator('#receipt-package').selectOption('CE-20261004');
  await page.locator('#signature').fill('Demo Recipient');
  await page.locator('#receipt-consent').check();
  await page.locator('#signoff-form button').click();
  await expect(page.locator('#receipt-summary')).toContainText('Demo Recipient');
  await page.reload();
  await expect(page.locator('#receipt-summary')).toContainText('CE-20261004');
  await expect(page.locator('#carbon-metrics')).toContainText('0.8 kg');
  await crew.reload();
  await expect(crew.locator('#shift-summary')).toContainText('ECO-1234');
  expect(errors).toEqual([]);
});
test('preferences and profile persist; notification categories and keyboard panel work', async ({
  page,
}) => {
  await page.goto('/pages/enduser.html');
  await page.locator('#preferences-toggle').click();
  await page.locator('#building').selectOption({ index: 1 });
  await page.locator('#delivery-location').fill('Front desk');
  for (const id of ['hub', 'transit', 'delivered']) await page.locator(`#notify-${id}`).uncheck();
  await page.locator('#preferences-form button').click();
  await expect(page.locator('#notifications')).toContainText('No notifications');
  await page.locator('#full-name').fill('Demo Student');
  await page.locator('#email').fill('demo@example.edu');
  await page.locator('#campus-role').selectOption('Student');
  await page.locator('#registration-form button').click();
  await page.reload();
  await expect(page.locator('#profile-summary')).toContainText('Demo Student');
  await expect(page.locator('#preferences-summary')).toContainText('Front desk');
  await page.locator('#preferences-toggle').click();
  await expect(page.locator('#delivery-location')).toHaveValue('Front desk');
  await page.keyboard.press('Escape');
  await expect(page.locator('#preferences-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#preferences-toggle')).toBeFocused();
});
test('native validation, low battery, unknown tracking, and safe text rendering', async ({
  page,
}) => {
  await page.goto('/pages/operator.html');
  await page.locator('#checkin-form button[type=submit]').click();
  await expect(page.locator('#tracking')).toBeFocused();
  await expect(page.locator('#package-log tbody tr')).toHaveCount(3);
  await page.goto('/pages/courier.html');
  await page.locator('#driver-id').fill('ECO-9999');
  await page.locator('#cart').selectOption('cart-03');
  await page.locator('#shift-form button[type=submit]').click();
  await expect(page.locator('[data-claim]')).toBeDisabled();
  await page.locator('#battery').fill('70');
  await page.locator('#shift-form button[type=submit]').click();
  await expect(page.locator('[data-claim]')).toBeEnabled();
  await page.goto('/pages/enduser.html');
  await page.locator('#tracking-number').fill('CE-99999999');
  await page.locator('#tracking-form button').click();
  await expect(page.locator('#tracking-result')).toContainText('No package found');
  await page.locator('#full-name').fill('<img src=x onerror=alert(1)>');
  await page.locator('#email').fill('demo@example.edu');
  await page.locator('#campus-role').selectOption('Staff');
  await page.locator('#registration-form button').click();
  await expect(page.locator('#profile-summary')).toContainText('<img');
  await expect(page.locator('#profile-summary img')).toHaveCount(0);
});
test('reset is explicit and scoped; corrupt storage can be recovered', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.setItem('unrelated-demo', 'keep');
    localStorage.setItem(key, '{bad json');
  }, KEY);
  await page.reload();
  await expect(page.locator('#storage-warning')).toContainText('could not be read');
  await page.locator('#reset-toggle').click();
  await page.locator('#reset-cancel').click();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('{bad json');
  await page.locator('#reset-toggle').click();
  await page.locator('#reset-confirm').click();
  await expect(page.locator('#storage-warning')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('unrelated-demo'))).toBe('keep');
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).packages.length, KEY)
  ).toBe(3);
});
test('blocked browser storage keeps the current page usable with a visible warning', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/pages/operator.html');
  await expect(page.locator('#storage-warning')).toContainText('unavailable');
  await checkin(page);
  await expect(page.locator('#package-log')).toContainText('CE-20261004');
  await page.locator('#log-search').fill('CE-20261004');
  await expect(page.locator('#package-log tbody tr')).toHaveCount(1);
});
test('cart conflicts and switching away from unfinished deliveries are prevented', async ({
  page,
}) => {
  await page.goto('/pages/courier.html');
  await page.locator('#driver-id').fill('ECO-1234');
  await page.locator('#cart').selectOption('cart-02');
  await page.locator('#shift-form button[type=submit]').click();
  await expect(page.locator('#feedback')).toContainText('another driver');
  await page.locator('#cart').selectOption('cart-01');
  await page.locator('#shift-form button[type=submit]').click();
  await page.locator('[data-claim="CE-20261003"]').click();
  await page.locator('#end-shift').click();
  await expect(page.locator('#feedback')).toContainText('Complete your claimed deliveries');
  await page.locator('#cart').selectOption('cart-03');
  await page.locator('#battery').fill('90');
  await page.locator('#shift-form button[type=submit]').click();
  await expect(page.locator('#feedback')).toContainText('before switching carts');
  await expect(page.locator('#shift-summary')).toContainText('cart-01');
});
for (const width of [320, 390, 768, 1440]) {
  test(`all portals fit ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const path of [
      '/',
      '/pages/operator.html',
      '/pages/courier.html',
      '/pages/enduser.html',
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      await expect(page.locator('h1')).toBeVisible();
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `test-results/${path === '/' ? 'home' : path.split('/').pop().replace('.html', '')}-${width === 390 ? 'mobile' : 'desktop'}.png`,
          fullPage: width === 390,
        });
    }
    expect(errors).toEqual([]);
  });
}

test('presentation navigation, image assets, and slide geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/docs/presentation.html');
  await expect(page.locator('.slide')).toHaveCount(8);
  for (let index = 0; index < 8; index++) {
    await expect(page.locator('#counter')).toHaveText(`${index + 1} / 8`);
    const geometry = await page.locator('.slide.active').evaluate((slide) => ({
      fits: slide.scrollHeight <= slide.clientHeight,
      images: [...slide.querySelectorAll('img')].every(
        (image) => image.complete && image.naturalWidth > 0
      ),
      viewport: slide.getBoundingClientRect().bottom <= window.innerHeight,
    }));
    expect(geometry).toEqual({ fits: true, images: true, viewport: true });
    await page.locator('.slide.active').screenshot({ path: `test-results/slide-${index + 1}.png` });
    if (index < 7) await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Home');
  await expect(page.locator('#counter')).toHaveText('1 / 8');
  await page.keyboard.press('End');
  await expect(page.locator('#counter')).toHaveText('8 / 8');
});
