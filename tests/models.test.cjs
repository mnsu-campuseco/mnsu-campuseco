const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  Package,
  Vehicle,
  EcoCourier,
  DESTINATIONS,
  seed,
  hydrate,
  queue,
} = require('../js/models.js');
const makePackage = (overrides = {}) =>
  new Package({
    tracking: 'CE-20261004',
    weight: 2,
    length: 10,
    width: 8,
    height: 4,
    destination: DESTINATIONS[0],
    ...overrides,
  });
test('delivery journey enforces ownership, order, and one receipt', () => {
  const p = makePackage(),
    courier = new EcoCourier('ECO-1234', 'cart-01'),
    cart = new Vehicle({ id: 'cart-01', battery: 80 });
  assert.throws(() => p.sign('Demo User'), /delivered/);
  p.claim(courier, cart);
  assert.throws(() => p.claim(courier, cart), /assigned/);
  assert.throws(() => p.advance('Delivered', courier.id), /sequence/);
  assert.throws(() => p.advance('Loaded', 'ECO-9999'), /assigned courier/);
  for (const status of ['Loaded', 'En Route', 'Delivered'])
    p.advance(status, courier.id, 'Demo update');
  p.sign('Demo User');
  assert.equal(p.receipt.name, 'Demo User');
  assert.throws(() => p.sign('Another User'), /already/);
  assert.equal(p.events.length, 5);
});
test('invalid cargo, IDs, and low batteries are rejected', () => {
  for (const data of [
    { weight: 151 },
    { weight: '' },
    { height: 0 },
    { tracking: '<script>' },
    { destination: 'Unknown' },
  ])
    assert.throws(() => makePackage(data));
  assert.throws(() => new EcoCourier('1234', 'cart-01'));
  assert.throws(() => new Vehicle({ id: 'cart-01', battery: 10.5 }));
  assert.throws(
    () =>
      makePackage().claim(
        new EcoCourier('ECO-1234', 'cart-01'),
        new Vehicle({ id: 'cart-01', battery: 19 })
      ),
    /20%/
  );
});
test('saved data restores class behavior and rejects incompatible versions', () => {
  const restored = hydrate(JSON.parse(JSON.stringify(seed())));
  assert.ok(restored.packages.every((p) => p instanceof Package));
  assert.ok(restored.vehicles.every((v) => v instanceof Vehicle));
  assert.throws(() => hydrate({ version: 1 }));
  const brokenHistory = JSON.parse(JSON.stringify(seed()));
  brokenHistory.packages[0].events = 'invalid history';
  assert.throws(() => hydrate(brokenHistory), /history/);
  const brokenPreferences = JSON.parse(JSON.stringify(seed()));
  brokenPreferences.preferences = { building: DESTINATIONS[0], location: 'Desk', method: 'desk' };
  assert.throws(() => hydrate(brokenPreferences), /preferences/);
  assert.equal(restored.packages.find((p) => p.tracking === 'CE-20261002').status, 'Delivered');
});
test('queue puts urgent deliveries first and excludes delivered packages without mutating input', () => {
  const data = seed(),
    before = data.packages.map((p) => p.tracking);
  const result = queue(data.packages);
  assert.equal(result[0].urgent, true);
  assert.ok(result.every((p) => p.status !== 'Delivered'));
  assert.deepEqual(
    data.packages.map((p) => p.tracking),
    before
  );
});
