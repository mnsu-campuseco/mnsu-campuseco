/* Phase 2 domain models. No network or database operations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusEco = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STATUSES = ['At hub', 'Loaded', 'En Route', 'Delivered'];
  const DESTINATIONS = [
    'Julia Sears Hall — Array A',
    'Preska Residence Community — Array A',
    'McElroy Residence Community — Array B',
    'Centennial Student Union — Array A',
    'Memorial Library — Array A',
    'Trafton Science Center — Array B',
  ];
  function ensure(condition, message) {
    if (!condition) throw new Error(message);
  }
  function bounded(value, min, max, label) {
    ensure(
      value !== '' &&
        value !== null &&
        Number.isFinite(Number(value)) &&
        Number(value) >= min &&
        Number(value) <= max,
      `${label} must be between ${min} and ${max}.`
    );
    return Number(value);
  }
  class Package {
    constructor(data) {
      this.tracking = String(data.tracking || '')
        .trim()
        .toUpperCase();
      ensure(
        /^(?:[A-Z0-9]{8,34}|CE-[0-9]{8})$/.test(this.tracking),
        'Use 8–34 letters/digits or CE- followed by 8 digits.'
      );
      this.weight = bounded(data.weight, 0.1, 150, 'Weight');
      this.dimensions = ['length', 'width', 'height'].map((key, i) =>
        bounded(data[key] ?? data.dimensions?.[i], 0.1, 60, key)
      );
      ensure(DESTINATIONS.includes(data.destination), 'Select a campus destination.');
      this.destination = data.destination;
      this.urgent = Boolean(data.urgent);
      this.status = data.status || 'At hub';
      ensure(STATUSES.includes(this.status), 'Unknown transit status.');
      this.courier = data.courier || null;
      this.cart = data.cart || null;
      this.created = data.created || new Date().toISOString();
      this.events = data.events || [
        { status: 'At hub', at: this.created, note: 'Received at central hub' },
      ];
      this.receipt = data.receipt || null;
      ensure(
        Array.isArray(this.events) &&
          this.events.length > 0 &&
          this.events.every(
            (event) =>
              event &&
              STATUSES.includes(event.status) &&
              typeof event.at === 'string' &&
              Number.isFinite(Date.parse(event.at)) &&
              typeof event.note === 'string'
          ),
        'Saved package history is invalid.'
      );
      ensure(
        !this.receipt ||
          (typeof this.receipt.name === 'string' && Number.isFinite(Date.parse(this.receipt.at))),
        'Saved receipt is invalid.'
      );
      this.distance = bounded(data.distance ?? 2, 0.1, 20, 'Route distance');
    }
    claim(courier, vehicle) {
      ensure(!this.courier && this.status === 'At hub', 'This package is already assigned.');
      ensure(
        courier instanceof EcoCourier && vehicle instanceof Vehicle,
        'Start a crew shift first.'
      );
      ensure(vehicle.battery >= 20, 'Choose a cart with at least 20% battery.');
      this.courier = courier.id;
      this.cart = vehicle.id;
      this.events.push({
        status: 'At hub',
        at: new Date().toISOString(),
        note: `Claimed by ${courier.id} · ${vehicle.id}`,
      });
    }
    advance(status, courierId, note = '') {
      ensure(
        this.courier && this.courier === courierId,
        'Only the assigned courier can update this package.'
      );
      ensure(
        STATUSES.indexOf(status) === STATUSES.indexOf(this.status) + 1,
        'Follow the sequence: Loaded → En Route → Delivered.'
      );
      this.status = status;
      this.events.push({
        status,
        at: new Date().toISOString(),
        note: String(note).trim().slice(0, 160),
      });
    }
    sign(name) {
      ensure(this.status === 'Delivered', 'Wait until the package is delivered before signing.');
      ensure(!this.receipt, 'This delivery has already been signed for.');
      ensure(String(name).trim().length >= 2, 'Enter your full name.');
      this.receipt = { name: String(name).trim().slice(0, 100), at: new Date().toISOString() };
    }
  }
  class Vehicle {
    constructor(data) {
      this.id = data.id;
      this.route = data.route;
      this.reportBattery(data.battery);
    }
    reportBattery(value) {
      const level = bounded(value, 0, 100, 'Battery');
      ensure(Number.isInteger(level), 'Battery must be a whole percentage.');
      this.battery = level;
    }
  }
  class EcoCourier {
    constructor(id, cart) {
      ensure(/^ECO-[0-9]{4}$/.test(id), 'Driver ID must use ECO- followed by 4 digits.');
      this.id = id;
      this.cart = cart;
    }
  }
  function seed() {
    const vehicles = [
      { id: 'cart-01', route: 'North loop', battery: 88 },
      { id: 'cart-02', route: 'South loop', battery: 64 },
      { id: 'cart-03', route: 'Residence halls', battery: 19 },
    ];
    const packages = [
      { tracking: 'CE-20261001', destination: DESTINATIONS[0], urgent: true },
      { tracking: 'CE-20261002', destination: DESTINATIONS[4] },
      { tracking: 'CE-20261003', destination: DESTINATIONS[3] },
    ].map((data) => new Package({ ...data, weight: 4.2, length: 12, width: 8, height: 6 }));
    const driver = new EcoCourier('ECO-0417', 'cart-02');
    packages[0].claim(driver, new Vehicle(vehicles[1]));
    packages[0].advance('Loaded', driver.id);
    packages[0].advance('En Route', driver.id);
    packages[1].claim(driver, new Vehicle(vehicles[1]));
    for (const status of STATUSES.slice(1)) packages[1].advance(status, driver.id);
    return { version: 2, packages, vehicles, preferences: null, profile: null };
  }
  function hydrate(data) {
    ensure(
      data?.version === 2 && Array.isArray(data.packages) && Array.isArray(data.vehicles),
      'Unrecognized saved demo data.'
    );
    if (data.preferences)
      ensure(
        DESTINATIONS.includes(data.preferences.building) &&
          typeof data.preferences.location === 'string' &&
          ['desk', 'office', 'hub'].includes(data.preferences.method) &&
          ['hub', 'transit', 'delivered'].every(
            (key) => typeof data.preferences.notifications?.[key] === 'boolean'
          ),
        'Saved delivery preferences are invalid.'
      );
    return {
      ...data,
      packages: data.packages.map((p) => new Package(p)),
      vehicles: data.vehicles.map((v) => new Vehicle(v)),
    };
  }
  function queue(packages) {
    return packages
      .filter((p) => p.status !== 'Delivered')
      .slice()
      .sort(
        (a, b) =>
          Number(b.urgent) - Number(a.urgent) ||
          a.destination.localeCompare(b.destination) ||
          a.created.localeCompare(b.created)
      );
  }
  return { Package, Vehicle, EcoCourier, STATUSES, DESTINATIONS, seed, hydrate, queue };
});
