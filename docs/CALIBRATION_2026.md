# 2026-war calibration record (tasks 3.1 and 3.4)

Every value below is either stated in a brief or marked as a game-scale reading.
Nothing is inferred from a vendor brochure, and no hit probability was invented.

## Pk policy (task 3.1)

Every `weaponPerformance` row now has numeric `base_pk` and `interception_pk`
values. They are **model outputs, not published hit probabilities**, and each row
says so in `pk_basis`:

- **`base_pk` for guided weapons** is derived from the stored CEP band with a
  100 m target radius: `1 − 0.5^(100/CEP)²`. A weapon with a 100 m CEP therefore
  scores 0.5, while a 1 km CEP scores about 0.007. Emad's reported reliability
  issues apply a further ×0.8.
- **Weapons without a published CEP** (drones, unguided rockets, ATGMs) use a
  stated class model: 0.15 for area-effect drones, 0.10 for unguided rockets,
  0.60 for line-of-sight ATGMs.
- **`interception_pk` for interceptor rows** is the same probability stored on
the corresponding defence unit (`units.json → intercept`): THAAD 0.80, Patriot
  0.65, Arrow 0.80, David's Sling 0.75, Iron Dome 0.85. Non-interceptor rows
  carry 0 because they cannot intercept.

This replaces the earlier "leave both null" decision at the user's request. The
numbers remain fully auditable: none is presented as a sourced fact, and the
formula is reproducible from the data in the repository.

## Old → new → source (task 3.4)

| Field | Old | New | Source | Confidence | Game field |
| --- | --- | --- | --- | --- | --- |
| Iranian missile inventory | one stock | 8 named systems + 300–2500/month production bands | Iran brief, tables 2–3 | `estimate_range` | `orderOfBattle.iranStock`, `weaponPerformance.production_per_month` |
| Shahed-136 cost | none | USD 20k–50k | Iran brief | `estimate_range` | `weaponPerformance.unit_cost_usd` |
| Shahed-136 production | none | 400–500/month | Iran brief | `single_source` | `production_per_month` |
| THAAD interceptors | abstract | 534 inventory, 96–400/year | US brief | `estimate_range` | `starting_inventory`, `production_per_year` |
| Patriot PAC-3 MSE | abstract | 2,200 inventory, 600–2,000/year | US brief | `estimate_range` | same |
| Arrow 2/3 | abstract | cost USD 1.5–3m; inventory classified | Israel brief | `estimate_range` / `data_gap` | `unit_cost_usd` |
| David's Sling | abstract | 600 inventory; USD 1–2m | Israel brief | `estimate_range` | `starting_inventory`, `unit_cost_usd` |
| Iron Dome Tamir | abstract | 1,500 inventory; 1,000/year; USD 50k | Israel brief | `single_source` | same |
| Carrier deployment clock | none | 20 turns, rotation at political will ≥ 6, else +4%/turn | derived from "nine months" | game-scale reading | `CARRIER_ENDURANCE_TURNS`, `CARRIER_ROTATION_WILL` |
| Israeli reservist fatigue | none | starts turn 12, −15%/turn, floor 0.65 | derived from "four months" | game-scale reading | `RESERVIST_FATIGUE_TURN`, `RESERVIST_FATIGUE_RATE` |
| Israeli home-front pressure | none | +12/turn under fire, −8 calm, loss at 85 for 2 turns | derived from mobilisation reporting | game-scale reading | `israelMobilizationPressure` |
| Cyber effectiveness | flat 50% | 0.5 × effectiveness, −0.15/op, floor 0.3 | no public data | game-scale reading | `cyberEffectiveness`, `decayCyber` |
| PMF activation | none | turn 6 or 50 casualties, −1 will every 3rd turn | PMF brief | game-scale reading | `PMF_ACTIVATION_TURN` |
| Host access posture | all open | per-host `access_status_start`, applied at start | OOB brief | `single_source` | `hosts[].status` |
| Pakistan intervention | none | oil ≥ 130 and 25 casualties | OOB brief | `single_source` | `pakistanTriggered` |
| Egypt/Suez | none | Hormuz < 25 | OOB brief | `single_source` | `suezClosed` |
| Proxy activation turns | none | Hezbollah turn 10, Houthi turn 12, PMF turn 6 | brief conditions, no dates | game-scale reading | `firedInterventions` |
| Named sites | 47 nodes | 96 nodes; all 64 sites linked | OOB brief coordinates | `single_source` | `mapNodes`, `sites.node_id` |
| SAM/radar detection | abstract | 105–1,100 km per site, linked cueing radar | Iran brief | `single_source` | `detection_radius_km`, `linked_system` |
| Personnel | 5 sites | 5 sites with ranges (Al Udeid 9–11k, Al Dhafra 3.5–5k, Bahrain 8–9k, PSAB 2.3k, Arifjan 13.5k) | OOB brief | `single_source` | `sites.personnel_range` |
| Israeli squadrons | none | 6 bases, named squadrons and airframes | Israel brief | `single_source` | `sites.squadrons` |

## How the new values were calibrated

- **No numeric retune of existing combat statistics.** The brief-derived values
  feed the endurance layer; unit attack/defence numbers are unchanged, so the
  baseline (flags off) still reproduces 8/8 offline.
- **Endurance preset** turns every brief-derived system on together. Each system
  also runs alone under test, so a balance regression can be attributed.
- **Detection radii** scale as `km / 100` hexes and add +0.18 detection chance
  per intact, in-range site, capped by the existing detection ceiling. This
  rewards destroying radars and batteries without making raids impossible.
- **New nodes** use the brief's coordinates and the same 100 integrity as older
  sites; underground facilities get 140. No fabricated Persian names were added,
  so the UI falls back to the English label (tracked in `DATA_GAPS.md`).

## Reproduce

```
pnpm run typecheck
pnpm test
pnpm run build
```

The calibration assertions live in `src/combat/endurance.test.ts` and
`src/data/provenance.test.ts`.
