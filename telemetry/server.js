/**
 * MNSU-CampusEco — Phase 3 Node.js telemetry runtime (Task 3.2).
 *
 * A separate process from the PHP API on purpose: PHP owns durable records,
 * this owns the fast-moving signal that would be wasteful to write to MySQL
 * every two seconds. Zero dependencies — plain `http`, so it runs with
 * `node telemetry/server.js` and no install step.
 *
 *   GET  /telemetry/carts            current snapshot of every cart
 *   GET  /telemetry/stream           server-sent events, pushed every 2s
 *   GET  /telemetry/route?cart=...   the parsed route stream for one cart
 *   GET  /dispatch/alerts            alerts raised by the background task
 *   POST /dispatch/alert             raise an alert  {cart, message}
 *   GET  /health
 */
'use strict';

const http = require('http');

const PORT = Number(process.env.CAMPUSECO_TELEMETRY_PORT) || 3000;
const ALLOWED_ORIGIN = process.env.CAMPUSECO_ORIGIN || '*';
const LOW_BATTERY = 20; // matches CLAIM_BATTERY in api/db.php

/* ------------------------------------------------------------------ *
 * Simulated fleet state
 * ------------------------------------------------------------------ */

/** Each route is an ordered list of stops; the cart walks it and wraps around. */
const ROUTES = {
  'cart-01': ['Central Hub', 'Memorial Library — Array A', 'Trafton Science Center — Array B'],
  'cart-02': ['Central Hub', 'Julia Sears Hall — Array A', 'Centennial Student Union — Array A'],
  'cart-03': ['Charging Bay', 'Preska Residence Community — Array A', 'McElroy Residence Community — Array B'],
};

const carts = [
  { id: 'cart-01', route: 'North loop', battery: 88, stopIndex: 0, speedKph: 0, charging: false, updated: null },
  { id: 'cart-02', route: 'South loop', battery: 64, stopIndex: 1, speedKph: 0, charging: false, updated: null },
  { id: 'cart-03', route: 'Residence halls', battery: 19, stopIndex: 0, speedKph: 0, charging: false, updated: null },
];

const alerts = [];
const streamClients = new Set();

function snapshot() {
  return carts.map((c) => ({
    id: c.id,
    route: c.route,
    battery: Number(c.battery.toFixed(1)),
    stop: ROUTES[c.id][c.stopIndex],
    nextStop: ROUTES[c.id][(c.stopIndex + 1) % ROUTES[c.id].length],
    speedKph: c.speedKph,
    lowBattery: c.battery < LOW_BATTERY,
    charging: c.charging,
    updated: c.updated,
  }));
}

function raiseAlert(cart, message, severity = 'info') {
  const alert = { id: alerts.length + 1, cart, message, severity, at: new Date().toISOString() };
  alerts.unshift(alert);
  if (alerts.length > 50) alerts.length = 50;
  return alert;
}

/* ------------------------------------------------------------------ *
 * Background tasks
 * ------------------------------------------------------------------ */

/** High-velocity feed: drain batteries, advance along the route, push to clients. */
setInterval(() => {
  const now = new Date().toISOString();

  for (const cart of carts) {
    // A cart that runs low returns to the charging bay and comes back up, so a
    // demo left running for an hour still shows a working fleet rather than
    // three flat batteries. Drain is ~0.9%/min; charging is ~6%/min.
    if (cart.battery <= 12) cart.charging = true;
    if (cart.battery >= 95) cart.charging = false;

    if (cart.charging) {
      cart.battery = Math.min(100, cart.battery + 0.2);
      cart.speedKph = 0;
    } else {
      cart.battery = Math.max(0, cart.battery - Math.random() * 0.06);
      cart.speedKph = Number((6 + Math.random() * 10).toFixed(1));
      if (Math.random() < 0.25) {
        cart.stopIndex = (cart.stopIndex + 1) % ROUTES[cart.id].length;
      }
    }
    cart.updated = now;
  }

  const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of streamClients) client.write(payload);
}, 2000);

/** Background dispatch task: raise one alert per cart that falls below threshold. */
const warned = new Set();
setInterval(() => {
  for (const cart of carts) {
    if (cart.battery < LOW_BATTERY && !warned.has(cart.id)) {
      warned.add(cart.id);
      raiseAlert(cart.id, `${cart.id} dropped below ${LOW_BATTERY}% and cannot claim new work.`, 'warning');
    } else if (cart.battery >= LOW_BATTERY) {
      warned.delete(cart.id);
    }
  }
}, 5000);

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e5) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // Apache serves the pages and this runs on another port, so the browser
  // treats them as different origins. Without this header every fetch fails.
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;

  switch (route) {
    case 'GET /health':
      return send(res, 200, { ok: true, carts: carts.length, clients: streamClients.size });

    case 'GET /telemetry/carts':
      return send(res, 200, { ok: true, carts: snapshot(), threshold: LOW_BATTERY });

    case 'GET /telemetry/route': {
      const id = url.searchParams.get('cart');
      if (!ROUTES[id]) return send(res, 404, { ok: false, error: 'Unknown cart.' });
      const cart = carts.find((c) => c.id === id);
      return send(res, 200, {
        ok: true,
        cart: id,
        stops: ROUTES[id].map((name, i) => ({
          order: i + 1,
          name,
          current: i === cart.stopIndex,
        })),
      });
    }

    case 'GET /telemetry/stream': {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      });
      res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
      streamClients.add(res);
      req.on('close', () => streamClients.delete(res));
      return;
    }

    case 'GET /dispatch/alerts':
      return send(res, 200, { ok: true, alerts });

    case 'POST /dispatch/alert': {
      const body = await readJson(req);
      const cart = String(body.cart || '').trim();
      const message = String(body.message || '').trim().slice(0, 200);
      if (!cart || !message) {
        return send(res, 400, { ok: false, error: 'cart and message are required.' });
      }
      return send(res, 201, { ok: true, alert: raiseAlert(cart, message, 'info') });
    }

    default:
      return send(res, 404, { ok: false, error: 'Unknown endpoint.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`CampusEco telemetry listening on http://127.0.0.1:${PORT}`);
});
