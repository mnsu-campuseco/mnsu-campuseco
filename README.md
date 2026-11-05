# MNSU-CampusEco — Smart Logistics System

CIS 483 · Fall 2026 · Minnesota State University, Mankato

## Group members

1. Misgana Kebede (@Misgexx)
2. Clement Mbuyi (@Clementmbuyi)
3. Yonatan Alemayehu (@Yoni062004)
4. Emran Abatemam (@emran0973)

## Run Phase 2

With Node.js installed:

```sh
npm install
npm start
```

Open **http://127.0.0.1:4173**. VS Code Live Server also works. Keep every portal on the same hostname and port to share browser storage. Use HTTP rather than opening files directly.

The Node script is a development static-file server, not a Phase 3 application backend. Application data stays in the browser. Official minified jQuery 3.7.1 is bundled locally; the running frontend does not depend on a CDN.

## Try a complete delivery

1. In **Hub Operator**, check in `CE-20261004` with measurements and a destination. Duplicate tracking numbers are rejected.
2. Open **Eco-Transit Crew**. Start `ECO-1234` with `cart-01`; battery fills automatically. Carts need at least 20% battery to claim new deliveries.
3. Claim the package and update **Loaded → En Route → Delivered**. Only its assigned driver can update it. Complete active deliveries before switching carts or ending a shift.
4. In **Campus End-User**, track the same number and sign receipt with a fictional name.
5. Refresh to verify persistence. Keep another portal tab open to see storage events synchronize updates.

Seed examples: `CE-20261001` is en route with `ECO-0417` / `cart-02`; `CE-20261002` is delivered and ready for sign-off; `CE-20261003` is unclaimed. **Reset demo… → Restore sample data** restores examples. Reset affects only this application's data and the current tab's shift.

## Phase 2 requirement map

| Requirement                               | Implementation                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2.1 JavaScript objects, functions, events | `Package`, `Vehicle`, `EcoCourier` in `js/models.js`; handlers/rendering in `js/app.js`                                   |
| Local persistence                         | Versioned JSON in localStorage; tab-specific shift in sessionStorage; hydration; storage events                           |
| 2.2 Official compressed jQuery            | Local distribution, selectors, delegated clicks, dynamic tracking rows, sliding options, animated cart marker             |
| 2.3 Mobile-first media queries            | Shared responsive CSS; desktop dashboard columns, mobile courier cards, wrapped navigation, scrollable hub/history tables |
| Progress Report 2                         | [Report](docs/progress-report-2.md)                                                                                       |
| Technical Presentation 1                  | [Browser slide deck](docs/presentation.html), [presenter notes](docs/presentation-notes.md)                               |

Registration also closes the gap found during the Phase 1 source review.

## Verify

```sh
npm test
npm run test:browser
```

Browser tests use installed Google Chrome. If unavailable, run `npx playwright install chromium` and remove `channel: 'chrome'` from `playwright.config.cjs`.

Tests cover model validation, ownership, ordered transitions, receipt rules, hydration, queue ordering, the full portal journey, persistence, cross-tab updates, native validation, preferences, keyboard behavior, safe text rendering, reset recovery, and every page at 320 / 390 / 768 / 1440 pixels.

## Source structure

```text
index.html                       Landing page
pages/                           Three portal views
css/main.css                     Original campus theme and base styles
css/phase2.css                   Shared responsive layouts
css/{operator,courier,enduser}.css Portal-specific details
js/models.js                     Domain models and validation
js/app.js                        Storage, jQuery events, rendering
js/vendor/                       Official minified jQuery
 tools/serve.cjs                  Development static server
 tests/                          Model and browser tests
 docs/                           Report, slides, presenter notes
```

## Demo boundaries

This is a shared, single-browser simulation. Profiles and driver IDs are not authentication; all portals inspect the same records. Use fictional personal details. Notifications are in-app, not email. The route preview is schematic; urgent-first destination sorting is not geographic optimization. Carbon metrics use a disclosed illustration.

Storage is browser/origin specific and does not synchronize devices. Storage failure falls back to page memory with a warning. Corrupt saved data blocks writes until an explicit reset. Storage events refresh other tabs; mutations reread the latest state, but simultaneous writes are not transactional. Phase 3 needs authenticated endpoints, server validation, and durable database storage.

## Submission

Phase 1 was submitted according to the team. Phase 2 is due **October 26, 2026**, with Progress Report 2 and Technical Presentation 1. Submit once per group through D2L with the [repository link](https://github.com/mnsu-campuseco/mnsu-campuseco). Review the report and rehearse the presentation first. Document individual contributions from actual work and commit history.
