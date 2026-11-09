# Chokepoint — Audit and Phase Log

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
