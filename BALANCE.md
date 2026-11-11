# Balance report — multi-seed win distribution

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
