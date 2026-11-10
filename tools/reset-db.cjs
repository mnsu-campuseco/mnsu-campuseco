#!/usr/bin/env node
/**
 * MNSU-CampusEco — reload the demo data.
 *
 *   node tools/reset-db.cjs          (or: npm run db:reset)
 *
 * Runs db/seed.sql, which deletes every row and reinserts the Phase 2 demo
 * state. Use it before a demo or presentation: testing leaves extra packages
 * behind, and tools/smoke-test.cjs needs cart-03 back below the 20% battery
 * threshold so the battery rule is actually exercised.
 *
 * User accounts are NOT touched. They live in the users table and are created
 * by api/seed-users.php, because password_hash() has to run in PHP.
 *
 * The --default-character-set=utf8mb4 flag is not optional. Without it the
 * mysql client on Windows tags the file's bytes with the console code page and
 * every em-dash in a destination name is stored double-encoded, after which
 * every destination lookup fails with "Select a campus destination." and
 * nothing in any log says why.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'db', 'seed.sql');

const DB = process.env.CAMPUSECO_DB || 'campuseco';
const USER = process.env.CAMPUSECO_DB_USER || 'campuseco_app';
const PASSWORD = process.env.CAMPUSECO_DB_PASSWORD || 'CampusEco#Phase3';

/** mysql.exe is not on PATH in a default Windows install. */
function findMysql() {
  if (process.env.CAMPUSECO_MYSQL) return process.env.CAMPUSECO_MYSQL;

  const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['mysql'], {
    encoding: 'utf8',
  });
  if (onPath.status === 0) {
    const first = onPath.stdout.split(/\r?\n/).find((l) => l.trim());
    if (first) return first.trim();
  }

  const candidates = [
    'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe',
    'C:/Program Files/MySQL/MySQL Server 9.0/bin/mysql.exe',
    'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe',
    '/usr/bin/mysql',
    '/usr/local/bin/mysql',
    '/opt/homebrew/bin/mysql',
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

const mysql = findMysql();

if (!mysql) {
  console.error('Could not find the mysql client.');
  console.error('Set its path and try again, for example:');
  console.error('  set CAMPUSECO_MYSQL=C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe');
  process.exit(1);
}

if (!fs.existsSync(SEED)) {
  console.error(`Seed file not found: ${SEED}`);
  process.exit(1);
}

console.log(`Reloading ${DB} from db/seed.sql`);
console.log(`  client  ${mysql}`);
console.log(`  account ${USER}`);

const result = spawnSync(
  mysql,
  [`-u${USER}`, `-p${PASSWORD}`, '--default-character-set=utf8mb4', DB],
  { input: fs.readFileSync(SEED), encoding: 'utf8' }
);

if (result.error) {
  console.error(`\nCould not run the mysql client: ${result.error.message}`);
  process.exit(1);
}

// The client warns about the password on the command line on every run; that
// is expected here and is not a failure.
const noise = (result.stderr || '')
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.includes('Using a password on the command line'))
  .join('\n');

if (result.status !== 0) {
  console.error(`\nReset failed (exit ${result.status}):`);
  console.error(noise || result.stdout);
  console.error('\nIf the database does not exist yet, create it first:');
  console.error('  mysql -u root -p < db/schema.sql');
  process.exit(1);
}

if (noise) console.error(noise);

console.log('\nDemo data reloaded. Confirming what the API now sees...');

/* A reset that silently stored mis-encoded text is the failure this project
   has already been bitten by, so verify rather than trust the exit code. */
const api = process.env.CAMPUSECO_API || 'http://127.0.0.1:8080';

fetch(`${api}/api/destinations.php`)
  .then((r) => r.json())
  .then((body) => {
    const names = (body.destinations ?? []).map((d) => d.name);
    console.log(`  ${names.length} destinations`);
    for (const name of names) console.log(`    ${name}`);

    const mangled = names.filter((n) => /Ã|Ô|â€/.test(n));
    if (mangled.length > 0) {
      console.error('\nThese names are double-encoded — the charset flag did not take effect:');
      for (const n of mangled) console.error(`    ${n}`);
      process.exitCode = 1;
      return;
    }
    console.log('\nReset complete. Text encoding verified.');
  })
  .catch(() => {
    // Not a failure: the reset itself succeeded, the API just is not up.
    console.log('  (PHP API is not running, so the encoding check was skipped.)');
    console.log('\nReset complete.');
  });
