# Phase 3 Technical Presentation — demo runbook

MNSU-CampusEco · Monday, November 16, 2026 · 10 minutes maximum

The professor asked for four components, progress on each, and a brief
explanation of how they work together. This runbook drives all four from one
continuous delivery, so the integration story tells itself rather than needing a
separate slide.

`docs/Presentation2.pptx` is the fallback if the demo misbehaves. Slides 11 and
12 (the verification table and the three bugs) also work as question answers.

---

## Before you leave the house

Run these in order. Budget five minutes.

```sh
npm run db:reset
```

```sh
npm run stack
```

```sh
npm run test:stack
```

Expect `55/55 checks passed`. If it passes, every component is working and the
demo will too. Then run `npm run db:reset` one last time, so the fresh seed
state is what the class sees and `cart-03` is back at 19%.

If `npm run stack` reports a port in use, it prints the PID and the `taskkill`
command. Do that and run it again.

### Read this before you set the tabs up

**One browser holds one session.** The PHP session cookie is per browser, not
per tab, so signing in as `courier1` signs `operator1` *out* — and the operator
tab then gets a 403 the moment you try to check another package in. That is the
role guard working correctly, but it will look like a broken demo if you hit it
live in front of the class.

So use **two windows with separate cookie jars**:

| Window | Tabs | Signed in as |
| --- | --- | --- |
| **Normal window** | landing page, Hub Operator | `operator1` |
| **Private / incognito window** | Eco-Transit Crew | `courier1` |

Both passwords are `CampusEco2026`. The Campus End-User page needs **no account
at all** — tracking is public by design — so open it in either window.

If you would rather use one window, that works too, but you must run the demo
strictly in order and never go back: operator → sign out → courier → end-user.
Decide which way you are doing it *before* Monday and practise that way.

**Tabs to have open:**

| Window | Tab | URL |
| --- | --- | --- |
| normal | 1 | http://127.0.0.1:8080/index.html |
| normal | 2 | http://127.0.0.1:8080/pages/operator-live.html |
| private | 3 | http://127.0.0.1:8080/pages/courier-live.html |
| either | 4 | http://127.0.0.1:8080/pages/enduser-live.html |
| either | 5 | http://127.0.0.1:3000/telemetry/carts |

Tab 5 is raw JSON straight from the Node runtime — the fastest way to prove
component 2 is a real server and not a mock.

Sign in ahead of time in both windows. Signing in live costs 40 seconds and
risks a typo.

---

## The ten minutes

### 0:00 – 1:30 · Framing (slides 1–3)

Name the four components and say where each one lives. One sentence each.

The line that matters: **in Phase 2 the browser decided, in Phase 3 the server
decides.** Everything after this is a demonstration of that sentence.

### 1:30 – 3:00 · Components 4 and 3 (slides 4–5)

Database first, because the other three depend on its shape.

- Eight tables. `destinations`, `couriers`, `vehicles`, `transit_events` and
  `receipts` are all split out of `packages` — that is the normalisation.
- The business rules are **constraints**, not code: `UNIQUE` on
  `packages.tracking` is what stops a duplicate check-in; `UNIQUE` on
  `receipts.package_id` is what stops a package being signed for twice;
  `CHECK` bounds the weight, the dimensions and the battery.
- Then PHP: nine endpoints, PDO prepared statements with emulation off,
  `password_hash`/`password_verify`, role guards, and `FOR UPDATE` on the
  claim path.

### 3:00 – 7:00 · Components 1 and 2, live

This is the demo. One package, start to finish.

**Tab 2 — Hub Operator (component 1).** Check a package in. Point out that the
destination dropdown is `ng-options` over a list fetched from the
`destinations` table, not hard-coded markup.

Then check the *same tracking number* in again. It is refused — and say clearly
that the refusal came from the `UNIQUE` index in MySQL, not from JavaScript.

**Tab 5 — the Node runtime (component 2).** Reload it once or twice so the class
sees the battery numbers move. This is `telemetry/server.js`: zero dependencies,
a background task driving battery drain and charging, and a server-sent-events
stream. Say why there are two backends: PHP owns the durable records, Node owns
the live feed, because a stream of cart positions has no business going through
a request-response API.

**Tab 3 — Eco-Transit Crew (component 1 + 2 + 3 + 4 in one action).** This is
the **private window**, already signed in as `courier1`. Try to claim with
`cart-03` at 19%. Refused. Switch to `cart-01` at 88%. Accepted.

That single click is the integration answer, so say it out loud: Angular read
the battery from the Node runtime, posted JSON to PHP, which opened a
transaction, locked the rows `FOR UPDATE`, re-checked the battery against the
database's own value, and wrote the assignment. Two couriers racing resolve to
one winner because the database decides.

Advance **Loaded → En Route → Delivered**. Then try to skip a step, or use
driver `ECO-9999`. Both refused by `api/milestones.php`.

**Tab 4 — Campus End-User.** Track the number. The history is the
`transit_events` audit trail read back out of MySQL. Sign for it. Sign again —
refused by the `UNIQUE` index.

> The timeline shows **At hub** twice: once for the check-in, once for the claim.
> That is intentional and the notes distinguish them ("Received at central hub",
> "Claimed by ECO-0417 · cart-01"). A claim genuinely happens while the package
> is still at the hub, and `transit_events` is an audit log rather than one row
> per status. Worth saying before anyone asks.

### 7:00 – 8:30 · How they work together (slide 10)

Trace the claim through all four components on the diagram. You have just done
it live, so this is the recap, not the explanation.

Then the honest part: the rules exist **twice** — in `js/models.js` for instant
feedback, and on the server where the decision is made. That is deliberate, and
the trade-off is that a future rule change has to be made in both places.

### 8:30 – 9:30 · Verification (slide 11)

`npm run test:stack` — 55 checks across all four components. Say that the nine
negative tests were also run *directly against MySQL using the application
account*, so the constraints hold even when PHP is bypassed entirely.

If there is a laptop on the projector, just run it. It takes a few seconds and
`55/55 checks passed` is a better claim than a slide saying "we tested it".

### 9:30 – 10:00 · Close (slide 13)

What is left for Production Verification: a Playwright suite against the
full-stack pages, recipient accounts so tracking is scoped to the owner, and
swapping the courier portal's telemetry polling for the SSE stream.

---

## If something breaks

| Symptom | Cause | Fix |
| --- | --- | --- |
| Page loads, every number is blank | PHP is not running, or MySQL is stopped | `npm run stack`; check `net start MySQL80` |
| "Select a campus destination" on a valid pick | Seed loaded without utf8mb4, em-dashes double-encoded | `npm run db:reset` |
| Cart list empty, batteries missing | Node runtime is not running | `npm run stack` |
| New server dies instantly | Stale server still holds the port | `npm run stack` prints the PID and the `taskkill` command |
| Every cart is above 20%, battery rule cannot be shown | Earlier testing moved the batteries | `npm run db:reset` puts `cart-03` back to 19% |
| Red 4xx lines in the browser console | Correct REST behaviour on a refusal path | Nothing. Say so if asked — a refused rule returns 409, and that is the point |
| Operator page suddenly returns 403 on check-in | You signed in as `courier1` in the same browser, which replaced the operator session | Use two windows (see above). Live recovery: sign in as `operator1` again |

## Division of the ten minutes

Four presenters, if everyone speaks:

| Who | Section |
| --- | --- |
| Framing and component 4 (database) | slides 1–4 |
| Component 3 (PHP) | slide 5 |
| Components 1 and 2 (the live demo) | the four tabs |
| Integration, verification, close | slides 10–13 |

Whoever drives the browser should not also be the one explaining — one person on
the keyboard, one person talking, or the demo stalls while the speaker clicks.
