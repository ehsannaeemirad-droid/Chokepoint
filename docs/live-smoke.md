# Live Pages smoke test

Date: 2026-11-11  
Deployed commit: `841b52b`  
Live URL: https://ehsannaeemirad-droid.github.io/Chokepoint/  
Served bundle: `assets/index-CA_v5sBi.js`

## Result

Passed at 1280×900 and 390×844 with zero browser console errors and zero page
errors.

- Clicked the hostile **Kharg Island** map label in the initial camera view.
- The target-first panel opened with “Tools that can strike this location” and
  listed 9 available attacking tools.
- Queued the first strike row (Carrier Strike Group) and a non-strike hold task.
- Reopened the same location; the tasked carrier was absent and 8 attackers
  remained.
- At 390 px the same label click opened the panel with 9 rows and a laid-out sheet.
- Live engine probes: water move rejected (`ground-water`); malformed aid rejected
  (`unknown-order`) with an unchanged snapshot; espionage active through turn 3
  after purchase on turn 1 with exact `100%` facility integrity; CSG named
  “Carrier Strike Group” and attackable; second move rejected (`unit-tasked`);
  cancellation, completion, resolve-time failure and invalid-order paths all
  cleared the reservation.
- Screenshots: `docs/live-smoke/desktop.png`, `docs/live-smoke/mobile.png`.
- Raw results: `docs/live-smoke/results.json`.

## Environment note

Headless Chrome on this host could not open GitHub Pages directly (the shell and
Node could). The test fetched the exact live responses through Node and fulfilled
them on the live origin in Playwright, with service workers blocked. The browser
therefore executed the deployed bundle and origin while the transport was proxied.
The PWA service worker was not part of this check.

At the initial zoom a few labels overlap; Kharg Island was used because it is
clickable. The overlap is recorded in `AUDIT.md` as a UI-polish item.
