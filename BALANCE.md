# Balance report — multi-seed win distribution

> **Pre-fix directional baseline.** This report was generated before the coalition
> counter-battery adjustment in `841b52b`. It is retained as a directional
> baseline, not as a post-fix win-rate claim.

Generated from fresh headless campaign runs (not hand-written). Rules and data version 1.0.0;
scenario `campaign`, eight seeds per faction, 30-turn limit. The player policy is deliberately
simple: every available aircraft strikes the nearest valid hostile node each turn; the US and
Israel also constrain ROE, airlift when possible, escort shipping and clear detected mines.
Iran only strikes. No diplomacy, production or talks are issued, so this is a floor on player
agency, not a claim about optimal play. Runs are deterministic for a given faction and seed.

Status `playing` means the 30-turn limit was reached without a terminal outcome.

## Distribution by faction

| Faction | Runs | Won | Lost | Playing | Avg end turn | Avg oil | Avg Hormuz |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| United States (defensive policy) | 8 | 1 | 7 | 0 | 26.9 | 70 | 11 |
| Israel (defensive policy) | 8 | 0 | 8 | 0 | 30.0 | 71 | 13 |
| Iran (strike-only policy) | 8 | 8 | 0 | 0 | 30.0 | 69 | 10 |

## Per-run rows

| Faction | Seed | Status | Turn | Outcome | Oil | Hormuz | Drones | Ballistic | Mines | Interceptors | Will | Posture |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| usa | 11 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 308 | 252 | 0 | 317 | 30 | constrained |
| usa | 22 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 310 | 252 | 0 | 308 | 22 | constrained |
| usa | 33 | lost | 25 | Israel's offensive air arm has been worn down past the breaking point — too few squadrons remain combat-ready. Iran has degraded the coalition's sharpest sword. | 68 | 9 | 226 | 188 | 0 | 298 | 18 | constrained |
| usa | 44 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 83 | 25 | 308 | 250 | 0 | 360 | 14 | constrained |
| usa | 55 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 309 | 250 | 0 | 320 | 30 | constrained |
| usa | 66 | won | 10 | Iran accepted a ceasefire: its war cost passed the threshold while the Gulf basing network held. | 68 | 9 | 81 | 78 | 0 | 252 | 22 | constrained |
| usa | 77 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 312 | 255 | 0 | 365 | 16 | constrained |
| usa | 88 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 303 | 243 | 0 | 325 | 22 | constrained |
| israel | 11 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 74 | 15 | 342 | 270 | 0 | 287 | 34 | constrained |
| israel | 22 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 320 | 257 | 0 | 278 | 30 | constrained |
| israel | 33 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 322 | 253 | 0 | 287 | 30 | constrained |
| israel | 44 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 83 | 25 | 340 | 269 | 0 | 286 | 36 | constrained |
| israel | 55 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 330 | 262 | 0 | 290 | 34 | constrained |
| israel | 66 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 74 | 15 | 321 | 258 | 0 | 290 | 30 | constrained |
| israel | 77 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 338 | 269 | 0 | 290 | 36 | constrained |
| israel | 88 | lost | 30 | The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way. | 68 | 9 | 335 | 265 | 0 | 265 | 34 | constrained |
| iran | 11 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |
| iran | 22 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |
| iran | 33 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |
| iran | 44 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |
| iran | 55 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |
| iran | 66 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |
| iran | 77 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |
| iran | 88 | won | 30 | The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result. | 69 | 10 | 72 | 52 | 4 | 269 | 50 | standard |

## Reading

Across 24 runs the simple policy produced 9 wins, 15 losses and 0 time-limit games. Coalition outcomes vary across seeds (including one US ceasefire win at seed 66 and a turn-25 Israeli loss at seed 33); the strike-only Iranian run is identical on every seed, so this artifact does not by itself show Iranian seed sensitivity.

## Endurance calibration (task 3)

Measured with the same crude player policy as the baseline above (coalition
aircraft strike the nearest hostile node; Iran fires its launchers), eight seeds
per faction, 30-turn limit, endurance systems toggled on the started snapshot.
Eight seeds is a small sample: these rows are directional evidence that the
mechanics engage and do not freeze a side, **not** a win-rate claim.

| Systems | Faction | Won | Lost | Playing | Avg end turn |
| --- | --- | ---: | ---: | ---: | ---: |
| off | usa | 0 | 8 | 0 | 23.0 |
| off | israel | 0 | 8 | 0 | 30.0 |
| off | iran | 6 | 2 | 0 | 26.9 |
| on | usa | 0 | 8 | 0 | 21.4 |
| on | israel | 0 | 8 | 0 | 30.0 |
| on | iran | 8 | 0 | 0 | 26.5 |

Reading:

- **No side is frozen.** Every run issues strikes and terminates; munitions are
  spent, carriers and crews age, and Iran's production curve runs.
- **Iran now wins 6/8 off and 8/8 on after the launcher-reload fix.** Before it,
  every Iranian launch unit fired once and went dry, so the player's campaign
  collapsed after a few turns. The reload restored the intended tempo; the
  remaining coalition losses are driven by the coalition's own sortie and
  interceptor economy, not by Iranian units freezing.
- **The proxy formations contributed to the coalition's losses.** Hezbollah,
  Hamas and the PMF now fire finite magazines from Lebanon, Gaza and Iraq; their
  opening salvos add pressure on Israeli interceptors and US bases, then decline
  as their stocks run out.
- **IRIAF effectiveness stayed at the sourced 0.2.** Raising it to 0.5 changed
  no outcome across an earlier eight-seed sample, so weakening a documented
  figure would have been an unmeasured change.
- **The baseline table above predates the launcher-reload fix.** It is kept as
  the pre-fix measurement; the table in this section is the current one.
- **`base_pk` / `interception_pk` are model values, not published facts, and are
  used in combat.** Interception reads the data row; mapped strike units scale
  damage by `0.6 + 0.4 × Pk`. Coalition airframes now map to sourced JDAM,
  SPICE, JASSM and Hellfire records.
- **GPS denial changes the `on` row.** With the Endurance preset, JDAM falls back
  to 30 m INS-only CEP and JASSM to 13 m against a 10 m aim point, so their Pk
  drops to 0.07 and 0.34. Israel loses its single `on` win and Iran's average end
  turn falls from 27.1 to 26.5; the USA row is unchanged.

Parameters calibrated (all game-scale readings, each stated in code and README):

| Constant | Value | Anchor |
| --- | ---: | --- |
| Munitions per package | 30 | JASSM inventory ÷ strike-package size |
| Coalition air sorties/turn | 8 | pre-war sortie generation |
| Arrow depletion turn | 5 | end-of-March expenditure |
| THAAD drain/turn | 1 | ~50% over 30 turns |
| Industry surge threshold/warm-up | 60% / 2 turns | post-depletion mobilisation |
| High tempo / fatigue onset | 4 sorties / 4 turns | crew rest cycle |
| Carrier endurance | 20 turns | nine months of a nine-month war |
| Homeland diversion | 0.7 | sorties retained for defence |
| Iran stockpile assembly | 350 | component stock before decline |
| Tanker sortie base | 6 | tanker-supported strike rhythm |
| Reservist fatigue start | turn 12 | four months of call-ups |
| Cyber radar factor / duration | 0.7 / 2 turns | documented "temporary disruption only" |
| Cyber effectiveness decay | 0.15/op, floor 0.3 | diminishing returns, no published curve |
| Reservist fatigue rate / floor | 0.15/turn / 0.65 | reservist rotation |
| Israeli pressure gain / relief / loss | +12 / −8 / 85 × 2 turns | home-front mobilisation reporting |
| Carrier rotation will / extension penalty | 6 / 4% per turn | political constraint on deployment |
| PMF activation / harassment cadence | turn 6 or 50 casualties / every 3rd turn | PMF brief |
| Host access posture | per brief | OOB host table |
| Intervention thresholds | oil 130 + 25 casualties, Hormuz < 25 | OOB intervention table |

These additions were not tuned against outcomes: they are anchored to the
briefs, run behind flags, and covered by per-system tests. Host access and
interventions remain off in the default campaign.
