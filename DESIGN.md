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
