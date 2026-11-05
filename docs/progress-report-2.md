# Progress Report 2 — MNSU-CampusEco

**Course:** CIS 483, Fall 2026  
**Checkpoint:** Phase 2 — Client-Side Interactivity, Event Architectures & Responsiveness  
**Prepared:** October 25, 2026  
**Due:** October 26, 2026  
**Repository:** https://github.com/mnsu-campuseco/mnsu-campuseco

**Group:** Misgana Kebede, Clement Mbuyi, Yonatan Alemayehu, Emran Abatemam

## Scope and result

The submitted Phase 1 static portals have been extended into a browser-based delivery simulation. A package entered by a hub operator appears in the courier queue and recipient tracking view. Changes persist after refresh on the same browser origin, and other open portal tabs update through storage events. Application forms update the interface without navigation or a full-page refresh.

This report describes the local implementation prepared for team review. It does not certify D2L submission, instructor sign-off, deployment, or individual authorship of commits.

## Task 2.1 — Native JavaScript objects, functions, and events

`js/models.js` defines `Package`, `Vehicle`, and `EcoCourier`. Package methods validate cargo, assign a courier and cart, enforce ordered transit steps, record timestamped events, and accept a single receipt after delivery. Vehicle objects validate battery reports. Courier objects validate demo driver IDs.

`js/app.js` separates storage operations, mutations, rendering, and event registration. Form submissions prevent default navigation while retaining HTML5 required, pattern, email, numeric range, and length constraints. Click handlers claim deliveries, open options, end shifts, and reset the demo. Input/change handlers filter the hub log and update milestone choices. Escape closes open option panels and returns focus to their controls.

LocalStorage stores versioned JSON under `campuseco.phase2.v2`. Hydration restores class methods after parsing saved data. SessionStorage stores the active crew shift for the current tab. Before each mutation, the controller reads the latest shared state. Storage events refresh other portal tabs. Storage failures display a warning and fall back to page memory; unreadable saved data requires an explicit demo reset before writes.

## Task 2.2 — jQuery integration

The official minified jQuery 3.7.1 distribution is checked into `js/vendor/` with its license header. Deferred scripts load the library before the models and UI controller. The running frontend has no CDN dependency.

jQuery selectors and `.on()` bind forms, clicks, keyboard events, filters, and storage events. Delegated claim handlers work for newly inserted queue rows. Render functions inject tracking records, notifications, fleet cards, and delivery statistics. `.slideDown()` / `.slideUp()` reveal queue and preference options. `.animate()` moves a schematic cart marker when the selected package changes transit stage. Animation is disabled when reduced motion is requested.

User-entered values are inserted using `.text()` or `.val()` rather than interpreted as HTML. Recipient names, delivery notes, and profile values remain literal text.

References: [jQuery events](https://api.jquery.com/on/), [sliding effects](https://api.jquery.com/slideDown/), [animation](https://api.jquery.com/animate/), [official distribution](https://code.jquery.com/jquery-3.7.1.min.js).

## Task 2.3 — Mobile-first responsive design

The base layout has one dashboard column. At 600 pixels, summary and fleet cards use multiple columns; at 900 pixels, dashboard workspaces use two columns. Dimensions share a row from 420 pixels upward. Navigation wraps on small screens. Below 600 pixels, the courier queue becomes stacked delivery cards with field labels. Hub logs and recipient history remain inside focusable horizontal scrolling regions.

Inputs and buttons use a minimum 44-pixel height. Forms have associated labels, visible keyboard focus, native validation, and feedback announcements. Option controls expose expanded state and controlled panel IDs. The route preview also has a text description and does not depend on animation alone.

## Features by portal

| Portal           | Phase 2 behavior                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub Operator     | Check-in, duplicate prevention, campus destinations, urgent priority, package totals, search/status filters, shared tracking log                                                                |
| Eco-Transit Crew | Demo shift identity, cart selection, battery reports, low-battery claim restriction, claim ownership, sequential milestones, personal queue filter, route animation, fleet cards                |
| Campus End-User  | Actual local tracking lookup/history, in-app notifications, saved delivery preferences, notification category filters, demo registration, delivered-package sign-off, calculated carbon metrics |
| Landing page     | Portal links, live browser totals, complete demonstration instructions, scoped demo reset                                                                                                       |

The campus registration form also addresses the gap found during the Phase 1 repository review. No backend or real authentication was introduced.

## Verification

Execute `npm test` and `npm run test:browser` from the repository root. Browser test setup starts a local static server automatically.

The final local run on October 25 passed **4 model tests and 11 Chrome browser tests**. Local resource paths, label targets, duplicate IDs, and formatting checks also passed. All eight presentation slides were rendered in Chrome and visually inspected.

Verified scenarios include the complete check-in → claim → Loaded → En Route → Delivered → receipt journey, refresh persistence, cross-tab synchronization, duplicate tracking rejection, native required validation, low-battery claim prevention, literal rendering of HTML-like input, preference/profile restoration, Escape focus behavior, and scoped reset after corrupt saved data. Responsive checks cover the landing page and all portals at 320, 390, 768, and 1440 pixels. Mobile screenshots were visually inspected during development.

The checks do not establish full accessibility conformance, production security, performance under load, or compatibility with every browser.

## Technical boundaries and Phase 3 handoff

The static development server only serves files; it does not read or save application data. The frontend has no AJAX, database, PHP, AngularJS, or live telemetry endpoints. All recipients share one demonstration dataset. Saved profiles and crew IDs are demo selectors rather than authenticated identities. No email is sent.

Queue ordering is urgent first, then destination, not a geographic optimization algorithm. Route markers show transit stages, not GPS coordinates. Carbon savings are illustrative: each completed delivery contributes 2 km × 0.20 kg CO₂ avoided per km. Actual emissions are not measured.

Browser storage cannot coordinate transactions across simultaneous writes and does not synchronize devices. Phase 3 should replace this store with authenticated JSON endpoints, server-side business rules, durable relational records, and asynchronous UI updates. Keep the model transition rules when moving validation to the server.

## Team review and submission

Each member should review the portal corresponding to the Phase 1 ownership roster and understand the shared model/controller before presenting. Individual work and commit contributions must be documented by the team from actual history; this report does not invent that record. One member submits the compiled deliverables and repository link to D2L. The accompanying browser slide deck and presenter notes support the in-class technical demonstration.
