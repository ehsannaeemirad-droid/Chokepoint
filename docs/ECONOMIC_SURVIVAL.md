# CHOKEPOINT: ECONOMIC SURVIVAL

A separate mode inside this repository. It does not replace, redesign or modify the theatre game or
National Command. It is loaded from its own page, owns its own state, styles, localization and save
key, and never imports the Phaser runtime.

Open at `/economic.html`, or from **Economic Survival — new mode** in the classic menu.

## Scope shipped

- **One country, illustrative data.** Every figure is a scenario assumption for a strategy game, not a
  statistical claim. The UI and this note label it as such.
- **Five campaign scenarios**: Hormuz Crisis (12 months), Oil Revenue Collapse, Currency Crisis,
  Sanctions Squeeze, Food and Energy Shock (10 months each).
- **Sandbox** with configurable reserves, global oil price, sanctions intensity, political stability
  and shipping disruption, on an open-ended clock.
- **Monthly turn loop**: queue up to two policies, resolve the month, read a report, repeat.
- **Six institutions** (central bank, finance, energy, trade, economic security, political leadership)
  each with their own policy proposals, support scores and recommendations.
- **Eighteen policies** with political cost, cooldowns, durations, immediate effects, delayed effects,
  monthly effects, benefits, costs, risks and institutional support.
- **Interconnected systems**: reserves and external liquidity, four exchange rates and the parallel
  gap, inflation by source, a full budget with revenue and expenditure lines, oil production and
  realized export revenue, four essential import categories, subsidies, banking, employment and
  household affordability, social and political stability, sanctions pressure, trade partners and
  long-term investment capacity.
- **Events** defined as data (`src/economic/events.ts`), triggered by state conditions rather than a
  random table, and never repeated.
- **Forecasts with ranges** for reserve horizon and inflation, plus an explicit risk label.
- **Eight outcome verdicts** scored across six axes: economic survival, financial stability, welfare,
  political stability, productive capacity and strategic independence.
- **Save/load** in `chokepoint:economic:v1`, separate from the classic and National Command saves.
  Deterministic for a given seed, starting conditions and decision sequence.
- **English and Persian**, including RTL layout, Persian numerals and a mobile-first interface.

## Isolation

New files only:

```
economic.html
src/economic/main.ts
src/economic/ui.ts
src/economic/model.ts
src/economic/events.ts
src/economic/economic.css
src/economic/model.test.ts
docs/ECONOMIC_SURVIVAL.md
```

Existing files touched, all additively:

| File | Change |
| --- | --- |
| `vite.config.ts` | adds `economic: 'economic.html'` as a build input |
| `src/ui/Ui.ts` | adds an `economic` navigation handler and a menu button that links to `./economic.html` |
| `public/sw.js` | caches `economic.html` and resolves its offline navigation shell |
| `README.md` | documents the new mode |

No classic scene, simulation, save format, translation file, balance value or asset was changed. The
classic game does not depend on the new mode; the mode is only reachable through its own entry point.

## Architecture

```
src/economic/model.ts    Pure simulation: state types, scenarios, policies, monthly resolver,
                         accounting identities, forecasts, outcomes, persistence.
src/economic/events.ts   Declarative event definitions with causal triggers.
src/economic/ui.ts       DOM renderer and input handling. Reads state, submits validated decisions,
                         never writes economic variables directly.
src/economic/economic.css  Mobile-first visual system for this mode only.
src/economic/model.test.ts 22 tests over accounting, policy timing, determinism and outcomes.
```

The resolver is the only place that mutates the economy. The UI calls `queuePolicy` / `resolveMonth`,
which validate action slots, political capital and cooldowns, and returns localized refusal reasons.

## Systems and their couplings

- Reserves finance imports and debt service; export receipts and non-oil exports replenish them.
- Oil revenue uses saleable exports and the realized price after discount and shipping costs, not
  production multiplied by the benchmark.
- The parallel-rate gap responds to reserve cover, capital flight, sanctions, the deficit and policy.
  It drives food, medicine and input inflation, which drive affordability, hardship and protest.
- The budget reconciles every month: `deficit = expenditure − revenue`, `primary = deficit − interest`.
- Subsidy cuts improve the budget but raise fuel and food costs, hardship and protest risk; targeted
  transfers cost money and calm the street only if supply exists.
- Banks, credit, employment and investment respond with lags, so short-term survival competes with
  long-term capacity.

## Tests

`src/economic/model.test.ts` covers: initial and scenario states, gross vs usable reserves, budget
reconciliation, reserve bounds over a year, oil revenue tied to exports, rate synchronization, import
coverage under financing collapse, calendar advance, agenda and capital limits, cooldowns, delayed and
monthly effects, intervention relative to a control month, institution support coverage, determinism,
save round-trip and rejection of foreign payloads, 36-month numerical stability, campaign termination
with an attributable verdict, forecast bands, and event uniqueness.

`src/economic/campaigns.test.ts` plays all five campaigns to their endings twice: once with a
"sensible government" policy plan (sell crude, diversify, negotiate exemptions, raise revenue, protect
households, invest early) and once doing nothing. It asserts that every campaign reaches its final
month without a humanitarian, financial or political collapse, that governing the Hormuz and currency
crises turns them into managed survivals while inaction does not, that the two hardest campaigns end
as survival with severe weaknesses, and that a run is reproducible from the same seed and decisions.

## Campaign balance

Reserves are a buffer, not the only clock: import capacity is financed by current export and non-oil
receipts with reserves absorbing the difference, part of the deficit is monetized, and coverage
relaxes toward a target set by financing and domestic production. The intended outcomes are:

| Campaign | Governed | Inaction |
| --- | --- | --- |
| Hormuz Crisis | Managed survival | Survived, diminished |
| Oil Revenue Collapse | Survived, diminished | Survived, diminished |
| Currency Crisis | Managed survival | Survived, diminished |
| Sanctions Squeeze | Managed survival | Survived, diminished |
| Food and Energy Shock | Survived, diminished | Survived, diminished |

Early humanitarian, financial or political collapse is still possible through bad choices: exhausting
reserves on intervention, cutting subsidies without compensation, or letting food and medicine
coverage fall near zero.

## Known limitations

- One country, one currency, illustrative numbers; no historical dataset or sourcing claims.
- The two hardest campaigns are survivable but not winnable in the current policy set; reaching
  "managed survival" there needs instruments the mode does not yet expose (debt rescheduling, formal
  import compression).
- Sanctions evasion is represented only through abstract cost and risk, never as operational guidance.
- The economic map is a strategic schematic with clickable nodes, not a geographic projection.
- Import categories and population groups are modelled at aggregate level; no household microdata.
- Production and employment respond to abstract capacity and input availability, not a labour model.
- Only the four systems in the brief's first-playable list are deep; defence/dual-use trade is a
  single abstract category.

## Next priorities

1. A second playable country configuration to prove the data-driven country layer.
2. Richer institutional conflict: formal votes, resignations and coalition pressure.
3. Scenario-specific scripted beats layered on the emergent event engine.
4. Post-game comparative charts and a decision-by-decision attribution report.
5. Accessibility pass on the map and policy details (focus order, screen-reader labels).
