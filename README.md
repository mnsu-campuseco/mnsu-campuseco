# MNSU-CampusEco — Smart Logistics System

CIS 483 · Fall 2026 · Minnesota State University, Mankato

## Group members

1. Misgana Kebede (@Misgexx)
2. Clement Mbuyi (@Clementmbuyi)
3. Yonatan Alemayehu (@Yoni062004)
4. Emran Abatemam (@emran0973)

## Phases in this repository

| Phase                        | What it is                                                                 | Tag       |
| ---------------------------- | -------------------------------------------------------------------------- | --------- |
| 1 — Static UI                | HTML5 and CSS only. No JavaScript.                                          | `phase-1` |
| 2 — Interactive frontend     | JavaScript models, jQuery, responsive CSS, `localStorage` persistence.      | `phase-2` |
| 3 — Full stack               | PHP + MySQL API, AngularJS client, Node telemetry runtime. No browser storage. | `phase-3` |

Both the Phase 2 and the Phase 3 portals are kept and linked from the landing
page. They run the same three workflows: Phase 2 enforces its rules in the
browser, Phase 3 enforces them on the server. Opening the two side by side is
the clearest way to see what changed.

---

# Phase 3 — running the full stack

## Prerequisites

- **MySQL 8.0** running locally
- **PHP 8.1+** with the `pdo_mysql` and `mbstring` extensions
- **Node.js 18+**

XAMPP is not required and is best avoided here: it ships its own MySQL, which
collides with an existing MySQL service on port 3306. A standalone PHP install
and its built-in server are enough.

Install PHP on Windows with `winget install --id PHP.PHP.8.3 -e`. If the install
has no `php.ini`, create one next to `php.exe` containing:

```ini
extension_dir = "ext"
extension=pdo_mysql
extension=mbstring
display_errors = On
date.timezone = America/Chicago
```

Confirm with `php -m` — `pdo_mysql` and `mbstring` must be listed.

## 1. Create the database

```sh
mysql -u root -p --default-character-set=utf8mb4 < db/schema.sql
mysql -u root -p --default-character-set=utf8mb4 campuseco < db/seed.sql
```

`--default-character-set=utf8mb4` matters. The campus destination names contain
em-dashes; without it the Windows client hands the file's UTF-8 bytes to the
server tagged as the console code page and every name is stored double-encoded,
which makes every destination lookup fail. `seed.sql` also sets `SET NAMES
utf8mb4` so a client that forgets the flag still loads correctly.

`schema.sql` creates the application account `campuseco_app` with `SELECT`,
`INSERT`, `UPDATE` and `DELETE` on this database only. The API never connects
as root.

## 2. Create the demo accounts

```sh
php api/seed-users.php
```

Passwords are hashed with `password_hash(PASSWORD_BCRYPT)`, which is why they
are created by a PHP script rather than written into `seed.sql`.

| Username    | Role     | Password        |
| ----------- | -------- | --------------- |
| `operator1` | operator | `CampusEco2026` |
| `courier1`  | courier  | `CampusEco2026` |
| `student1`  | enduser  | `CampusEco2026` |

These are demonstration accounts for a local marking environment, not secrets.

## 3. Start both servers

```sh
npm run stack
```

That starts PHP on `:8080` and the Node telemetry runtime on `:3000`, and prints
the four page links. Open **http://127.0.0.1:8080**. Ctrl-C stops both.

It checks both ports before starting anything. A server left running from an
earlier session keeps its port, and the replacement dies with `EADDRINUSE` while
the browser carries on talking to the stale process — which looks exactly like a
working stack until the data is wrong. If a port is held, the script names the
PID and the `taskkill` command and starts nothing, rather than leaving half a
stack up.

To start them by hand instead, in two terminals:

```sh
php -S 127.0.0.1:8080 -t .
```

```sh
node telemetry/server.js
```

If the database password differs from the default in `db/schema.sql`, set
`CAMPUSECO_DB_PASS` before starting PHP. `npm run stack` also honours
`CAMPUSECO_PHP`, `CAMPUSECO_PHP_PORT` and `CAMPUSECO_NODE_PORT`.

## 4. Verify the stack

```sh
npm run test:stack
```

55 checks against the running stack, covering all four Phase 3 components: the
three AngularJS pages are served and bootstrap, the Node runtime answers and
survives ten concurrent requests, the PHP API authenticates and validates, and
the database refuses what it should refuse. It runs one complete delivery
end to end and then attempts every rule violation Phase 2 enforced in the
browser — with the browser removed from the picture.

Reload the demo data at any time:

```sh
npm run db:reset
```

Run that before a demo. Testing leaves extra packages behind, and the reset puts
`cart-03` back below the 20% battery threshold so the claim rule can be shown
being refused. The reset verifies its own text encoding afterwards, because
loading the seed without `--default-character-set=utf8mb4` silently stores every
em-dash double-encoded and then every destination lookup fails for no visible
reason.

## Try a complete delivery, server-backed

1. **Hub Operator** → sign in as `operator1`. Check a package in. A duplicate
   tracking number is refused by the `UNIQUE` index, not by JavaScript.
2. **Eco-Transit Crew** → sign in as `courier1`, driver `ECO-0417`. Try to claim
   with `cart-03` (19%): the server refuses. Switch to `cart-01` (88%) and claim.
3. Advance **Loaded → En Route → Delivered**. Skipping a step or using another
   driver's ID is refused by `api/milestones.php`.
4. **Campus End-User** → track the same number. The history is the
   `transit_events` audit trail read from MySQL. Sign once; a second signature is
   refused by the `UNIQUE` index on `receipts.package_id`.
5. Restart PHP, MySQL, Node and the browser. Everything is still there, because
   nothing lives in the browser any more.

Seed examples: `CE-20261001` is en route, `CE-20261002` is delivered and ready
for sign-off, `CE-20261003` is unclaimed. Reload demo data at any time with
`mysql -u campuseco_app -p --default-character-set=utf8mb4 campuseco < db/seed.sql`.

## The four presentation components

The Phase 3 In-Class Technical Presentation (Monday, November 16) asks each group
to address four components. Where each one lives:

| # | Component                                       | Where it is                                                        | What to show                                                                                           |
| - | ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 1 | **Frontend** — Angular or React                 | `js/angular-app.js`, `js/vendor/angular.min.js`, `pages/*-live.html` | AngularJS 1.8.3. Module `campusEco`, two factories, four controllers. `ng-model`, `ng-repeat`, `ng-options` |
| 2 | **Node.js backend** — Node server               | `telemetry/server.js`                                              | Zero dependencies. Cart snapshots, an SSE stream, parsed route streams, a dispatch alert queue, a background battery task |
| 3 | **Backend server** — PHP or C#                  | `api/*.php` (11 files)                                             | PHP 8.3 + PDO. Nine endpoints, bcrypt auth, role guards, transactions with `FOR UPDATE`                 |
| 4 | **Relational database** — design and implementation | `db/schema.sql`, `db/seed.sql`                                  | MySQL 8.0. Eight normalised tables, `UNIQUE`/`CHECK`/FK constraints enforcing the business rules        |

**How they work together** — one claim traces through all four. The courier
picks a cart in the AngularJS portal (1), whose live battery reading came from
the Node runtime (2). Submitting posts JSON to `api/claims.php` (3), which opens
a transaction, locks the cart and package rows `FOR UPDATE`, re-checks the
battery against the database's own value, and writes the assignment plus an
audit row (4). Two couriers racing for the same package resolve to one winner,
because the decision is made in the database and not in either browser.

A ten-minute walkthrough is in [`docs/demo-runbook.md`](docs/demo-runbook.md).

## Phase 3 requirement map

| Requirement                           | Implementation                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 3.1 Asynchronous AJAX & JSON          | Every read and write is an `$http` call carrying JSON (`js/angular-app.js`). `localStorage` is not used by the Phase 3 pages |
| 3.2 Node.js server runtime            | `telemetry/server.js` — cart snapshot, SSE stream, parsed route streams, dispatch alert queue, background battery task       |
| 3.3 AngularJS data binding            | `ng-model` on every form field, `ng-repeat` for logs and queues, `ng-options` for server-supplied dropdowns                 |
| 3.4 PHP relational engine             | `api/*.php` over MySQL: prepared statements, bcrypt, role checks, transactions with `FOR UPDATE`                            |
| Normalisation                         | `destinations`, `couriers`, `vehicles`, `transit_events` and `receipts` split out of `packages` (`db/schema.sql`)            |
| Verification                          | `npm run test:stack` — 55 checks across all four components against the running stack (`tools/smoke-test.cjs`)              |
| Progress Report 3                     | `docs/progress-report-3.md`                                                                                                 |

## API endpoints

| Endpoint                 | Methods | Purpose                                                  |
| ------------------------ | ------- | -------------------------------------------------------- |
| `api/auth.php`           | GET/POST | `?action=` `me`, `login`, `logout`, `register`           |
| `api/packages.php`       | GET/POST | Tracking log with search and status filters; check-in    |
| `api/claims.php`         | POST    | Claim a delivery (battery threshold, single assignment)  |
| `api/milestones.php`     | POST    | Advance status (ownership, sequence)                     |
| `api/track.php`          | GET     | One package plus its `transit_events` history            |
| `api/receipts.php`       | POST    | Electronic sign-off, one per package                     |
| `api/fleet.php`          | GET/POST | Cart list; report a battery level                       |
| `api/metrics.php`        | GET     | Delivered count, km, avoided CO₂                         |
| `api/destinations.php`   | GET     | Campus destinations for the check-in dropdown            |

The Node runtime answers on port 3000: `/telemetry/carts`, `/telemetry/stream`
(server-sent events), `/telemetry/route?cart=`, `/dispatch/alerts`,
`/dispatch/alert`, `/health`.

## Security notes

- PDO with `ATTR_EMULATE_PREPARES => false`, so values are sent to MySQL
  separately from the SQL text and the prepared statements are genuine rather
  than interpolated by PDO.
- `password_hash(PASSWORD_BCRYPT)` and `password_verify()`. A plain password is
  never stored, logged or compared with `==`. Login returns the same message for
  an unknown username and a wrong password.
- `session_regenerate_id(true)` on login, against session fixation.
- Rules are server-side: the browser keeps its copy for instant feedback, but
  `api/claims.php` and `api/milestones.php` decide. Claims lock the cart and the
  package row `FOR UPDATE`, so two couriers racing for the same package resolve
  to one winner.
- The API returns real HTTP status codes — 401 unauthenticated, 403 wrong role,
  404 unknown, 409 rule violation. The browser console logs a 4xx as a red line,
  which is expected on an error path and is not a JavaScript error.

---

# Phase 2 — browser-only build

```sh
npm install
npm start
```

Open **http://127.0.0.1:4173**. Keep every portal on the same hostname and port
to share browser storage, and use HTTP rather than opening files directly. The
Node script here is a development static-file server, not an application
backend; Phase 2 data stays in the browser.

## Phase 2 requirement map

| Requirement                               | Implementation                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 2.1 JavaScript objects, functions, events | `Package`, `Vehicle`, `EcoCourier` in `js/models.js`; handlers and rendering in `js/app.js`                              |
| Local persistence                         | Versioned JSON in localStorage; tab-specific shift in sessionStorage; hydration; storage events                          |
| 2.2 Official compressed jQuery            | Local distribution, selectors, delegated clicks, dynamic tracking rows, sliding options, animated cart marker            |
| 2.3 Mobile-first media queries            | Shared responsive CSS; desktop dashboard columns, mobile courier cards, wrapped navigation, scrollable tables            |
| Progress Report 2                         | [Report](docs/progress-report-2.md)                                                                                      |
| Technical Presentation 1                  | [Browser slide deck](docs/presentation.html), [presenter notes](docs/presentation-notes.md)                              |

## Verify

```sh
npm test            # model unit tests
npm run test:browser # Playwright, Phase 2 pages
```

Browser tests use installed Google Chrome. If unavailable, run
`npx playwright install chromium` and remove `channel: 'chrome'` from
`playwright.config.cjs`. The browser suite covers the Phase 2 pages; it was not
changed in Phase 3, which is why those pages were kept rather than rewritten.

---

## Source structure

```text
index.html                          Landing page, links both phases
pages/{operator,courier,enduser}.html        Phase 2 portals (browser storage)
pages/{operator,courier,enduser}-live.html   Phase 3 portals (server-backed)
css/main.css                        Campus theme and base styles (Phase 1)
css/phase2.css                      Shared responsive layouts
css/phase3.css                      Full-stack additions
css/{operator,courier,enduser}.css  Portal-specific details
js/models.js                        Domain models and validation
js/app.js                           Phase 2 storage, jQuery events, rendering
js/angular-app.js                   Phase 3 AngularJS module, API factories
js/vendor/                          Official minified jQuery and AngularJS
api/                                PHP endpoints and data access
db/schema.sql, db/seed.sql          Relational schema and demo data
telemetry/server.js                 Node telemetry runtime
tools/serve.cjs                     Phase 2 development static server
tests/                              Model and browser tests
docs/                               Reports, slides, presenter notes
```

## Demo boundaries

Delivery routing is not geographic optimisation; the queue sorts urgent first,
then by destination. Carbon figures are an illustration at a disclosed rate of
0.20 kg of CO₂ avoided per km, computed from the packages table rather than kept
as a running total. Notifications are in-app, not email. Use fictional personal
details throughout.

Accounts are real in the sense that passwords are hashed and roles are enforced,
but they are seeded demonstration accounts on a local database. The system has
not been deployed or load-tested, and the Node telemetry feed is simulated
rather than read from real hardware.

## Submission

Phase 3 is due **Monday, November 9, 2026**, with Progress Report 3 and
Technical Presentation 2 in class. Submit once per group through D2L with the
[repository link](https://github.com/mnsu-campuseco/mnsu-campuseco). Document
individual contributions from actual work and commit history.
