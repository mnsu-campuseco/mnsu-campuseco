#!/usr/bin/env node
/**
 * MNSU-CampusEco — Phase 3 stack smoke test.
 *
 *   node tools/smoke-test.cjs          (or: npm run test:stack)
 *
 * Phase 2 could be tested with `node --test` alone, because the rules lived in
 * js/models.js. In Phase 3 the rules live in MySQL and in PHP, so a test that
 * only loads JavaScript proves nothing. This script exercises all four Phase 3
 * components over HTTP, the same way the browser does:
 *
 *   1. Frontend          — the three AngularJS pages and their scripts are served
 *   2. Node.js backend   — telemetry/server.js on :3000
 *   3. Backend server    — the PHP API on :8080
 *   4. Relational DB     — reached only through the API, and checked by asserting
 *                          that the database refuses what it should refuse
 *
 * It runs one complete delivery (check in -> claim -> Loaded -> En Route ->
 * Delivered -> signed) and then twelve negative tests. Every rule that Phase 2
 * enforced in the browser is attempted here against the server, with the
 * browser removed from the picture entirely.
 *
 * Exit code is 0 only if every check passes.
 */
'use strict';

const PHP = process.env.CAMPUSECO_API || 'http://127.0.0.1:8080';
const NODE = process.env.CAMPUSECO_TELEMETRY || 'http://127.0.0.1:3000';

/* ------------------------------------------------------------------ *
 * A very small cookie jar. Node's fetch does not keep session cookies,
 * and PHP's session id is the whole point of the auth tests.
 * ------------------------------------------------------------------ */
class Jar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  absorb(response) {
    // getSetCookie() keeps multiple Set-Cookie headers separate; a plain
    // get() would join them and split a cookie containing a comma.
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }

  clear() {
    this.cookies.clear();
  }
}

async function request(jar, method, url, body) {
  const headers = {};
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  jar.absorb(response);

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* Left null on purpose: a non-JSON body is itself a finding, and the
       raw text is reported so a PHP warning or stack trace is readable. */
  }
  return { status: response.status, json, text };
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */
const results = [];
let group = '';

function section(name) {
  group = name;
  console.log(`\n${name}`);
  console.log('-'.repeat(name.length));
}

function check(name, passed, detail) {
  results.push({ group, name, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`  ${mark}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Asserts a request succeeded (2xx and ok:true) and returns its payload. */
function expectOk(name, response) {
  const passed = response.status < 300 && response.json?.ok === true;
  check(name, passed, passed ? undefined : describe(response));
  return response.json ?? {};
}

/** Asserts a request was refused with a specific status code. */
function expectRefused(name, response, status, fragment) {
  let passed = response.status === status;
  let detail = `expected ${status}, got ${response.status}`;

  if (passed && fragment) {
    const message = String(response.json?.error ?? response.text ?? '');
    passed = message.toLowerCase().includes(fragment.toLowerCase());
    detail = passed ? `${status}` : `${status} but message was "${message}"`;
  } else if (passed) {
    detail = `${status}`;
  }
  check(name, passed, detail);
}

function describe(response) {
  const message = response.json?.error ?? response.text?.slice(0, 160) ?? '';
  return `${response.status} ${message}`.trim();
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */
async function main() {
  // A fresh tracking number each run, inside the [A-Z0-9]{8,34} branch of
  // the chk_tracking constraint. Marked SMOKE so a demo database can be
  // cleaned with: DELETE FROM packages WHERE tracking LIKE 'SMOKE%';
  const tracking = `SMOKE${Date.now()}`.slice(0, 20).toUpperCase();

  const operator = new Jar();
  const courier = new Jar();
  const anon = new Jar();

  /* ---- Component 2: the Node.js runtime ---- */
  section('Component 2 — Node.js backend (telemetry/server.js)');

  const health = await request(anon, 'GET', `${NODE}/health`);
  expectOk('/health responds', health);

  const carts = await request(anon, 'GET', `${NODE}/telemetry/carts`);
  const cartList = expectOk('/telemetry/carts returns the fleet', carts).carts ?? [];
  check('fleet is non-empty', cartList.length > 0, `${cartList.length} carts`);
  check(
    'every cart reports a battery level in range',
    cartList.length > 0 &&
      cartList.every((c) => typeof c.battery === 'number' && c.battery >= 0 && c.battery <= 100),
    cartList.map((c) => `${c.id} ${c.battery}%`).join(', ')
  );

  const route = await request(
    anon,
    'GET',
    `${NODE}/telemetry/route?cart=${encodeURIComponent(cartList[0]?.id ?? 'cart-01')}`
  );
  expectOk('/telemetry/route parses a cart route', route);

  // Ten at once: the runtime is single-threaded, so this is the check that it
  // does not block itself while serving the demo.
  const burst = await Promise.all(
    Array.from({ length: 10 }, () => request(anon, 'GET', `${NODE}/telemetry/carts`))
  );
  check(
    'ten concurrent requests all return 200',
    burst.every((r) => r.status === 200),
    burst.map((r) => r.status).join(' ')
  );

  /* ---- Component 1: the AngularJS frontend is served ---- */
  section('Component 1 — Frontend (AngularJS 1.8.3)');

  for (const page of ['operator-live', 'courier-live', 'enduser-live']) {
    const response = await request(anon, 'GET', `${PHP}/pages/${page}.html`);
    const html = response.text ?? '';
    check(
      `pages/${page}.html is served and bootstraps Angular`,
      response.status === 200 && html.includes('ng-app="campusEco"'),
      response.status === 200 ? undefined : `HTTP ${response.status}`
    );
  }

  for (const script of ['js/vendor/angular.min.js', 'js/angular-app.js']) {
    const response = await request(anon, 'GET', `${PHP}/${script}`);
    check(
      `${script} is served`,
      response.status === 200,
      `HTTP ${response.status}, ${response.text.length} bytes`
    );
  }

  /* ---- Component 4: the database, reached through the API ---- */
  section('Component 4 — Relational database (MySQL, via the API)');

  const destinations = await request(anon, 'GET', `${PHP}/api/destinations.php`);
  const destList =
    expectOk('destinations come from the destinations table', destinations).destinations ?? [];
  check('six campus destinations are seeded', destList.length === 6, `${destList.length} rows`);

  // The em-dash is the regression that cost us an afternoon: loading seed.sql
  // without utf8mb4 stored it double-encoded and every lookup failed silently.
  const emDashed = destList.filter((d) => String(d.name).includes('—'));
  check(
    'destination names survive the round trip as UTF-8',
    emDashed.length === destList.length && destList.length > 0,
    `${emDashed.length}/${destList.length} contain a literal em-dash`
  );

  const fleet = await request(anon, 'GET', `${PHP}/api/fleet.php`);
  const fleetBody = expectOk('fleet comes from the vehicles table', fleet);
  const fleetRows = fleetBody.vehicles ?? [];
  check('three carts are seeded', fleetRows.length === 3, `${fleetRows.length} rows`);
  check(
    'the API reports the claim threshold rather than hard-coding it in the UI',
    fleetBody.threshold === 20,
    `threshold ${fleetBody.threshold}`
  );
  check(
    'every cart carries a claimable flag consistent with its battery',
    fleetRows.length > 0 &&
      fleetRows.every(
        (v) => Boolean(v.claimable) === Number(v.battery) >= Number(fleetBody.threshold)
      ),
    fleetRows
      .map((v) => `${v.id} ${v.battery}% ${v.claimable ? 'claimable' : 'blocked'}`)
      .join(', ')
  );

  /* ---- Component 3: PHP, authentication ---- */
  section('Component 3 — Backend server (PHP 8.3): authentication');

  expectRefused(
    'checking a package in while signed out is refused',
    await request(anon, 'POST', `${PHP}/api/packages.php`, {
      tracking,
      weight: 2,
      length: 10,
      width: 10,
      height: 10,
      destination: destList[0]?.name,
    }),
    401
  );

  const badPassword = await request(new Jar(), 'POST', `${PHP}/api/auth.php?action=login`, {
    username: 'operator1',
    password: 'wrong-password',
  });
  expectRefused('a wrong password is refused', badPassword, 401);

  const noSuchUser = await request(new Jar(), 'POST', `${PHP}/api/auth.php?action=login`, {
    username: 'not-a-real-account',
    password: 'wrong-password',
  });
  expectRefused('an unknown username is refused', noSuchUser, 401);
  check(
    'both failures give the identical message (no account enumeration)',
    badPassword.json?.error === noSuchUser.json?.error,
    JSON.stringify(badPassword.json?.error)
  );

  expectOk(
    'operator1 signs in',
    await request(operator, 'POST', `${PHP}/api/auth.php?action=login`, {
      username: 'operator1',
      password: 'CampusEco2026',
    })
  );

  const me = await request(operator, 'GET', `${PHP}/api/auth.php?action=me`);
  check(
    'the session identifies the operator',
    me.json?.user?.role === 'operator',
    JSON.stringify(me.json?.user ?? me.json)
  );

  expectOk(
    'courier1 signs in',
    await request(courier, 'POST', `${PHP}/api/auth.php?action=login`, {
      username: 'courier1',
      password: 'CampusEco2026',
    })
  );

  /* ---- The lifecycle, across all four components ---- */
  section('All four together — one complete delivery');

  const destination = destList[0].name;
  const checkIn = await request(operator, 'POST', `${PHP}/api/packages.php`, {
    tracking,
    weight: 3.4,
    length: 24,
    width: 18,
    height: 12,
    destination,
    urgent: true,
  });
  const created = expectOk(`check in ${tracking}`, checkIn);
  const packageId = created.package?.id ?? created.package?.package_id ?? created.id;
  check(
    'the new package starts At hub',
    created.package?.status === 'At hub',
    created.package?.status
  );
  check('the API returns the new package id', Number.isInteger(packageId), String(packageId));

  if (!Number.isInteger(packageId)) {
    console.error('\nCannot continue the lifecycle without a package id.');
    return finish();
  }

  // Which cart can legally take it, according to the server's own report.
  const claimable = fleetRows.find((v) => v.claimable);
  const flat = fleetRows.find((v) => !v.claimable);
  check(
    'at least one cart is above the claim threshold',
    Boolean(claimable),
    claimable ? `${claimable.id} at ${claimable.battery}%` : 'none'
  );

  const courierId = 'ECO-0417';

  if (flat) {
    expectRefused(
      `claiming with ${flat.id} at ${flat.battery}% is refused`,
      await request(courier, 'POST', `${PHP}/api/claims.php`, {
        package_id: packageId,
        courier_id: courierId,
        cart_id: flat.id,
      }),
      409,
      'battery'
    );
  } else {
    check(
      'a below-threshold cart exists to test the battery rule',
      false,
      'every seeded cart is above the threshold — battery rule not exercised. Run: npm run db:reset'
    );
  }

  // An unclaimed package has no assigned courier, so the ownership guard is
  // what refuses this, not the sequence guard. The sequence rule is tested
  // after the claim, below, where it is the rule actually in play.
  expectRefused(
    'advancing a package nobody has claimed is refused',
    await request(courier, 'POST', `${PHP}/api/milestones.php`, {
      package_id: packageId,
      courier_id: courierId,
      status: 'Loaded',
    }),
    403
  );

  const cartId = claimable?.id;
  expectOk(
    `claim the package onto ${cartId}`,
    await request(courier, 'POST', `${PHP}/api/claims.php`, {
      package_id: packageId,
      courier_id: courierId,
      cart_id: cartId,
    })
  );

  expectRefused(
    'a second claim on the same package is refused',
    await request(courier, 'POST', `${PHP}/api/claims.php`, {
      package_id: packageId,
      courier_id: courierId,
      cart_id: cartId,
    }),
    409,
    'assigned'
  );

  expectRefused(
    "advancing with another courier's id is refused",
    await request(courier, 'POST', `${PHP}/api/milestones.php`, {
      package_id: packageId,
      courier_id: 'ECO-9999',
      status: 'Loaded',
    }),
    403
  );

  // Now that the package is claimed, the ownership guard is satisfied, so this
  // is the sequence rule being tested on its own: At hub cannot jump to
  // Delivered without passing through Loaded and En Route.
  expectRefused(
    'skipping At hub straight to Delivered is refused',
    await request(courier, 'POST', `${PHP}/api/milestones.php`, {
      package_id: packageId,
      courier_id: courierId,
      status: 'Delivered',
    }),
    409
  );

  expectRefused(
    'signing for a package that is not delivered yet is refused',
    await request(anon, 'POST', `${PHP}/api/receipts.php`, { tracking, name: 'Too Early' }),
    409,
    'delivered'
  );

  for (const status of ['Loaded', 'En Route', 'Delivered']) {
    expectOk(
      `advance to ${status}`,
      await request(courier, 'POST', `${PHP}/api/milestones.php`, {
        package_id: packageId,
        courier_id: courierId,
        status,
      })
    );
  }

  const tracked = await request(
    anon,
    'GET',
    `${PHP}/api/track.php?tracking=${encodeURIComponent(tracking)}`
  );
  const trackedBody = expectOk('tracking the package without an account', tracked);
  const history = trackedBody.history ?? trackedBody.package?.history ?? [];

  // transit_events is an audit log, not one row per status: a claim is a real
  // event that happens while the package is still At hub, so a status can
  // legitimately appear more than once. What must hold is that the distinct
  // statuses are reached in the right order and none is skipped.
  const statusOrder = ['At hub', 'Loaded', 'En Route', 'Delivered'];
  const reached = history.map((h) => h.status).filter((s, i, a) => s !== a[i - 1]);
  check(
    'the audit trail reaches all four milestones in order, with none skipped',
    reached.length === 4 && statusOrder.every((s, i) => reached[i] === s),
    history.map((h) => h.status).join(' -> ')
  );
  check(
    'every event carries a timestamp',
    history.length > 0 && history.every((h) => h.at && !Number.isNaN(Date.parse(h.at))),
    `${history.length} events`
  );
  check(
    'the claim is recorded in the audit trail with the courier and cart',
    history.some(
      (h) => String(h.note ?? '').includes(courierId) && String(h.note ?? '').includes(cartId)
    ),
    history
      .map((h) => h.note)
      .filter(Boolean)
      .join(' | ')
  );

  expectOk(
    'sign for the delivered package',
    await request(anon, 'POST', `${PHP}/api/receipts.php`, { tracking, name: 'Smoke Test' })
  );

  expectRefused(
    'a second signature on the same package is refused by UNIQUE',
    await request(anon, 'POST', `${PHP}/api/receipts.php`, { tracking, name: 'Smoke Test Again' }),
    409
  );

  const metrics = await request(
    anon,
    'GET',
    `${PHP}/api/metrics.php?tracking=${encodeURIComponent(tracking)}`
  );
  const metricsBody = expectOk('carbon metrics are computed for the delivery', metrics);
  const co2 = Number(metricsBody.metrics?.co2_kg ?? metricsBody.co2_kg ?? NaN);
  check('avoided CO2 is a positive number', Number.isFinite(co2) && co2 > 0, `${co2} kg`);

  /* ---- Remaining validation rules ---- */
  section('Component 3 + 4 — validation the server refuses');

  expectRefused(
    'a duplicate tracking number is refused',
    await request(operator, 'POST', `${PHP}/api/packages.php`, {
      tracking,
      weight: 2,
      length: 10,
      width: 10,
      height: 10,
      destination,
    }),
    409,
    'already'
  );

  expectRefused(
    'a 900 kg package is refused',
    await request(operator, 'POST', `${PHP}/api/packages.php`, {
      tracking: `SMOKEHEAVY${Date.now()}`.slice(0, 20).toUpperCase(),
      weight: 900,
      length: 10,
      width: 10,
      height: 10,
      destination,
    }),
    400
  );

  expectRefused(
    'a 90 cm dimension is refused',
    await request(operator, 'POST', `${PHP}/api/packages.php`, {
      tracking: `SMOKEBIG${Date.now()}`.slice(0, 20).toUpperCase(),
      weight: 2,
      length: 90,
      width: 10,
      height: 10,
      destination,
    }),
    400
  );

  expectRefused(
    'an unknown destination is refused',
    await request(operator, 'POST', `${PHP}/api/packages.php`, {
      tracking: `SMOKEDEST${Date.now()}`.slice(0, 20).toUpperCase(),
      weight: 2,
      length: 10,
      width: 10,
      height: 10,
      destination: 'Hogwarts Great Hall',
    }),
    400
  );

  expectRefused(
    'an unknown tracking number returns 404',
    await request(anon, 'GET', `${PHP}/api/track.php?tracking=CE-00000000`),
    404
  );

  expectRefused(
    'a malformed tracking number is refused',
    await request(operator, 'POST', `${PHP}/api/packages.php`, {
      tracking: 'nope',
      weight: 2,
      length: 10,
      width: 10,
      height: 10,
      destination,
    }),
    400
  );

  expectOk(
    'operator signs out',
    await request(operator, 'POST', `${PHP}/api/auth.php?action=logout`)
  );
  expectRefused(
    'the session is dead after signing out',
    await request(operator, 'POST', `${PHP}/api/packages.php`, {
      tracking: `SMOKEGONE${Date.now()}`.slice(0, 20).toUpperCase(),
      weight: 2,
      length: 10,
      width: 10,
      height: 10,
      destination,
    }),
    401
  );

  finish(tracking);
}

function finish(tracking) {
  const failed = results.filter((r) => !r.passed);
  const line = '='.repeat(60);
  console.log(`\n${line}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);

  if (failed.length > 0) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  [${f.group}] ${f.name} — ${f.detail ?? ''}`);
  }
  if (tracking) {
    console.log(`\nThis run left one delivered package behind: ${tracking}`);
    console.log('Reset the demo data with:  npm run db:reset');
  }
  console.log(line);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('\nThe smoke test could not finish:', error.message);
  console.error('\nAre both servers running?');
  console.error(`  PHP API    ${PHP}`);
  console.error(`  Telemetry  ${NODE}`);
  console.error('\nStart them with:  npm run stack');
  process.exitCode = 1;
});
