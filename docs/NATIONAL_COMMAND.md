# National Command — vertical slice

`national.html` is a separate Chokepoint mode: a national-leadership crisis simulation built beside the theatre game. The classic USA / Israel / Iran campaigns, the asymmetric prototype, their save slots and their replay format are not modified.

Open `/national.html`, or use **National Command — redesign prototype** at the top of the existing campaign menu.

## Implemented

- **Two playable governments.** Iran and the United States have separate starting economies, domestic positions, military readiness, diplomatic relations and country names. The same cabinet engine governs both; the United States has a stronger fiscal and strategic starting position while Iran starts closer to the economic and domestic edge.
- **Three campaigns and a sandbox.**
  - **Hormuz Crisis** — 12 weeks, the original first slice.
  - **Economic Pressure** — 10 weeks, lower reserves, higher inflation and a solvency-first crisis.
  - **Diplomatic Settlement** — 10 weeks, an existing mediation channel and stronger settlement pressure.
  - **Open sandbox** — no campaign clock, with contained / flashpoint / on-the-brink presets and a custom crisis constructor for military pressure, economic pressure, shipping access, confidence and stability.
- **Player-authored priorities.** Choose exactly two of security, governance, economic resilience, diplomatic room and crisis control. Priorities are highlighted on the objective board and are part of the final strategic-victory test.
- **Shared simulation for every configuration.** The campaign and sandbox use the same country/world state, decision queue and turn resolver.
- **Iran and US country state.** Government legitimacy, stability, elite support, public confidence and social tension; reserves, currency, inflation, fiscal capacity, oil revenue, trade access and public pressure; readiness, air defence and strategic capacity.
- **World state.** Four escalation factors and six stages; separate route accessibility and market confidence; insurance, flow, oil price and energy stability; six actors (Iran, United States, GCC, Qatar, China, EU). The current player's actor is controlled by the player and skipped by the AI.
- **Six departments with twelve decisions.** Each decision has a political-capital cost, explicit effects, delayed consequences and, where appropriate, a cooldown. Two departmental decisions fit in a week.
- **Deterministic turn resolution.** Decisions, delayed effects, actor decisions, market/economy/domestic updates, data-defined events, intelligence ageing and outcome evaluation run in a fixed order from a stored seed.
- **Data-defined events.** `src/national/events.ts` contains event definitions with a trigger, effect package, tone and bilingual text. Events fire once, are stored in the save, and appear in the after-action report. Examples: an insurance shock, a Qatari opening, street pressure, interceptor shortage, and an energy lifeline.
- **Tactical air-defence plot.** The Defence ministry can allocate three interceptor batteries across command, ports and cities once per week. Allocation is resolved deterministically from the raid package and changes defence, readiness, confidence, stability, social tension and insurance. The action is recorded in the state and replayed.
- **Intelligence with provenance.** Each assessment carries source, reliability, confidence, age, corroboration and deception indicators. A collection task refreshes the weakest assessment.
- **After-action reporting.** Each resolved week explains the decision, external responses, events and threshold changes.
- **Multiple endings.** Negotiated settlement, strategic victory, limited victory, pyrrhic survival, government/economic collapse and catastrophic escalation. Settlement requires a minimum amount of governing time, mediation progress and a viable economy, not only talk spam.
- **Six strategic map layers.** Shipping, energy, diplomacy, politics, military and intelligence each change the map badge and read the relevant state.
- **Replay export/import.** A versioned replay stores the scenario, player, seed, priorities and each week's decisions plus tactical allocations. Import replays the decisions through the deterministic engine and restores the resulting state; malformed or out-of-order replays are rejected.
- **UI.** National dashboard, strategic Gulf map, department rail, decision queue, intelligence cards, defence plot, campaign result screen, English and Persian RTL layouts.
- **Persistence.** One versioned `localStorage` situation (`chokepoint:national:v1`), autosaved after every week and available from the start screen. The PWA shell caches `national.html` separately.

## Structural isolation

- New runtime: `src/national/model.ts`, `src/national/events.ts`, `src/national/ui.ts`, `src/national/main.ts`, `src/national/national.css`.
- New entry: `national.html`; `vite.config.ts` adds it as a second build input.
- Existing-game changes are limited to a menu button in `src/ui/Ui.ts` and a cache entry in `public/sw.js`. No classic scenario, engine, save or replay code imports the national model.
- The national page never loads Phaser.

## Deliberately bounded

- The two governments share one decision deck and one domestic model. They differ in starting position, objectives, actors and campaign setup, not yet in country-specific institutions or decision trees.
- The tactical mode is a contained air-defence allocation plot, not a full tactical war layer.
- Events are data-defined; there is no in-game event editor. The sandbox constructor exposes five opening pressure sliders, not the whole world state.
- No multiplayer, cloud saves, or additional playable states beyond Iran and the United States.
- Balance is first-pass and tested through model campaigns and browser playthroughs; it still needs extended human playtesting.

## Checks

```bash
npx tsc --noEmit
npx vitest run
npx vite build
```

The national model has focused deterministic tests covering both governments, all three campaigns, custom sandbox construction, priority validation, decision limits, cooldowns, delayed effects, events, tactical defence, shipping/economy reactions, country AI, settlement, collapse, final evaluation, save encoding, effects descriptions and replay restoration.
