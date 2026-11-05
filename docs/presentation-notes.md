# Technical Presentation 1 — Presenter notes

Open `http://127.0.0.1:4173/docs/presentation.html` after `npm start`. Use arrow keys, Home/End, or the controls. F11 enters browser fullscreen. Browser Print produces one slide per landscape page. The deck is HTML rather than PowerPoint and can be edited in the repo.

Suggested total: 6–8 minutes plus questions. Decide actual speaking roles as a team; the notes do not assign authorship.

1. **Phase 2 checkpoint:** Introduce the campus hub, student crew, and recipient. The focus is client interactivity and responsive design. All data stays in the browser.
2. **Connected workflow:** Explain how one tracking number connects the portals. Ownership and ordered milestones prevent skipping stages. A receipt is permitted once after delivery.
3. **JavaScript models and persistence:** Open `js/models.js` and show `Package.claim`, `advance`, and `sign`, plus `Vehicle.reportBattery`. Show the versioned storage key, hydration, mutation function, and storage event in `js/app.js`. Storage is scoped to one browser origin and is not transactional.
4. **jQuery behavior:** Show the delegated claim handler, row insertion with `.text()`, sliding preference options, and animated cart marker. Explain deferred script order. Press Escape after opening a panel. Mention reduced motion support.
5. **Responsive layouts:** Resize Crew from desktop to phone width. Show dashboard columns stacking and the queue becoming labeled cards. Demonstrate that the hub table scrolls inside its region.
6. **Live demo:** Reset through the explicit controls. Check in `CE-20261004`, weight `3.2`, dimensions `12 × 8 × 6`, and a destination. Start `ECO-1234` / `cart-01` in Crew, claim, then update Loaded → En Route → Delivered. In End-User, track it and sign as `Demo Recipient`. Refresh to prove persistence. Keep an operator tab open to show cross-tab updates.
7. **Verification and limitations:** Run `npm test` and `npm run test:browser` beforehand. Demonstrate duplicate tracking or Cart 03's 19% battery restriction. Demo identities, schematic routes, and estimated carbon are not production services.
8. **Phase 3 handoff:** The browser store will become authenticated JSON APIs and database records. No Phase 3 backend endpoints were added.

Before class, install dependencies, ensure Chrome is available for tests, and rehearse with the same localhost hostname and port in every portal. Local jQuery allows the running frontend to work without a CDN connection.
