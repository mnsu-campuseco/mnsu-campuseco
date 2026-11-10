#!/usr/bin/env node
/**
 * MNSU-CampusEco — start the whole Phase 3 stack.
 *
 *   node tools/stack.cjs             (or: npm run stack)
 *
 * Phase 3 needs three things running at once, and a demo fails in a confusing
 * way if any of them is missing:
 *
 *   MySQL                 the data and the constraints
 *   PHP   on :8080        the API, and it also serves the pages
 *   Node  on :3000        the cart telemetry runtime
 *
 * Starting them by hand went wrong the same way more than once: a server left
 * running from an earlier session still held the port, the new one died with
 * EADDRINUSE, and the page kept loading against the stale process. So this
 * script checks both ports BEFORE starting anything and says plainly what it
 * found, rather than letting a half-started stack look like a working one.
 *
 * Ctrl-C stops both servers.
 */
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PHP_PORT = Number(process.env.CAMPUSECO_PHP_PORT || 8080);
const NODE_PORT = Number(process.env.CAMPUSECO_NODE_PORT || 3000);

/* ------------------------------------------------------------------ *
 * Locating PHP — it is not on PATH after a winget install
 * ------------------------------------------------------------------ */
function findPhp() {
  if (process.env.CAMPUSECO_PHP) return process.env.CAMPUSECO_PHP;

  const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['php'], {
    encoding: 'utf8',
  });
  if (onPath.status === 0) {
    const first = onPath.stdout.split(/\r?\n/).find((l) => l.trim());
    if (first) return first.trim();
  }

  const winget = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft/WinGet/Packages/PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe/php.exe'
  );
  const candidates = [
    winget,
    'C:/php/php.exe',
    'C:/xampp/php/php.exe',
    '/usr/bin/php',
    '/usr/local/bin/php',
  ];
  return candidates.find((c) => c && fs.existsSync(c)) ?? null;
}

/** Resolves to the PID holding the port, or null if it is free. */
function portHolder(port) {
  if (process.platform !== 'win32') return null;
  const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
  if (out.status !== 0) return null;

  for (const line of out.stdout.split(/\r?\n/)) {
    // Match the local-address column exactly, so :3000 does not match :30000.
    if (/LISTENING/.test(line) && new RegExp(`[:.]${port}\\s`).test(line)) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== '0') return pid;
    }
  }
  return null;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

function processName(pid) {
  if (process.platform !== 'win32') return '';
  const out = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
    encoding: 'utf8',
  });
  const first = (out.stdout || '').split(/\r?\n/).find((l) => l.includes('"'));
  return first ? first.split('","')[0].replace(/^"/, '') : '';
}

/* ------------------------------------------------------------------ *
 * Preflight
 * ------------------------------------------------------------------ */
async function preflight() {
  let blocked = false;

  console.log('MNSU-CampusEco — Phase 3 stack\n');

  // MySQL
  if (process.platform === 'win32') {
    const svc = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-Service -Name 'MySQL*' | Select-Object -First 1 -ExpandProperty Status",
      ],
      { encoding: 'utf8' }
    );
    const status = (svc.stdout || '').trim();
    if (status === 'Running') {
      console.log('  MySQL      running');
    } else if (status) {
      console.log(`  MySQL      ${status}  <-- start it: net start MySQL80`);
      blocked = true;
    } else {
      console.log('  MySQL      could not read the service state (continuing)');
    }
  }

  for (const [label, port] of [
    ['PHP', PHP_PORT],
    ['Node', NODE_PORT],
  ]) {
    const free = await isPortFree(port);
    if (free) {
      console.log(`  :${port}      free`);
      continue;
    }
    const pid = portHolder(port);
    const name = pid ? processName(pid) : '';
    console.log(
      `  :${port}      IN USE by PID ${pid ?? '?'}${name ? ` (${name})` : ''}  <-- ${label} cannot start`
    );
    console.log(`               stop it with:  taskkill /PID ${pid} /F`);
    blocked = true;
  }

  if (blocked) {
    console.log('\nFix the above and run this again. Nothing was started,');
    console.log('so you are not left with half a stack running.');
    process.exit(1);
  }
  console.log('');
  return true;
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */
async function main() {
  const php = findPhp();
  if (!php) {
    console.error('Could not find php. Set its path, for example:');
    console.error('  set CAMPUSECO_PHP=C:\\php\\php.exe');
    process.exit(1);
  }

  await preflight();

  const children = [];

  function start(label, command, args) {
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push({ label, child });

    const relay = (stream) => {
      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) if (line.trim()) console.log(`[${label}] ${line}`);
      });
    };
    relay(child.stdout);
    relay(child.stderr);

    child.on('exit', (code) => {
      console.log(`[${label}] exited with code ${code}`);
      shutdown(code ?? 1);
    });
    return child;
  }

  console.log(`Starting PHP   ${php}`);
  start('php', php, ['-S', `127.0.0.1:${PHP_PORT}`, '-t', ROOT]);

  console.log(`Starting Node  telemetry/server.js`);
  start('node', process.execPath, [path.join(ROOT, 'telemetry', 'server.js')]);

  console.log('');
  console.log('  Landing page   http://127.0.0.1:' + PHP_PORT + '/index.html');
  console.log('  Hub Operator   http://127.0.0.1:' + PHP_PORT + '/pages/operator-live.html');
  console.log('  Eco-Transit    http://127.0.0.1:' + PHP_PORT + '/pages/courier-live.html');
  console.log('  Campus User    http://127.0.0.1:' + PHP_PORT + '/pages/enduser-live.html');
  console.log('');
  console.log('  Verify it all works:  npm run test:stack');
  console.log('  Reload demo data:     npm run db:reset');
  console.log('');
  console.log('Ctrl-C to stop both servers.');

  let stopping = false;
  function shutdown(code) {
    if (stopping) return;
    stopping = true;
    for (const { child } of children) {
      if (!child.killed) child.kill();
    }
    process.exit(code);
  }

  process.on('SIGINT', () => {
    console.log('\nStopping...');
    shutdown(0);
  });
  process.on('SIGTERM', () => shutdown(0));
}

main();
