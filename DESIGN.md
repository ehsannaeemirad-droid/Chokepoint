# Chokepoint — design notes

## Pillars

1. **Geography is the antagonist.** The Strait of Hormuz, the Gulf basing network and the depth of
   Iran are the real opponents. Every unit exists to make one of those three facts hurt.
2. **Allies are a resource that can be spent.** Host nations are not scenery: they meter sorties,
   then close their gates. Winning militarily while losing basing access is a real failure mode.
3. **Scarcity over stats.** Interceptors, munitions, political will and airlift are small, visible
   pools. A strike is a decision about what you will not be able to do later.
4. **Deterministic and inspectable.** Same seed plus same orders gives the same campaign, and every
   event in the log explains its cause with numbers.

## Architecture

```
main.ts ── Phaser.Game(scale: RESIZE) ── MapScene
   │                                        │
   └── Ui (DOM overlay) ── bus ─────────────┘
                     │
                     └── game (Game singleton) ── runTurn() ── combat / ai / politics
                                                        │
                                                   snap: GameSnapshot (plain JSON)
```

- **`GameSnapshot` is the entire mutable state.** Plain JSON: units, node integrity, host postures,
  resources, meters, log, order log. No Phaser objects, no class instances, no cycles. This is what
  makes save/load, replay and tests trivial.
- **`Game`** owns scenario setup, selection, order queueing, persistence and the subscription used by
  the UI. `runTurn(snap, map)` is a pure-ish function of the snapshot, the static map and nothing else.
- **`TheaterMap`** is static: hex tiles with terrain/ownership, node placement, `hexToNode` lookup.
  It is built once from geography and reused by every layer.
- **UI is DOM, not canvas.** Text stays crisp, is selectable by screen readers, and costs no draw
  calls. `MapMarkers` keeps only geometry in Phaser (unit pips, ownership dots) and positions DOM
  labels from `cam.worldView` each frame. Event delegation on `#ui-root` keeps one listener per
  surface instead of one per button.

## Map

- Pointy-top hexes, odd-r offset storage, `HEX_R = 30` px (≈ 60 km at this scale).
- 79 columns × 70 rows = 5,530 hexes over 26°E–78°E, 8°N–44°N.
- Land is painted water-first: continent polygons (Africa, Eurasia + Arabia) plus explicit water
  polygons (Mediterranean, Black Sea, Caspian, Red Sea, Persian Gulf, Arabian Sea). Painting water
  explicitly is what keeps Hormuz and the Red Sea navigable instead of accidentally landlocked.
- Terrain is sampled per hex from those polygons, mountain polylines, desert regions and city radii.
  Country ownership is a nearest-anchor assignment among national anchor points.
- Strategic nodes (38 of them) carry their own terrain override: nuclear sites are `hardened`,
  chokepoints snap to water.

### Chunk streaming

Each 16 × 16 chunk is rendered once into an offscreen `<canvas>`: one hex polygon fill plus a 14%
owner tint, then uploaded via `textures.addCanvas` and drawn as a single image. The renderer keeps
the viewport plus a one-chunk ring and builds at most two chunks per frame after the first pass, so
camera movement never triggers a frame spike. Chunk keys must be identical in the texture cache and
the chunk map — an earlier mismatch rebuilt the same two chunks forever and left the screen
half-painted.

## Turn pipeline

```
orders → AI military phase → attrition → arrivals → chokepoint + host politics → third parties → outcome
```

1. **Orders** are validated when queued and re-validated implicitly by the resolver.
2. **AI** runs behaviour trees from `data/ai/trees.json` against a small action registry
   (`strike`, `move`, `produce`, `restrict`, `close`, `mediate`, `intervene`). Iran, the Houthis and
   the host states each have their own tree; the tutorial uses a scripted tree.
3. **Attrition** resupplies interceptors, regenerates airlift, lands reinforcement packages, applies
   Iranian war costs, then recomputes Hormuz, host postures and third-party triggers.
4. **Outcome** is evaluated from node integrity, base state, launchers, population impacts and the
   surviving regime, relative to the player's faction.

### Combat

A strike is a small engagement, not a damage roll:

- Range is the unit's `rng` plus a host-airspace modifier (Saudi or UAE withdrawal costs range).
- Offensive missions cannot launch from a restricted or closed host.
- Each munition is engaged by **the best available defensive system** in coverage against its threat
  class: drone, cruise, ballistic or hypersonic. Interception costs shared interceptors, and
  saturation (7+ munitions) reduces defensive probability.
- Damage to a hardened site is reduced unless the attacker is a bunker-buster (B-2), so Fordow
  demands either the B-2 or sustained pressure. Non-hardened facilities take roughly 4× damage.
- Deep strikes into Iran carry a small loss chance per sortie; losses are permanent.
- **One mission per unit per turn.** Validation rejects a second strike or special-operations order
  from the same unit, so air power is a sustained rate rather than a burst. Aircraft rearm +2
  munitions per turn (capped at their magazine); the B-2 is limited by its four-turn cooldown instead.
- **Damage control.** Friendly airfields with at least 1 integrity repair 5 points per turn while
  their host is open. A base reduced to zero cannot repair, which makes knocking one out decisive.
  Without this the four Gulf bases are attrited to nothing in under ten turns and the campaign is
  unwinnable.
- **Defensive coverage matters.** Patriot engages drones, cruise and ballistic missiles; THAAD is
  ballistic-only; a CSG carries its own Aegis bubble. An earlier build let drones bypass every US
  system, which made Iranian drone salvos unanswerable and ended the US campaign by turn five.

### Buried targets

Depth is data, not a special case: `mapNodes.json` gives Natanz `buried: 25` and Fordow `buried: 60`,
and every warhead carries a `penetration` figure in metres (B-2/MOP 60, F-15E/F-15I with GBU-28 6,
B-52 stand-off 3, F-35 2, cruise missiles ~1, drones 0). If penetration is below the depth the strike
is capped at `surfaceFloor` (55) — the player wrecks the power, roads and centrifuge feed halls but
the cascade hall survives — and the log says so explicitly. The model is deliberately blunt: it
reproduces the real constraint that only one aircraft in the theatre can threaten Fordow, without
pretending to simulate weapon physics.

### Politics

- `recordImpact` cascades: node impacts raise the host's threat, Iranian soil raises Iran's war cost,
  oil nodes move the price, Israeli population nodes move domestic tolerance, US facilities cost
  political will.
- Host thresholds are per country (`hostThresholds`). Kuwait restricts at 60 and closes at 85;
  Turkey at 40/70; the rest at 70/90. Closures expire and reopen at a reduced threat.
- Hormuz disruption is scored from ASM batteries, fast attack craft, mines and Houthi anti-ship
  batteries, minus coalition naval presence and an open Bahrain. Above 50 it feeds host threat; above
  70 for five turns it closes Suez, and for three turns it brings Indian pressure.

### Determinism

Every random draw comes from `factionRng(seed, turn, salt)` — mulberry32 seeded by hashing the
campaign seed, the turn number and a purpose string. There is no `Math.random()` in resolution, and
reinforcement unit ids are derived from turn and roster length rather than a random counter. Two
campaigns with the same seed and orders produce byte-identical snapshots (asserted in
`engine.test.ts`), which is what makes the exported replay meaningful.

## Balance at a glance

| System | Value |
| --- | --- |
| Theatre | 79 × 70 hexes, ~60 km per hex |
| US start | 100 interceptors, 50 political will, 10 airlift |
| Israel start | 60 interceptors |
| Iran start | 140 resources, 56 drones, 28 Fateh, 12 Khorramshahr, 5 Fattah, 3 minefields in stock |
| Host restrict/close | Kuwait 60/85, Turkey 40/70, others 70/90 |
| Strike range | F-15E 24, F-35A 24, B-52 34, B-2 40, F-15I 33, F-35I 31 hexes |
| Iranian reach | Fateh 9, Khorramshahr 27, Fattah 27, Shahed 20 hexes |
| Victory clocks | Israel survives 25 turns, Iran 30 turns, Iran war-cost threshold 100 |
| Sustainment | one mission per unit per turn, +2 air munitions/turn, +5 base integrity/turn |

Range values are set against the actual grid: Al Udeid to Natanz is 16 hexes and Hatzerim to Natanz
is 28, so both coalitions can reach the nuclear sites while still depending on host airspace.
`engine.test.ts` asserts that reachability so a future balance edit cannot silently make the campaign
unwinnable.

## Tradeoffs and deviations

- **Qatar mediation is automatic.** The spec allowed a player choice; it is modelled as a triggered
  event so the turn pipeline stays deterministic and the AI has no negotiation state to track.
- **Cinematics are an overlay.** Events are paced onto a skippable overlay instead of rendered
  footage, which keeps the bundle small and respects the "skippable" requirement literally.
- **Replay is export-only.** The engine can re-run `orderLog` (and the determinism test proves it),
  but there is no scrubber UI.
- **Phaser dominates the bundle.** 357 kB gzip of a ~411 kB initial payload. It is unavoidable with
  Phaser 4 and is reported rather than hidden.
- **Mobile performance is emulated.** 60–67 fps at 390 × 844 in desktop Chromium. Real-device GPU and
  thermal behaviour remain unmeasured.
- **No networking.** Single-player was the requirement; the snapshot model would allow a
  server-authoritative version later, since orders are the only inputs.

## Decisions

Every interpretive choice made while implementing the four Iranian victory paths (Phase 1) is
listed here. Thresholds live in `src/data/scenarios.json` under `campaign.victory`; the code
reads them from `snap.victory`.

### Baseline repair (pre-Phase 1 commit)

The uploaded repository did not compile: `politics.ts` contained a duplicated type import and a
duplicated `superpowerTier()`, `Game.buildSnapshot` omitted the `inflation`, `nuclearEscalation`
and `nuclearStrikes` meters and the whole `superpowers` block, and `campaign.test.ts` was two
test files concatenated with junk identifiers (`zipperOrders`, `zsAdmin`, phantom `ashm` units).
The repair commit restores the unique real tests; the no-fly-zone test now actually crosses the
tier-3 threshold (great-power stance 85, the old file used 45 and passed vacuously).

### Path semantics

1. **Regime survival.** "Regime intact" is defined as `tehran.integrity > 0` and
   `leadershipStrikes <= 3` — the same two facts the old turn-30 win required. The path needs
   (a) that regime state intact for at least the final `finalTurns` (10) consecutive turns —
   tracked as a per-turn streak that resets whenever the regime falters — and (b) at least one
   of Isfahan/Natanz/Fordow *strictly above* `nuclearIntegrityThreshold` (40) at the final turn.
   Strictly above is the conservative reading of "still above a defined integrity threshold".
2. **No occupation.** "US ground forces holding a node" means a US unit of ground category sits
   on the node's hex; the count of distinct Iranian-owned nodes must reach `nodesRequired` (4)
   for `turnsRequired` (3) consecutive turns. The *longest* streak ever reached is remembered:
   once the US reaches the occupation state, the path is denied for the rest of the campaign
   even if the US later withdraws. **Balance consequence, flagged for the owner:** the current US
   roster has no ground-category formations, so the US cannot deny this path; if the campaign
   reaches turn 30 without an earlier US win (hardened sites down, or Iran's war-cost
   ceasefire), the no-occupation path is satisfied and the coalition player loses on points.
   This is the literal spec reading ("if the US never reaches that state, this path is
   satisfied"), and it makes the US campaign a race against the clock by design. Adding US
   ground formations or a denial mechanism is a balance decision reserved for the owner.
3. **Oil shock.** The existing `oilPrice` meter *is* the global index — no second meter was
   added. Its formula gained the sustained-disruption term the spec asks for:
   `60 + hormuz*0.9 + hormuzTurnsAbove50*2 + (suezClosed ? 25 : 0)`, clamped 40–220. Iran wins
   the moment the index holds at or above `indexThreshold` (130) for `consecutiveTurns` (5)
   consecutive turns; the streak resets the first turn it dips below. Inflation and great-power
   drift read the same meter, so a sustained strangle now also feeds those systems — intended.
4. **Israeli offense degraded.** Measurable capacity = Σ over Israeli air units of
   `(strength/100) × (0.75 + 0.25 × magazine/maxMagazine)`, divided by the Israeli air order of
   battle at scenario start (`meters.israeliAirAtStart`), × 100. Airframes carry 75% of the
   weight because airframe losses are the only permanent degradation in this engine; magazine
   readiness recovers in two turns and must not dominate. The path fires when capacity is below
   `capacityThreshold` (30) — with two squadrons at start, that means the air arm is effectively
   destroyed — **checked only at/after the deadline turn** `byTurn` (25), not continuously: the
   conservative reading of "falls below a threshold by a given turn", avoiding surprise
   mid-campaign endings while Israel is merely rearming.

### Structural choices

5. **Campaign end is now terminal for every faction.** The old code evaluated Iran's turn-30 win
   only after `snap.turn > 30` and left the US/Israel campaigns running past `maxTurns` with no
   outcome. The final turn now resolves the four paths: any path satisfied → Iran wins
   (player-relative `won`/`lost`), none → Iran's opponents win. The tutorial keeps its scripted
   ending because its scenario data sets `victory: null`.
6. **US will-collapse mirrored.** The old code gave the *Iran player* a win when US political
   will hit 0 but nothing happened to a *US player* in the same state. The same world state now
   ends the campaign for whoever is playing (US player: `lost`).
7. **`usDomesticLoss` hook.** The US-loss-on-domestic-grounds branch exists in `victory.ts` as a
   documented, inert stub; Phase 2's congressional/economic meter will drive it.
8. **Victory config travels on the snapshot** (`snap.victory`), not a module constant, so the
   outcome check, the UI and the replay all read the same numbers. Saves stay at version 1:
   `loadGame` normalizes pre-Phase-1 snapshots with the default thresholds and zeroed streaks
   (forward-compatible defaulting); the replay *format* version bump is deferred to Phase 6 as
   planned. Replays are unaffected either way — they carry only seed + order log.
9. **Victory panel visibility.** The strategic panel shows all four paths' live progress to
   every faction for now; Phase 4 (fog of war) will gate the Iranian-internal values for
   non-Iran players.
10. **Oil-shock vs. nuclear taboo ordering.** The nuclear-taboo loss for US/Israel players is
    evaluated before the immediate Iranian paths, so a campaign that ends by oil shock cannot be
    overwritten by a late nuclear release, and vice versa: a release is always a coalition loss
    first. Iranian immediate wins (oil shock, degraded Israel, will collapse) are evaluated
    before faction branches; faction branches before the final-turn block.
11. **Persian strings.** The victory panel is fully bilingual through the `i18n` dictionary.
    Outcome narrative strings remain engine-English, matching the existing battle-log
    convention; the Phase 6 template pass will localize them.

### Phase 2 — US domestic constraints

12. **One gauge, two drivers.** `snap.domestic.pressure = (100 − congress) × 0.6 + economy × 0.4`
    (0-100). `congress` (0-100 support) is moved by casualty events, nuclear escalation,
    quiet-turn recovery and the public-address order; `economy` (0-100 pressure) is a pure
    function of the inflation meter plus sustained oil spikes above 120. Nothing else moves
    the gauge. The existing `politicalWill` resource stays in place unchanged as the
    spendable political capital — the spec's "political capital" for the public-address
    action is that resource, so no second currency was invented.
13. **Casualty events** are: a US formation destroyed (weight 2 — crew/formation loss) and
    each impact on one of the four major US Gulf bases (weight 1). They accumulate during
    the turn and produce one bilingual-ready casualty report plus a graded congressional
    response (≥4 events: withdrawal-timeline resolution; ≥2: leadership briefing demand).
    Support drops 4 per event, capped at 20/turn; quiet turns recover 2. Base-impact
    casualties reuse the existing `recordImpact` cascade, so Israeli cities and Iranian
    nodes never touch the US meter.
14. **Restrictions are announced, never silent.** Congress ≤35 announces "Iran strikes
    restricted"; ≤20 announces "all strikes suspended"; both take effect at the *start* of
    the next resolved turn (`noticeTurns: 1`) — applied before player orders resolve in
    `runTurn`, so a mission can never be planned around a restriction that is already in
    force. Lifting requires support above threshold +8 (`liftBuffer` hysteresis) to avoid
    announcement flapping. Every announcement, entry into force and lift is a logged event
    with the trigger numbers. Only US formations are bound; Israeli operations are not.
15. **Economic budget cuts are announced too.** Interceptor resupply per airlift cycle:
    12 − 2 per 15 economy, floor 4. Airlift regeneration: 5 − 1 per 25 economy, floor 0.
    `lastResupply`/`lastAirliftRegen` on the state make any change detectable and logged
    ("cut" or "restored"), satisfying the no-silent-rules rule for the budget side.
16. **Public address order** (`{ kind: 'communicate' }`): costs 3 political will, +8
    congress, 3-turn cooldown. Validated like every order; US-only; the button lives in
    the strategic panel's domestic section with the cooldown visible.
17. **Domestic collapse is a two-turn condition.** `usDomesticLoss` fires when pressure
    holds ≥85 (`collapsePressure`) for 2 consecutive resolved turns (`collapseTurns`,
    tracked as `meters.domesticPressureStreak`). It mirrors like the will-collapse rule:
    US player loses; Iran player wins the same world state; Israel unaffected. Win checks
    (ceasefire, hardened sites) still evaluate first, so collapse cannot overwrite a
    campaign the US had already won.
18. **AI opposition produces real casualties.** The test suite silences the opposition by
    removing launcher units because `iranProduce` rebuilds munitions *within* the same AI
    phase — zeroing stock is not enough. That asymmetry is intended gameplay: Iran's
    production is turn-fresh, not turn-stale.
19. **Visibility.** The domestic section (gauge, drivers, restriction state, casualty
    total, public-address button) is visible to every faction — it is public news, not
    intelligence. Phase 4 fog gates enemy force data, not domestic politics. All panel
    labels are bilingual; engine log lines stay English per the existing convention.

### Phase 3 — logistics data, Israeli initiative, Qatar talks

20. **Reinforcement transit times are scenario data.** The package list moved verbatim
    from `engine.ts` to `src/data/logistics.json` (`packages` + `israelAirlift`). Routine
    supplies (interceptor airlift 3, Israel airlift 2, Patriot 4) sit inside the spec's
    2-4 turn window. Heavy formations (F-15E 5, THAAD 6, CSG 6) deliberately keep their
    existing transits: the spec's blanket "2-4 turns" would be a *balance change* to
    capital reinforcements, and the owner requires playtest evidence before balance
    edits. Flagged for owner decision.
21. **Israeli initiative** is a 0-100 track on the snapshot
    (`snap.israelInitiative`), drifting up to `driftPerTurn` (4) toward
    `launchWeight × iranLaunchPressure + legitimacyWeight × legitimacy`. Launch pressure =
    surviving launcher formations × 7 + national stock ÷ 10, clamped. The US player (only
    the US player) sets a stance — `approved` (+8, unblocks two strike packages when the
    level is ≥75), `constrained` (−12, Israeli offensive sorties stand down entirely),
    `accepted` (default drift) — with a 4-turn cooldown. Tier crossings are announced;
    the second package logs itself. Israel being an AI ally with its own mind is the
    point: high Iranian pressure *and* a legitimate coalition both push Jerusalem toward
    a freer hand.
22. **Qatar talks are a state machine on the snapshot** (`snap.ceasefire`):
    none → offered → talks → agreed (campaign ends) / collapsed. Qatar offers when any
    data-driven trigger holds (war cost ≥60% of threshold, Hormuz ≥50% for 4 turns, or
    US will ≤25), re-offers after a 6-turn cooldown, and an unanswered offer lapses after
    3 turns. Talks progress +6/turn (+4 when Iran's war cost is ≥80% of threshold, −8
    when the nuclear-escalation meter rose — strikes on Iranian soil poison the track,
    measured by an already-tracked deterministic signal instead of a new counter).
23. **Tiered armistice.** At progress 100 the campaign ends at the table: *favorable*
    (war cost ≥80% of threshold AND ≥3 operational Gulf bases) is a coalition win;
    *costly* is an Iranian win. Player-relative mapping: favorable → coalition player
    wins; costly → Iran player wins. The armistice check sits after the immediate
    Iranian paths and before faction branches, so a signed agreement supersedes the map
    but cannot overwrite a nuclear-taboo loss.
24. **Determinism preserved.** Neither the initiative track nor the talks consume RNG;
    both read only snapshot state. Coalition-AI package counts derive from the track
    level, so the replay guarantee holds (engine.test.ts still asserts byte-identical
    snapshots).

### Phase 4 — fog of war (presentation only)

25. **The engine state is untouched.** Every fog function in `src/ui/fog.ts` is
    read-only; the fog test asserts the snapshot serialises identically before and
    after estimation. Replay determinism is therefore unaffected by construction.
26. **What is hidden:** the enemy's exact ammunition, launcher and shelter-facility
    values. Concretely: facility-integrity readouts (hex card, strategic panel,
    strike-target list) and enemy unit-strength chips become estimate bands for a
    viewer who does not own them; the Hormuz fire-control breakdown counts only
    *revealed* Iranian batteries for non-Iran viewers (shown as `N+`). Iranian
    munition stockpiles were never displayed to non-Iran players, so nothing new
    was added there. Victory-path progress stays exact for every viewer: it is the
    scoreboard, not intelligence.
27. **Estimate bands are deterministic.** The band centre is jittered by a hash of
    (seed, turn, label), width = value × spread; the true value always lies inside.
    Bands are stable within a turn and reproducible across replays. Spreads:
    ±35% with no recon coverage, ±18% under a friendly MQ-9 within 12 hexes, ±8%
    with a special-operations team within 6 hexes. Zero stays exact — destruction
    is observable. Iran has no recon assets in the roster, so Iranian viewers live
    with the wide band; flagged for the owner as a future asymmetry decision.

### Phase 5 — map navigation and target selection

28. **Navigation surfaces.** The right-edge control stack gains ⚑ (cycle my
    formations), ⚠ (next threat, nearest-revealed-first with a wrap-around visit
    list), ▣ (minimap toggle) and ⌖ (the jump drawer). The drawer lists all 38
    strategic nodes with a bilingual search box (matches English name, Persian
    `name_fa`, kind and host) and kind filter chips; rows are 46px tall and jump
    the camera plus select the hex. The minimap paints static terrain once per
    scenario into an offscreen canvas, overlays node dots, visible unit pips and
    the camera rectangle on a 160 ms loop, and jumps the camera on tap.
29. **Targeting parity.** The valid-strike-target discovery moved to
    `src/combat/targets.ts` (`strikeTargetsFor`) and both the unit sheet's target
    list and the new map overlay consume it, so the list and the highlights can
    never disagree. In strike mode the overlay fills valid target hexes, rings
    them, and marks hardened/buried sites with an amber warning triangle (the
    restriction marker). Range rings remain from the existing overlay.
30. **Long-press hex info.** A 450 ms press with <10 px drift opens the hex
    card directly (`game.selectHex`), alongside the existing data-tip tooltips.
31. **Keyboard support.** Arrows pan (via a new `pan` bus event → `MapScene.panBy`),
    `+`/`−` zoom, `N` next ready unit, `T` next threat, `J` jump drawer, `M`
    minimap, `Escape` closes overlays. Input is ignored while typing in the
    search field. All new controls carry bilingual `aria-label`s and the drawer
    is `role="dialog"`.
32. **Reduced motion.** `prefers-reduced-motion: reduce` disables CSS transitions
    globally and the turn-resolution cinematic prints all lines instantly instead
    of pacing them.

### Phase 6 — content and localisation

33. **Persian via named-variable templates.** The engine keeps writing English into the snapshot
    (that is what keeps replays byte-identical), and `src/i18n/log.ts` renders Persian at the
    presentation layer: an ordered table of `[regex, template]` pairs whose patterns use NAMED
    capture groups and whose templates interpolate those names (`{turn}`, `{support}`,
    `{dir,select,cut|…|restored|…}`, `{int,optional,…|}`) — never positional concatenation, never
    Persian string-building inside TS engine code. First match wins; unmatched lines fall back to
    the English original and both the log and the cinematic say so.
34. **Outcomes are a closed set.** Every campaign-ending string in `victory.ts` and the tutorial
    endings translate through an exact-match dictionary. A test plays full campaigns for all three
    factions and asserts each terminal outcome is known and renders Persian.
35. **Format v2, one release.** Save files and replay exports are now format v2 and the package
    version is 0.2.0. v1 saves migrate on load through the same normalizer that has handled
    pre-Phase-1 snapshots since Phase 1 (defaults for every new block, never overwriting present
    values). The replay payload semantics are unchanged — seed + order log — so old replays remain
    valid; the version bump marks that newer snapshot fields exist alongside. Migration notes live
    in this file and the README.

### Improvements — post-plan priorities (owner-picked 1, 2, 6, 7)

36. **Escalation ladder & red lines.** The `nuclearEscalation` meter finally has a readable
    ladder: data-defined rungs (`campaign.escalation.levels` → `snap.escalationCfg`) recompute
    each turn in a new escalation phase that runs right after the chokepoint economics. Each rung
    adds a per-turn great-power stance drift and host-nation threat, so a hot war drags the whole
    region with it. Red lines are named one-shot tripwires (nuclear use; leadership decapitation
    at three Tehran strikes; a destroyed nuclear complex; four consecutive turns of Hormuz
    disruption ≥ 70). Crossing one applies a discrete consequence package — escalation jump,
    great-power hostility jump, US political-will drop, Iranian resource mobilisation — exactly
    once, tracked by id in `snap.escalation.fired`, and logs every number. No RNG anywhere in the
    phase. **Baseline repair folded in:** `updateSuperpowers` existed from the start but was
    never called by the turn pipeline; the escalation phase now runs it right after the ladder,
    so the great-power tiers (arms pipeline → shield → no-fly zone) actually respond to play.
37. **Red-line labels live in data.** The four campaign red lines are scenario JSON with
    `label`/`label_fa`; the engine interprets condition fields and never hardcodes strings. The
    Persian log pass translates each known line's frame and label with named capture groups; the
    effect shorthand (e.g. `escalation +8`) deliberately stays English per the fallback
    convention.
38. **Logistics depth: the meter decides, not the dice.** Phase 3 gave every
    package a fixed transit; improvement 2 makes the sea lane itself matter.
    While Hormuz disruption sits above the scenario threshold
    (`campaign.logistics.interdictHormuz`, default 60), every in-transit
    shipment accrues one turn of delay per resolved turn, capped by
    `maxDelay` (3) so nothing is lost forever — contested water holds freight
    offshore, it does not vaporise it. Delays are plain snapshot state
    (`Reinforcement.delayTurns`, normalized to 0 for older saves) and the
    arrival filter uses `effectiveArrival(r) = arrivesTurn + delayTurns`, so
    replays stay byte-identical. A due-but-delayed package is never
    re-delayed past its cap, and requesting reinforcement while the strait
    burns logs a warning up front. The pending list shows the slipped ETA and
    a `+N strait delay` badge.
39. **ROE posture presets.** The coalition player sets a national
    rules-of-engagement posture — constrained / standard / aggressive — as a
    free turn order (`{ kind: 'roe' }`). The posture is *policy*, not a
    tactical order: it colours every coalition strike from US and Israeli
    formations alike (player and AI), while Iranian targeting is never
    bound. Effects are scenario data (`campaign.roe` → `snap.roeCfg`):
    constrained forbids strikes on Iranian population centres, leaves a ×0.5
    escalation signature and −10% damage, and buys +1 congressional support a
    turn; aggressive buys +15% damage at ×1.5 escalation, −1 congress a turn
    and +1 host-nation threat a turn — partners notice loose rules. The
    posture-change order logs the full effects package with numbers (and
    translates via three named-variable templates); per-turn drift is silent
    by design because the change event already announced the standing
    policy. `recordImpact` gained an optional attacker so escalation scales
    at the source; multipliers return 1 for non-coalition attackers and for
    snapshots without the block, so old saves and replays are unaffected.
40. **Multi-axis graded settlement.** A terminal outcome is no longer only a
    binary string: once `checkOutcome` ends a campaign (any terminal branch —
    paths, armistice, will collapse, basing collapse — except the tutorial's
    scripted ending), the engine computes a six-axis scorecard and stores it
    on the snapshot. Three axes belong to Iran (regime standing, strait
    stranglehold, Israeli air attrition) and three to the coalition (nuclear
    complex destroyed, US domestic consensus, Gulf basing network); each is
    scored 0-100 against its own definition, weighted by scenario data
    (`campaign.scorecard`, weights sum to 100 across the six), and each
    side's total is normalized to its own weight sum so both read 0-100. The
    margin picks a graded verdict — decisive / clear / narrow win per side,
    or stalemate on points. The turn log gets a one-line settlement summary
    (with a Persian template); the outcome modal renders the full axis table
    with bilingual labels. Deterministic and built exactly once
    (`!snap.scorecard` guard), so replays stay byte-identical.
41. **Format v3, one release.** The improvement blocks (escalation ladder and
    fired red lines, logistics thresholds and per-package delays, ROE
    configuration and standing posture, scorecard weights and the stored
    settlement) live on the snapshot as optional fields, so save files and
    replay exports bump to format v3 and the package version is 0.3.0. v1 and
    v2 saves migrate on load through the same normalizer (defaults for every
    new block, never overwriting present values; in-transit packages keep
    their base ETA with `delayTurns: 0`). The replay payload semantics are
    unchanged — seed + order log — so v1/v2 replays remain valid. Migration
    notes live in this file and the README.
