# CIS 483 Progress Report 3 — Phase 3 Server Backends & Live Endpoints

MNSU-CampusEco | November 9, 2026

## 1 Report header

| Item                     | Details                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| Group name / number      | MNSU-CampusEco                                                              |
| Members (full names)     | Yonatan Alemayehu; Misgana Kebede; Clement Mbuyi; Emran Abatemam            |
| Course                   | CIS 483                                                                     |
| Progress Report #        | 3                                                                           |
| Phase                    | Phase 3 — Server Backends & Live Endpoints                                  |
| Report date              | November 9, 2026                                                            |
| GitHub repository link   | github.com/mnsu-campuseco/mnsu-campuseco                                    |
| Checkpoint commit or tag | `phase-3`                                                                   |

The Phase 2 portals ran entirely in the browser: the dataset lived in
`localStorage` and every business rule was a JavaScript check. Phase 3 moves the
data into MySQL and the rules onto the server. A PHP API owns the durable
records, a Node runtime supplies live cart telemetry, and an AngularJS client
binds the forms to those endpoints over AJAX. Nothing the Phase 3 pages rely on
is stored in the browser.

The Phase 2 build is kept and still works. Both versions are linked from the
landing page so the same three workflows can be compared with the rules in the
browser and with the rules on the server.

## 2 Work completed this phase

| Item                             | What we implemented and source files                                                                                                                                                 | Status |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Relational storage engine        | `db/schema.sql` — eight normalised tables. `destinations`, `couriers`, `vehicles`, `transit_events` and `receipts` are split out of `packages`. `db/seed.sql` reproduces the Phase 2 seed state. | Done   |
| Server-enforced business rules   | `UNIQUE` on `packages.tracking` and on `receipts.package_id`; `CHECK` constraints bound weight, dimensions, battery and the `ECO-####` driver format.                                  | Done   |
| PHP data access                  | `api/db.php` — PDO with `ATTR_EMULATE_PREPARES => false`, shared JSON helpers, role guards, and one `PACKAGE_SELECT` every read shares.                                               | Done   |
| Authentication                   | `api/auth.php` — `password_hash(PASSWORD_BCRYPT)`, `password_verify()`, `session_regenerate_id(true)`, identical failure message for unknown user and wrong password.                 | Done   |
| REST endpoints                   | `packages`, `claims`, `milestones`, `track`, `receipts`, `fleet`, `metrics`, `destinations`. JSON in, JSON out, real HTTP status codes.                                               | Done   |
| Transactional claiming           | `api/claims.php` locks the cart and package rows `FOR UPDATE`, so two couriers racing for one package resolve to a single winner.                                                     | Done   |
| Asynchronous AJAX & JSON         | `js/angular-app.js` — every read and write is an `$http` call carrying JSON. The Phase 3 pages use no browser storage.                                                                | Done   |
| AngularJS data binding           | `ng-model` on every field, `ng-repeat` for logs and queues, `ng-options` for the server-supplied destination list. AngularJS 1.8.3 vendored beside jQuery.                            | Done   |
| Node.js runtime                  | `telemetry/server.js` — zero dependencies. Cart snapshot, server-sent-events stream, parsed route streams, dispatch alert queue, background battery task.                              | Done   |
| Full-stack portals               | `pages/operator-live.html`, `courier-live.html`, `enduser-live.html`; `css/phase3.css` extends the Phase 1 theme and keeps the mobile-first rules.                                     | Done   |

### Verification

Every rule was exercised against the running PHP API and a live MySQL database,
not asserted from reading the code:

| Check                                       | Result                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| Check in a package                          | Stored, returned `At hub`                               |
| Duplicate tracking number                   | Refused, 409 — "already checked in"                     |
| Weight 900 kg                               | Refused, 400                                            |
| Claim on `cart-03` at 19%                   | Refused — "at least 20% battery"                        |
| Claim on `cart-01` at 88%                   | Accepted                                                |
| Second claim on the same package            | Refused, 409 — "already assigned"                       |
| Skip straight to `Delivered`                | Refused, 409 — sequence enforced                        |
| Advance using another driver's ID           | Refused, 403 — ownership enforced                       |
| `Loaded` → `En Route` → `Delivered`         | All three accepted in order                             |
| Sign for a delivered package                | Receipt recorded                                        |
| Second signature on the same package        | Refused, 409 — `UNIQUE` constraint                      |
| Check in while signed out                   | 401                                                     |
| Wrong password                              | 401, same message as an unknown username                |
| Unknown tracking number                     | 404                                                     |

Nine negative tests were also run directly against MySQL with the application
account: duplicate tracking, malformed tracking, weight above 150, dimension
above 60, unknown destination, battery above 100, malformed driver ID, invalid
transit status, and a second receipt. All nine were rejected by the database
itself rather than by application code.

The Node runtime was checked separately: ten concurrent requests all returned
200, the SSE stream pushed updates every two seconds, and the background task
raised its own low-battery alert when a cart crossed the threshold.

These checks are now automated and repeatable as `npm run test:stack`
(`tools/smoke-test.cjs`): **55 checks, all passing**, grouped by the four
components. It runs one complete delivery over HTTP and then attempts every rule
Phase 2 enforced in the browser, with the browser removed entirely — so it tests
the server's decisions rather than the client's. A Phase 2-style test that only
loaded `js/models.js` would prove nothing about Phase 3, because the rules no
longer live there.

The Phase 2 model suite still passes (`npm test`, 4/4), and the Phase 2 browser
suite is unchanged because the Phase 2 pages were not modified.

Two supporting scripts were added for the presentation. `npm run stack` starts
PHP and Node together, but checks both ports first: a server left running from
an earlier session keeps its port, the replacement dies with `EADDRINUSE`, and
the browser carries on talking to the stale process, which looks like a working
stack until the data is wrong. `npm run db:reset` reloads the seed and then
verifies its own text encoding, because the em-dash defect below produced no
error of any kind.

## 3 Problems and next steps

| Problem or limitation                                                                                                                                           | Solution or next step                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading `seed.sql` on Windows stored every em-dash double-encoded, so every destination lookup failed with "Select a campus destination."                         | Added `SET NAMES utf8mb4` to the file and documented the `--default-character-set=utf8mb4` flag. Fixed and verified at the byte level.              |
| `TRUNCATE` in the seed required the `DROP` privilege, which the application account does not hold, so reseeding needed root.                                     | Switched to `DELETE`, which works within the grants `campuseco_app` already has.                                                                   |
| Cart batteries drained about 12% per minute, so a runtime left running before a demo showed three flat carts.                                                    | Drain reduced to roughly 0.9% per minute, with a charging cycle so the fleet recovers and still crosses the threshold often enough to demonstrate. |
| Apache/PHP and the Node runtime are different origins, so the browser blocks the telemetry request by default.                                                   | The Node runtime sends `Access-Control-Allow-Origin`; the allowed origin is configurable through `CAMPUSECO_ORIGIN`.                                |
| The API returns 4xx codes for rule violations, which the browser console logs in red on error paths.                                                             | This is correct REST behaviour rather than a JavaScript error, and is documented in the README so it is not mistaken for a defect.                 |
| Phase 3 verification was manual against the running stack, so nothing stopped a regression between runs.                                                         | Automated as `npm run test:stack` — 55 checks over HTTP across all four components. A Playwright suite driving the pages themselves is still outstanding and is planned for Production Verification. |
| A stale server from an earlier session kept its port, so the replacement died with `EADDRINUSE` while the browser kept talking to the old process.               | `npm run stack` checks both ports before starting anything, names the holding PID, and starts nothing rather than leaving half a stack up.          |
| Rules are duplicated — once in `js/models.js` for instant feedback, once on the server.                                                                          | Deliberate: the browser copy is a convenience and the server is authoritative. Any future rule change must be made in both places.                 |

### Planned work for Production Verification (Nov 10 – Nov 29)

| Planned                                                                     | Proposed owner     |
| --------------------------------------------------------------------------- | ------------------ |
| Playwright suite against the full-stack pages, with database reset fixtures | Misgana Kebede     |
| Recipient accounts linked to packages so tracking is scoped to the owner    | Emran Abatemam     |
| Replace telemetry polling with the SSE stream in the courier portal         | Clement Mbuyi      |
| Deployment notes, final checkpoint, documentation and submission            | Yonatan Alemayehu  |

## 4 Team contributions

| Member             | Phase 3 scope                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yonatan Alemayehu  | Phase 3 implementation and integration: relational schema and seed, PHP data access and authentication, all REST endpoints, the AngularJS client, the Node telemetry runtime, the three full-stack portals, `phase3.css`, README, and this report. |
| Misgana Kebede     | Phase 2 implementation (committed as `9920b53`); Phase 3 review of the Hub Operator endpoints and check-in validation.                             |
| Clement Mbuyi      | Phase 1 Eco-Transit Crew portal; Phase 3 review of claiming, milestone order and the fleet endpoints.                                              |
| Emran Abatemam     | Phase 1 Campus End-User portal; Phase 3 review of tracking, receipts and carbon metrics.                                                           |

The team should confirm these attributions against the commit history before
submission and correct anything that does not match.

## 5 Submission

The Phase 3 implementation is complete and tagged `phase-3`. The **Phase 3
In-Class Technical Presentation is Monday, November 16, 2026**, covering the four
required components: the Angular frontend, the Node.js backend, the PHP backend
server, and the relational database design and implementation.

Presentation materials are `docs/Presentation2.pptx` (13 slides) with a
ten-minute walkthrough in `docs/demo-runbook.md`. One member submits this report,
the presentation materials and the repository link through D2L. Setup
instructions for a marker starting from an empty database are in the README.
