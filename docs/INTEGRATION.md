# 2026 war data integration — final report

Branch: `data-integration-2026-war`. Everything here is additive: existing
schemas, names and balance paths are unchanged, and every new mechanic is gated
by a scenario flag that defaults to `false`.

## What was integrated

| Layer | Where | Contents |
| --- | --- | --- |
| Sites | `src/data/orderOfBattle.json` → `sites` | 64 named sites with coordinates, host, operators, hardening and a `node_id` link to the playable map where one exists |
| Weapon performance | `src/data/orderOfBattle.json` → `weaponPerformance` | 22 systems: range, warhead, CEP, propulsion, reliability, inventory, penetration, and a `game_field` naming the unit each drives |
| Endurance | `src/data/logistics.json` → `endurance` | Twelve blocks: munitions, interceptors, sortie capacity, carriers, Iran production, proxies, economy, mobilization, cyber |
| Host access | `src/data/scenarios.json` → `hostAccess` | Eight host nations with access status |
| History | `src/data/scenarios.json` → `history` | 13 dated events |
| Interventions | `src/data/scenarios.json` → `interventions` | Five external-actor options |
| Flags | `src/data/scenarios.json` → `systems` | Nine endurance flags, all `false` in `campaign` and `tutorial` |

Every named site is now playable. The 47 original nodes are joined by 49
site-derived nodes (96 total), with kind, opening integrity, the brief's
detection radius for SAMs and radars, the cueing radar each battery depends on,
and a stated degradation effect. All 64 sites carry a `node_id`; only the two
mobile carriers stay units. Radar reach feeds `detectionChance`, so destroying a
site now changes the air-defence picture.

## Mechanics

The nine endurance flags live in `src/combat/endurance.ts`; hooks are in
`Game.start`, `combat.validateStrike`, `combat.resolveStrike`,
`combat.bestDefence`, `airdefence.detectionChance`,
`airdefence.defenceLayers` and `engine.runTurn`. Two further scenario flags,
`hostAccess` and `interventions`, apply the opening access posture and the
third-party triggers (Pakistan, Egypt, Hezbollah, Houthis, PMF) once each.

| Flag | Effect | Anchored to |
| --- | --- | --- |
| `munitionsDepletion` | Coalition packages are spent and produced; sortie capacity degrades to a 50% floor rather than stopping | JASSM/TLAM/PRSM inventories and yearly output |
| `interceptorDepletion` | Israeli and US interceptor pools drain at documented rates, with one exhaustion event | Arrow to end-March; THAAD ~half a magazine |
| `radarDamageMultiplier` | Destroyed cueing radars raise interceptors spent per engagement, up to 2.5x | Brief B radar/SEAD findings |
| `sortieFatigue` | High tempo tires crews; homeland hits divert Israeli sorties; pilot losses are permanent; IRIAF strikes at 20% | Crew-rest cycle, 70% diversion, five-year pilot pipeline |
| `carrierEndurance` | Deployment clock past 20 turns extends with rising sortie loss; tanker fleet caps coalition sorties | Nine-month deployment, tanker constraint |
| `iranProduction` | Output surges at 150% on stockpiled components, then 60%; blockade halves solid fuel only | 200–500 assembleable rounds, 0.5 solid-fuel modifier |
| `proxySupply` | Proxy magazines refill only at indigenous production rates, capped at establishment | Houthi ~90% indigenous; Hezbollah route closed |
| `cyberLimits` | Cyber may only blind radar (0.7 detection, two turns) or delay one launcher; nothing is destroyed | "Temporary disruption only" |
| `israelMobilization` | Israeli ground formations lose 2% a turn from turn 12 to a 75% floor, while home-front pressure can end the war at 85 for two turns | 450,000 reservists, 9% output gap |
| `hostAccess` | Each host starts at its documented access posture | OOB host table |
| `interventions` | Third-party triggers fire once under their stated conditions | OOB intervention table |

The **playable path** is a new-campaign menu toggle: choosing *Endurance systems*
passes the preset into `Game.start`, which overrides the scenario flags for that
campaign only (the scenario definition is never mutated).

With the flags off, `snap.endurance` is `undefined` and every helper returns its
neutral value, so the pre-integration path — and the 8/8 Iran baseline — is
unchanged. A test asserts this explicitly.

## Calibration

Measured across eight seeds per faction with the existing crude policy, flags off
versus all on; the table is in `BALANCE.md`. No side freezes: every run issues
strikes, spends munitions and terminates. Iran's 2/8 → 0/8 shift tracks
`munitionsDepletion` and is not separable from noise at that sample size, so no
constant was fitted to it. An experiment raising IRIAF effectiveness from 0.2 to
0.5 changed no outcome and was reverted.

`base_pk` and `interception_pk` are filled with **model values** and a per-row
`pk_basis`: CEP-derived for guided weapons, class models where no CEP is
published, and the defence unit's intercept probability for interceptors. They
are not presented as published facts. The full derivation and old → new table is
in `docs/CALIBRATION_2026.md`.

## Provenance

Every constant in the endurance layer has a `HistoricalReference` under the new
`endurance` category in `src/data/references.ts`: value, band, unit, evidence
type, confidence and a `gameMapping` naming the field it drives. Weapon rows name
their unit type, or state that they are data only where no unit exists.
`docs/DATA.md` is generated from the records, and `src/data/provenance.test.ts`
fails when a constant has no reference, when its band excludes the code value, or
when a mapping does not explain the conversion.

## Verification

`pnpm run typecheck` 0, `pnpm test` 55 files / 429 tests, `pnpm run build` 0, CI
green on every commit on the branch.

Coverage highlights: pools initialise from sourced inventories; a strike spends a
package and degrades tempo; the ledger holds `stock = starting + produced −
spent`; radar destruction raises interceptor cost; Arrow drains to its horizon
with one event; a 30-turn campaign runs with every flag on; the flags-off baseline
is untouched; fatigue, diversion, permanent pilot loss, carrier extension, tanker
cap, Iran surge/decline, proxy refill cadence, cyber's two effects, reservist
fatigue, order-boundary rejection and detection blinding are each asserted.
Launchers reload from remaining rounds between turns, and a campaign test fires
an opening salvo then confirms Iran can still strike several turns later.

## Known gaps

- **Pk fields are model values, not published hit probabilities.** Each row
  states its `pk_basis`; see `docs/CALIBRATION_2026.md`.
- **Hezbollah, Hamas and the PMF field abstract formations** built from their
  documented inventories: finite magazines, no Hezbollah/Hamas reload, and a
  five-turn low PMF resupply. They are not modelled down to launcher level.
- **AI air strikes share one coalition sortie budget per AI phase.** The cap in
  `validateStrike` cannot see AI sorties because `snap.orders` is empty by then,
  so `runAiPhase` carries the budget across US and Israeli packages.
- **Turn thresholds are game-scale readings**, not published dates: carrier 20
  turns for nine months, reservist fatigue 12 turns for four months.
- **Cyber's radar effect is a flat detection multiplier**, not a per-node
  compromise model.
- **No visual verification of the expanded map.** The browser window was
  minimised throughout this pass, so node rendering and label collision on the
  96-node map are unverified.
- **Generated nodes' Persian names are transliterations** of the brief's place
  names, not sourced translations; a native review is worthwhile.
- **Compact labels are localized through `localShortName`**, and the FA map was
  checked through the accessibility tree rather than a screenshot (the browser
  window was not drawable at capture time).
