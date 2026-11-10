# Chokepoint — Audit and Phase Log

Governing specification: `SPEC.md`.

Append-only record of what was changed, how it was verified, and what remains
open. Every check below was executed locally on the canonical checkout; a check
that was not run is stated as not run.

## 0. Canonical checkout

| Item | Value |
|---|---|
| Path | `C:\Projects\Chokepoint-main` |
| Remote | `https://github.com/ehsannaeemirad-droid/Chokepoint` (`main`) |
| Baseline commit | `ec8b345` ("Add files via upload") |
| Package manager | pnpm 10.15.0 via `corepack` |
| Toolchain | TypeScript 5.9, Vite 8, Vitest 5, Phaser 4.2.1 |

The `G:\My Drive\Projects\Chokepoints` copy and the earlier
`C:\Projects\Chokepoints` checkout are obsolete. `mdf.md` is not tracked in the
repository; the brief is available only as the conversation attachment.

## 1. Baseline recovery (commit `092f429`)

`main` was red. The last commits uploaded a build output tree over the source
tree, so the repository mixed three versions of the game:

- `src/ui/Ui.ts` was a 2-line placeholder while the real 1742-line UI sat at the
  repository root, written for `src/ui/` import paths.
- `src/i18n/index.ts` and `src/ui/objectives.ts` were older than their root
  copies (no `t(key, vars)`, no `langRevision`, no objectives strip logic).
- `index.html` pointed at `./dist/assets/index-CzBDZ3mh.js`; `/src/main.ts` was
  gone.
- Root duplicates of `core/`, `data/`, `i18n/`, `ui/`, `engine.ts`, `Game.ts`,
  `types.ts`, `config.ts`, the JSON data and the built bundles were committed
  alongside `dist/`, and `.github/workflows/pages.yml` copied `dist/index.html`
  over the root entry on every deploy.

Recovery:

1. Restored `src/ui/Ui.ts`, `src/i18n/index.ts`, `src/ui/objectives.ts` and its
   test from the newer root copies.
2. Repaired six engine call sites (`updateChokepoints`, `updateEscalation`,
   `updateTalks`, `thirdPartyPhase`, a stale import) and the two unused locals in
   `Ui.ts` (an unreferenced after-action card that was computed and never
   rendered; removed rather than wired up, since rendering it would be new UI).
3. Restored `index.html` to the Vite source entry and corrected the manifest and
   icon paths to `public/`.
4. Deleted the duplicate root tree and the committed `dist/`, added a
   `.gitignore`, added CI (`typecheck`, `test`, `build`), and replaced
   `pages.yml` with an artifact deploy (`upload-pages-artifact` +
   `deploy-pages`) that no longer rewrites the repository.

Three tests then failed for real reasons, not for setup reasons:

| Failing test | Cause | Fix |
|---|---|---|
| `engine.test.ts` expected 100/60 interceptors | the pre-war posture now starts 70% ready / 30% reserve | assert the 70% share and that ready + reserve equals the scenario baseline (120 US, 70 Israel) |
| `i18n/log.test.ts` outcome coverage | the final-turn ending concatenated "Iran achieved …" in front of a sentence that already began "The campaign has ended." | emit the closed-set path text as the outcome; the achieved paths stay visible in the objectives and scorecard rows |
| `politics/logistics.test.ts` expected a delay event | delay turns accrued silently | log `Strait risk delays <package>: ETA slips to turn N.` when a package is actually pushed back |

## 2. Phase 1a — facility taxonomy (commit `56ef4a3`)

Data (`src/data/mapNodes.json`, 47 nodes):

| Site | kind | facility | lines | regen |
|---|---|---|---|---|
| Isfahan | nuclear | `nuclear-conversion` | — | — |
| Natanz | nuclear | `nuclear-enrichment` | — | — |
| Fordow | nuclear | `nuclear-enrichment` | — | — |
| Khojir | missile-industry | `missile-production` | missile, drone | 2 / 2 |
| Parchin | missile-industry | `missile-production` | missile | 1 |
| Shahroud | missile-industry | `weapons-storage` | missile | 1 |
| Bandar Abbas storage | port | `weapons-storage` | drone | 3 |
| Tabriz complex | urban | `defence-industry` | missile, drone | 1 / 1 |

Khojir, Parchin and Shahroud carry a `provenance` note stating that the site
comes from open-source reporting and that the coordinates are approximate. No
specific source is asserted beyond that.

Code:

- `src/core/types.ts`: `NodeKind` gains `missile-industry`; new `ProductionLine`
  (`missile | drone`) and `FacilityCategory` (eleven categories); `MapNodeDef`
  loses the conflated `production` field and gains `productionLines`, `facility`,
  `undergroundRegen` and `provenance`.
- `src/core/production.ts` (new): `productionSites`, `hasProductionCapacity`,
  `productionCapacity`, `lineForMunition` — pure functions over facility data and
  integrity.
- `src/core/engine.ts`: a `produce` order is rejected when no intact line of the
  right type exists, and output is scaled by the mean integrity of the surviving
  facilities. Resolution also guards against orders that arrive after the line is
  destroyed.
- `src/ai/ai.ts`: `iranProduce` iterates intact missile and drone facilities
  instead of the three hardcoded nuclear ids.
- `src/core/prewar.ts`: underground regeneration is driven by
  `undergroundRegen` in the data, not by an id list.
- `src/ui/Ui.ts`, `src/ui/nav.ts`, `src/map/MapMarkers.ts`: Persian and English
  labels, filter kind and marker shape for `missile-industry`; the node sheet now
  shows the facility category beside the node kind.
- `src/data/facilities.test.ts` (new, 8 tests): nuclear sites have no production
  lines, the old field is gone, enrichment and conversion are classified
  separately, the three missile-industry sites carry provenance, production sites
  are well-formed, munitions map to the right line, capacity follows integrity,
  and a production order is rejected once the line is destroyed.

## 3. Phase 1b — Iranian inventory split (commit `HEAD`)

The flat counters (`drones`, `fateh`, `khorramshahr`, `fattah`, `asm`) conflated
four different things. `IranStock` is now a typed arsenal:

| Field | Meaning |
|---|---|
| `rounds` | mated rounds by delivery class — what a launcher fires |
| `airframes` | airframes built and awaiting a warhead, by production line |
| `warheads.conventional` | conventional warheads awaiting an airframe |
| `launchers` | drone/ballistic launch platforms per turn, plus this turn's usage |
| `nuclearMaterial` | warhead-grade material in warhead equivalents; never a round |
| `mines`, `minesLaid`, `fac`, `resources` | unchanged naval, industrial and economic state |

Code:

- `src/core/inventory.ts` (new): `deliveryClassFor`, `spendIranRounds`,
  `mateRounds`, `deliverMatedRounds`, `totalRounds`, `launcherSortiesLeft`,
  `resetLauncherSorties`, and `arsenalRows` with `ARSENAL_UNCERTAINTY_PCT`.
- `src/core/engine.ts`: every `strike` by an Iranian unit spends one mated round
  **and** one launcher sortie, and reports whether the failure was rounds or
  sorties. `produce` and underground regeneration deliver through the same
  airframe + warhead → mated-round path. The launcher budget resets when the
  turn advances.
- `src/ai/ai.ts`: salvos draw on the same stock and the same launcher budget; the
  logged salvo count is what was actually fired. AI production mates through
  `deliverMatedRounds`.
- `src/politics/initiative.ts`: launch pressure uses `totalRounds`.
- `src/ui/Ui.ts`: gauges, the production list and the enemy stock helper read
  mated rounds; the panel shows launcher sorties left, unmated airframes and
  warheads, and nuclear material as a separate programme.
- `src/data/scenarios.json`: both scenarios carry the split arsenal; campaign has
  12 drone / 9 ballistic launch platforms, the tutorial 6 / 4.
- `src/core/Game.ts`: `structuredClone(scenario.iran)`. **Bug found:** the shallow
  spread shared the nested arsenal objects between the scenario definition and
  every game started from it, so one campaign's spending changed the next
  campaign's starting stock. The older flat counters were copied by value, which
  is why this never surfaced before.
- `src/core/inventory.test.ts` (new, 9 tests): start state is split; nuclear and
  non-mated stock never count as launchable; mating consumes both halves; a
  sortie is spent per round and the budget caps the salvo; the budget resets each
  turn; a player strike is rejected when sorties are gone; every row is labelled
  `assessed` with a percentage band.
- `prewar.test.ts`, `domestic.test.ts`, `phase3.test.ts`: updated to zero or read
  mated rounds instead of the removed flat fields.

## 4. Decisions

- **Reserve split over the old 100/60 baseline.** The magazine total is unchanged
  (120 US, 70 Israel) and the test asserts the total as well as the split, so the
  abstraction is pinned rather than weakened.
- **Outcome text is a closed set.** Composing "Iran achieved X" per winning path
  made the ending unbounded, so the Persian dictionary could never cover it. The
  path achievement remains visible in the objectives and scorecard.
- **Dead WIP removed.** `afterActionHtml` was assigned every turn and never read.
  Wiring it into the UI would be a new feature; it was deleted and this is
  recorded here.
- **Regeneration stays a labelled abstraction.** It is still a per-site stock
  trickle, but the values now live in data and are named `undergroundRegen`,
  rather than pretending to be production capacity.
- **Rounds, not "missiles".** A launcher fires a mated round; airframes and
  warheads are only stock halves. Nothing in the game can convert nuclear
  material into a round, and no code path adds to `nuclearMaterial`.
- **Launchers are a real budget, not decoration.** They cap how many rounds a turn
  can leave the force, are shared by player and AI, and are therefore enforced in
  both the validator and the AI salvo builder.
- **Every displayed arsenal number is an estimate.** `arsenalRows` attaches
  `assessed` confidence and a ± band per class; the UI shows the band label
  instead of implying a precise count.

## 5. Verification log

| Command | Result |
|---|---|
| `corepack pnpm exec tsc --noEmit` | exit 0 |
| `corepack pnpm exec vitest run` | 18 files, 170 tests passed, exit 0 |
| `corepack pnpm run build` | exit 0; `dist/index.html` ~1.0 kB, CSS 25.6 kB, app ~258 kB, phaser 1367 kB |

Baselines: 16 files / 152 tests before Phase 1a; 17 files / 160 tests before
Phase 1b.

Not verified:

- GitHub Actions CI and the Pages workflow were never executed: no runner has
  run them and nothing has been pushed.
- The built game was not opened in a browser. The new arsenal panel, the
  `missile-industry` marker and the Persian labels are compile- and
  test-checked only.
- `mdf.md` is not in the repository, so the brief's exact acceptance wording for
  later phases cannot be re-read from the tree.

## 6. Open issues

- Balance: Iranian output and salvo size now depend on facility count and the
  launcher budget. Campaign tests pass, but win distribution needs the Phase 3
  harness.
- Nine of the eleven facility categories are defined but unused by data; radar
  and command sites should be classified in Phase 1c.
- Provenance is a single unqualified note per site; Phase 1c must attach evidence
  and confidence rather than a generic sentence.
- `nuclearMaterial` is modelled and displayed but nothing produces it yet; that
  belongs to the escalation/nuclear rules, not to inventory bookkeeping.

## 7. Next phase

Phase 1c (provenance): attach evidence, date and confidence to every facility and
stock estimate, and replace the generic provenance sentence.

## 8. Phase 1 closeout

### Commits

| Commit | Scope |
|---|---|
| `8a137e9` | provenance types, reference records, enforcement test |
| `b4c1bc0` | scenario baseline/isolation tests; deep-copy of the scenario config |
| `521e524` | DESIGN.md multi-dimensional victory model (design only) |

### Tests added

| File | Tests | What they pin |
|---|---|---|
| `src/data/provenance.test.ts` | 8 | reference shape, source policy, one record per subject, coverage walk over facilities, arsenal, launchers, nuclear material and scenario values |
| `src/data/scenarios.test.ts` | 8 | pre-war start undepleted, arsenal reconciliation, structural distinctness, deep-copy isolation |

### Verification (executed)

| Command | Result |
|---|---|
| `corepack pnpm exec tsc --noEmit` | exit 0 |
| `corepack pnpm exec vitest run` | 20 files, 186 tests passed, exit 0 |
| `corepack pnpm run build` | exit 0 |
| `vite preview` + HTTP fetch | 200, `<title>Chokepoint</title>`, `assets/index-*.js`, `assets/phaser-*.js`, `assets/index-*.css`; server stopped afterwards |
| YAML validation | **not done** — PyYAML is not installed in this environment (`ModuleNotFoundError`). The workflows are not claimed to parse correctly. |

The preview check is an HTTP smoke test of the built page, not a UI test: no
rendering, interaction, language switch or marker was inspected in a browser.

### Decisions and rejected alternatives

- **Organisation-level sources only.** No article title or deep link is asserted;
  facility records name IAEA / CSIS Missile Threat and the scenario records name
  IEA, with the drawing being a `game-abstraction`. Rejected: inventing plausible
  publication URLs to look precise.
- **Facilities are roles, not quantities.** Their reference carries `notes` and
  `gameMapping` instead of a number; inventing a "site value" would be a fake
  figure. Numeric records (arsenal, launchers, nuclear material, scenario values)
  must carry `value` or `min`/`max` plus a unit.
- **Enforcement in a test, not prose.** The walk fails if a classified facility or
  a scenario domain loses its reference, so future data cannot skip provenance.
- **Later-war scenario not invented.** No later-war scenario exists yet; Phase 5
  owns the dated scenario set. The pre-war baseline is asserted undepleted and
  the tutorial is asserted structurally smaller.
- **No code in 1e.** The design section states that current path-based outcomes
  remain authoritative until Phase 2 item 12.

### Scope check

Phase 1 touched data, types, production gating, inventory, scenario isolation and
tests. It did not touch combat resolution, AI doctrine, order validation, victory
code, replay or UX. The Phase 2 work in the next commit is explicitly item 1.

### Remaining items from the 57-row assessment

The full table lives in the superseded checkout; the items still open here are:
AI doctrine and target valuation (Phase 3), balance harness (Phase 3), UX and
accessibility pass (Phase 4), dated scenarios and replay versioning (Phase 5),
and radar/command facility classification (Phase 1c follow-up). Projected order
validation, previously item 1, is now implemented.

### New issues found

- **Shared nested scenario config.** `Game.start` spread the scenario shallowly,
  so `victory`, `domestic`, `initiative`, `talks`, `escalation`, `logistics`,
  `roe` and `scorecard` were shared with the definition and across campaigns.
  Fixed by deep-copying the scenario in `start`.
- **Provenance is organisation-level.** Confidence labels are honest but coarse;
  a future pass should cite specific reports where they can be verified.
- **PyYAML absent**, so local YAML validation is blocked rather than passing.

### Phase 1 acceptance checklist

| Criterion | State |
|---|---|
| Nuclear and missile facilities separated, with production gated on the right facilities | met (1a) |
| Khojir / Parchin / Shahroud present with provenance | met (1a, 1c) |
| Warhead / airframe / launcher / interceptor stocks separated; nuclear material disjoint | met (1b) |
| Every estimate labelled | met (1b bands, 1c references) |
| Provenance enforced by a test | met (1c) |
| Pre-war and tutorial baselines distinct and isolated | met (1d) |
| Victory assumptions documented, no implementation | met (1e) |
| Typecheck, tests, build green | met |
| CI / Pages verified | **not met** — never executed, not pushed |
| Browser-verified UI | **not met** — HTTP smoke only |

## 9. Phase 2 item 1 — projected order validation

Commit: the `feat: validate orders against projected state and reservations` commit.

- `src/core/engine.ts`: `OrderReservations`, `emptyReservations`, `reserveOrder`,
  `orderReservations`. `validateOrder` takes reservations and checks the margin
  left after queued claims for units, Iranian resources, political will, airlift,
  mated rounds and launcher sorties. Reservations are recomputed from the queue
  on every check and never stored, so removing an order releases its claim.
- `runTurn` re-validates the queue against the live snapshot before resolving;
  an order that no longer holds is dropped with a logged `Order dropped: …`
  event instead of being silently applied. Accepted orders reserve as they go, so
  the second of two competing orders fails honestly.
- `src/core/Game.ts`: `queueOrder` validates against `orderReservations(snap)`.
- `src/core/reservations.test.ts` (8 tests): produce double-spend rejected, claim
  released on removal, political-will double-spend rejected, reservations do not
  mutate the snapshot, unit and launcher-sortie claims enforced, and resolve-time
  revalidation both drops an unfunded order and keeps a valid one.

Verification after this item: `tsc` exit 0, 21 files / 194 tests passed, build
exit 0. The pre-war "a strike order opens hostilities" test now uses a legal
target, because resolution no longer accepts an invalid order; the intent (a
strike opens the war) is unchanged.

## 10. Phase 2 items 2-4

### Commits

| Commit | Item | Content |
|---|---|---|
| `ff3eda0` | 2 and 3 | `src/core/permissions.ts`, engine authorisation gate, `src/combat/specialOps.ts`, enumerated special outcomes, cyber intel/cost, tests |
| `581c625` | 4 | `src/combat/airdefence.ts`, layered engagement in strike/salvo resolution, detection, SEAD suppression, data-driven `adLayer`, tests |

Items 2 and 3 share one commit deliberately. Their engine changes live in the
same `validateOrder` cyber branch and the same test file; splitting them would
have produced an intermediate commit with failing tests, which is worse than one
coherent commit that closes both. Item 4 is separate and self-contained.

### Verification

| Command | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `vitest run` | 24 files, 213 tests passed, exit 0 (was 194) |
| `pnpm run build` | exit 0 |
| YAML | **parsed**: `npx --yes js-yaml .github/workflows/ci.yml` exit 0. `js-yaml` and `yaml` are not installed locally; the earlier PyYAML gap is closed by this run. CI itself is still not executed. |
| Preview smoke | not rerun for these items; the last HTTP check was at Phase 1 closeout |

### Item 2 decisions

- `canPlayerOrder` is the single authority and is called at the top of
  `validateOrder`; per-case ownership and faction checks were removed from the
  engine so there is one answer. Range, resources and target rules remain in the
  per-kind branches.
- `SCOPE` is `Record<Order['kind'], …>`, so adding an order kind fails
  compilation until its permission class exists. No unused `mine` kind was added:
  typing it now would let an unimplemented action into the union.
- Rejected: matching on unit-id strings in the UI. The UI keeps its affordances,
  but they are no longer the enforcement point; the tests call the engine.

### Item 3 decisions

- Five outcomes: success, partial, failure-survived, failure-lost, abort. Abort
  covers a missing or already-destroyed facility, consumes no roll and changes
  nothing. Success -30 integrity, partial -12 and -2 legitimacy, failures -5
  legitimacy, and only failure-lost removes the team. The report text is derived
  from the outcome, so the log and the snapshot cannot disagree.
- Chosen mechanic for the old bug: a failed op normally survives the team; only
  the explicit worst roll loses it and removes it. The previous text claimed a
  loss without a removal.
- Cyber now requires a geolocated (revealed) Iranian launcher and costs 2
  political will through reservations. This makes cyber weaker early and stronger
  after Iranian launches reveal launchers, which is the intended intel loop.

### Item 4 decisions

- Layering is data-driven: `adLayer` on eight AD units plus existing `intercept`,
  `coverage`, `interceptCost`, `engages` and `magazine`. Engagement tries long,
  then medium, then point; each munition can be intercepted once and spends one
  interceptor. A missing layer is a weaker site, not a relabelled percentage.
- Detection is per raid, before engagement. Sensors come from AD units, airbases,
  naval nodes and radar nodes, restricted to the defender's own facilities;
  terrain, signature class and stealth modify the odds. Undetected raids never
  engage and never cause interceptor expenditure.
- SEAD is turn-scoped suppression: a hit on a radar/airbase/naval node or an AD
  unit suppresses that node or nearby AD for the rest of the turn, so a second
  strike in the same turn sees the opened hole.
- Loss risk derives from the surviving layers, depth/range, stealth, escort and
  hardened target, clamped to 0.5-35%, and uses the seeded RNG.
- Both the player and the AI call the same `resolveStrike`; Iranian salvos use the
  same layered path through `resolveIncoming`. No AI-only branch exists in combat.
- Kept: one magazine point per strike, `atk × armour`, buried-depth penetration,
  repair cycle, ROE damage multiplier. `bestDefence` remains exported for
  compatibility but resolution no longer calls it.
- Rejected: multiple interceptors per munition (the brief says one launch consumes
  one interceptor); theater-wide air superiority (it is local to the engaged hex);
  separate player orders for SEAD/BDA (item 4 only requires them to be represented
  in resolution).

### New issues found

- **No radar nodes in map data.** `facility: 'radar'` exists in the taxonomy but
  no map node uses it, so radar-range detection and node-level SEAD are currently
  exercised only by airbases/naval nodes and unit suppression. Severity: medium;
  relevant to item 8 (intelligence) and Phase 3 balance.
- **Cyber is unavailable until a launcher fires** because only revealed launchers
  are valid targets. Intended, but it needs a UI hint; UX is Phase 4.
- **`bestDefence` is now unused by resolution.** Dead path kept for compatibility;
  remove it when no test imports it.
- **Iranian AD remains an intrinsic abstraction** (0.18/0.22/0.12 layers plus the
  superpower shield), not unit-based, because Iran has no interceptor economy in
  the inventory model. Documented rather than silently changed.

### 57-row movement

Closed: projected order validation (item 1), engine-level permission enforcement
including US/Israeli cyber separation (item 2), special-operations outcome/state
consistency (item 3).
Partially closed: air-defence layering and radar/detection (item 4). Staging is
represented inside strike resolution (SEAD suppression, local superiority, BDA via
integrity state), but there are no separate staging orders; attacker loss now
depends on the defensive state. Full closure needs item 8 detection decay.
Open: item 5 onwards. `mdf.md` is not in the repository, so item 5's exact
definition is not available here; nothing was invented for it.

### Scope check

Files changed for these items: `src/core/permissions.ts`, `src/core/engine.ts`,
`src/core/types.ts`, `src/combat/airdefence.ts`, `src/combat/specialOps.ts`,
`src/combat/combat.ts`, `src/data/units.json`, and three test files
(`permissions`, `special`, `layered`). No AI doctrine, UX, i18n, replay or turn
duration change. Working tree clean after the docs commit.

## 11. Phase 2 item 5 — missile and drone stock classes

Commit: `feat: label iranian stock classes against the weapon taxonomy`.

- `DeliveryClassInfo` now carries the §18 taxonomy name and a `contested` flag;
  Fattah is marked contested, matching its wider uncertainty band (§18 warns
  against treating marketing claims about its hypersonic performance as fact).
- Class isolation is pinned by `src/core/stockClasses.test.ts` (5 tests): firing
  Fateh leaves Khorramshahr, Fattah and ASM stock untouched; the drone and
  ballistic launcher pools do not lend to each other; ASM draws its own rounds on
  the ballistic pool; `deliverMatedRounds` mates only the built class.
- Existing behaviour preserved: one authoritative rounds record, production
  gated on facilities/condition/capacity/resources, launcher sorties shared by
  player and AI, Fattah's ±40% band already wider than Khorramshahr's.

Verification: `tsc` exit 0, 25 files / 218 tests passed, `build` exit 0.

Remaining item 5 gap, recorded rather than faked: §18 also lists cruise missiles
and reconnaissance drones. No cruise or recon-drone unit exists in `units.json`,
so no stock class was invented for them; adding those units is data work that
belongs with the scenario expansion in Phase 5. Iranian production stays the
documented facility/capacity abstraction (§19 conversion documented in Phase 1).

## 12. Phase 2 item 6 — maritime orders

Commit: `feat: add maritime mine, clearance and escort orders`.

- `src/core/maritime.ts`: per-hex `Minefield` state (`mines`, `detected`,
  `laidTurn`), `layMines`, `detectMinefields`, `clearMines`, escort coverage
  (cap 3, decays one per turn), and `maritimeThreat` for Hormuz.
- Orders `mine`, `clear`, `escort` are in the `Order` union, classified in the
  permission `SCOPE` map, validated and reserved by the engine, and resolved in
  `applyOrder`. Mining consumes `iran.mines` per mine (max 3 per sortie) and only
  in sea hexes; clearance requires a located field; each ship acts once per turn.
- Hormuz disruption now comes from minefields within four hexes of the strait
  (with pipeline/reroute resilience) instead of `minesLaid × 15%`. Escort coverage
  subtracts risk. The global counter remains a historical tally only.
- `src/ai/ai.ts`: the hidden mine decrement is deleted. The AI validates and
  applies the same `mine` order, so it consumes the same stock and obeys the same
  sea-hex/range rules.
- Tests: `src/core/maritime.test.ts` (6) cover laying, land/wrong-unit/empty-stock
  rejection, detection by a coalition warship, clearance of located fields,
  refusal of unlocated ones, minefield effect on the index, and escort cap/risk.

Verification: `tsc` exit 0, 26 files / 224 tests passed, `build` exit 0.

Known gap, recorded: the unit action sheet does not yet expose mine/clear/escort
buttons, so the orders are engine- and AI-usable but not yet clickable. That is a
UI slice for Phase 4; the engine rules are the acceptance-critical half and are
covered by tests.

Item 6 follow-up (`fix: consume Houthi ammunition on every launch`): Houthi
attacks previously bypassed ammunition entirely. Each launch now spends one
magazine point from the firing unit and an empty launcher cannot fire, matching
§20's "other maritime actors" rule. Test added: six resolved turns leave no
Houthi magazine negative and never increase the total.

## 13. Phase 2 item 7 — transport modes

Commit: `feat: split logistics into airlift, sealift and naval modes`.

- `Reinforcement.mode` is `airlift | sealift | naval`, set from
  `logistics.json` and backfilled by `transportModeOf` for older saves.
- `transportAccess` gates delivery: airlift needs one of the six coalition
  airbases above 25 integrity; sealift needs Haifa, Aden or Basra above 25;
  naval needs Suez open or Hormuz below 85.
- Delay accrual is mode-specific. Hormuz risk (above `interdictHormuz`) delays
  sealift and naval only. Lack of a receiving airbase/port delays any mode.
  Suez adds two turns to sealift/naval transit but never to airlift.
- `tankerSorties` is live: one per airlift package, one per Israel airlift, and
  validation reserves them per order. Regenerates one per turn, capped at 8.
- Due shipments are held with a logged reason when `transportAccess` fails
  instead of landing.
- Tests: `src/core/transport.test.ts` (6) cover mode recording, old-save
  fallback, tanker cost, airlift immunity to strait risk vs sealift delay,
  tanker rejection, and airbase-denied holding. Transit tests now use a sealift
  package because that is the mode the strait actually affects.

Verification: `tsc` exit 0, 27 files / 231 tests passed, `build` exit 0.

Gaps: the reinforcement panel shows ETA but not the transport mode; Suez remains
a scenario-level boolean rather than a node that can be attacked.

## 14. Phase 2 item 8 — intelligence

Commit: `feat: make intelligence positional, decaying and honest`.

- `src/core/intel.ts` owns coverage: humint (SOF, 6 hexes, ±8%), ISR (MQ-9,
  12 hexes, ±18%) and no coverage (±35%). `updateIntelligence` runs every turn
  before chokepoints: a unit under coverage becomes revealed and gets
  `lastSeen`; a revealed unit unseen for more than 3 turns loses `revealed`.
  This is the detection decay item 4 recorded as missing, and it now applies to
  the AI's target list too.
- `informationState` returns unknown / estimated / identified / tracked:
  humint is tracked, ISR is identified, stale sightings degrade to estimated,
  never-seen units stay unknown.
- `unitStrengthEstimate` no longer hard-codes 'none'. It reads the unit's hex,
  narrows with coverage, widens 25% per stale turn (capped at 3), and returns
  `null` for units the viewer has never located. Hex view filters unrevealed
  enemy units, closing a leak where their names and strength were listed.
- UI enemy chips append the localised information state; four i18n keys added
  in English and Persian. `fog.test.ts` updated to assert no band for an
  unknown unit and a band once located.
- Tests: `src/core/intel.test.ts` (5) cover coverage ranges, reveal/stamp,
  decay to unknown, no invented estimate, and band narrowing with ISR.

Verification: `tsc` exit 0, 28 files / 236 tests passed, `build` exit 0.

Gaps: the player cannot task recon; coverage is passive from SOF/MQ-9
positioning, which the spec allows but does not make a decision. No per-target
decay for facility integrity estimates (only units). UI labels were not visually
inspected.

## 15. Phase 2 item 9 — diplomatic state effects

Commit: `fix: give Russia and China distinct diplomatic effects`.

- Russia and China are no longer one `max` tier. `russiaTier` drives Iranian AD
  (shield +3% at tier 1, +6% plus radar detection at tier 2) and owns the
  no-fly zone at tier 3. `chinaTier` drives oil income (+30% / +45%) and, at
  tier 3, a recurring -2 US political will per turn. Tier-change text is now
  per actor, so a Russian tier no longer reports Chinese sanctions relief.
- The no-fly zone check in `validateStrike` exempts naval units: it closes
  Iranian airspace to aircraft, not to sea-launched missiles.
- Pakistan's defensive intervention no longer invents two fighter squadrons.
  It reports air-defence crews and intelligence sharing, reinforces Prince
  Sultan Air Base by +10 integrity, and leaves the unit list unchanged.
- `HOST_ORDER` now includes Jordan and Egypt, so their host states decay,
  restrict, close and reopen instead of sitting frozen at scenario values.
  Egypt's Suez closure already keys off sustained Hormuz disruption
  (`hormuzTurnsAbove70 >= 5`), which is a real state change with a reversal
  path when the meter falls.
- Tests: `src/politics/diplomacy.test.ts` (4) cover income attribution, the
  NFZ air/naval split, the honest Pakistan package, and Jordan reopening.

Verification: `tsc` exit 0, 29 files / 240 tests passed, `build` exit 0.

Gaps: Oman remains a neutral node with no mediator mechanic of its own (the
talks channel is Qatar's); Egypt's Suez closure is not tied to its host threat,
only to the Hormuz clock.
