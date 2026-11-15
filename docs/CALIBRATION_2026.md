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

Combat consumes them in `src/combat/pk.ts`: interceptor rows provide the general
engagement probability (hypersonic engagements keep their dedicated value), and
strike rows scale damage by `0.6 + 0.4 × base_pk` for the units they are mapped
to. Coalition airframes are now mapped to sourced records:

| Aircraft | Munition | Range | Warhead | CEP | Pk |
| --- | --- | --- | --- | --- | ---: |
| F-35A, F-15E, F-35I | JDAM GBU-31 | 24 km | 925–961 kg | 5 m | 1.00 |
| F-15I | SPICE 2000 | 60 km | 429 kg | 3 m | 1.00 |
| B-52H | JASSM-ER | 370–1,000 km | 450 kg | 3 m | 1.00 |
| MQ-9 | AGM-114 Hellfire | 7–11 km | 8–11 kg | 0.9–1.0 m | 1.00 |
| B-2 | GBU-57 MOP | — | 13,000 kg | 3–5 m | 1.00 |

Sources are recorded on each row: US Air Force/Navy fact sheets for JDAM and
Hellfire, the DoD JASSM selected-acquisition report, and Rafael's SPICE brochure.
A 0.85 `COALITION_AIR_MODEL_PK` remains as a fallback for any future airframe
without a record.

### GPS denial

With `systems.gpsDenial` (part of the Endurance preset, off in the scenario
defaults), GPS-guided weapons are scored against a **10 m point target** rather
than the 100 m area used for the normal Pk:

`Pk_denied = 1 − 0.5^((10 / INS CEP)²)`

- JDAM uses its published INS-only CEP of 30 m (98 ft): Pk 0.074, strike factor
  0.63 (down from 1.00).
- JASSM uses its published GPS/INS-only CEP of 13 m: Pk 0.336, strike factor 0.73.
- SPICE 2000 is electro-optical and GPS-denied capable, and Hellfire is laser
  guided, so neither is affected. The B-2's MOP is unchanged.

The 10 m radius is a game-scale aim point (a hall, shelter or command post); it
is the smallest radius at which the published GPS and INS CEPs are meaningfully
distinguishable. The eight-seed campaign table in `BALANCE.md` shifts only in the
`on` rows: Israel's single win becomes a loss and Iran's average end turn falls
from 27.1 to 26.5.

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
