# Data sources and confidence

Generated from `src/data/references.ts` by `renderDataDoc()`. Do not edit by hand:
change the records and regenerate.

Two kinds of record live here:

- **Sourced estimates** name an organisation-level public source and the date it was published.
  Where sources disagree, the range is recorded rather than a single figure.
- **Game abstractions** are scenario decisions with no published figure behind them. They are
  labelled as such and must state how the real-world quantity was turned into a game number.

Nothing in this project asserts a precise real-world inventory, and no published CEP is treated
as a guaranteed hit probability. Hex ranges are theatre distances on a compressed map, not a
1:1 conversion from kilometres.

## Weapon systems

| Item | Value | Source | Confidence | Game mapping |
| --- | --- | --- | --- | --- |
| asm_launcher | 120–300 km | CSIS Missile Threat (2018-06-14) | reported-estimate / medium | Range 8 hexes from the coast reaches the shipping lanes. Each battery in range adds 10% Hormuz disruption; the unit is a launcher, and its rounds are tracked by the ASM arsenal class. |
| fac | 3 hex | game abstraction | game-abstraction / low | Range 3, adds 5% Hormuz disruption per surviving group. It stands for a harassing presence rather than a counted flotilla. |
| fateh110 | 300–700 km | Iran Watch (2026-01-26) | reported-estimate / high | Range 9 hexes reaches the Gulf bases. Penetration 0.5 stands for the family mix: the older variants are less accurate than the Zolfaghar, and a single CEP is deliberately not converted into a hit probability. |
| fattah | 1400 km | CSIS Missile Threat (2018-06-14) | disputed / low | Range 27 hexes, threat class hypersonic, and only the Arrow-3 layer has a non-zero hypersonic intercept. Six rounds at the campaign start keep an unverified capability scarce. |
| khorramshahr | 1700–2000 km | CSIS Missile Threat (2017-09-29) | reported-estimate / medium | Range 27 hexes covers Israel and every Gulf base. Penetration 1 reflects payload and reach, not precision: this family is modelled as easy to detect and hard to stop rather than accurate. |
| mine_layer | 2 hex | game abstraction | game-abstraction / low | A mine-layer unit with range 2 that spends one turn to add 15% Hormuz disruption. The mine count is a scenario decision, not a published figure. |
| shahed136 | 1000–2500 km | CSIS Missile Threat (2026-05-22) | reported-estimate / medium | Range 20 hexes on the compressed theatre map, not a 1:1 km conversion. One round = one airframe plus one warhead; 5 resources to produce, 4 per turn, one launcher sortie per shot. |

## Missile and drone inventories

| Item | Value | Source | Confidence | Game mapping |
| --- | --- | --- | --- | --- |
| attrition:arsenal:asm | 5 mated_rounds | game abstraction | game-abstraction / low | 5 mated asm rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| attrition:arsenal:drone | 31 mated_rounds | game abstraction | game-abstraction / low | 31 mated drone rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| attrition:arsenal:fateh | 13 mated_rounds | game abstraction | game-abstraction / low | 13 mated fateh rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| attrition:arsenal:fattah | 2 mated_rounds | game abstraction | game-abstraction / low | 2 mated fattah rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| attrition:arsenal:khorramshahr | 4 mated_rounds | game abstraction | game-abstraction / low | 4 mated khorramshahr rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| campaign:arsenal:asm | 12 rounds | game abstraction | game-abstraction / low | 12 anti-ship rounds for the asm_launcher unit; one round per shot. |
| campaign:arsenal:drone | 72 rounds | game abstraction | game-abstraction / low | 72 mated Shahed-136 rounds at the 27 Feb 2026 start. One round = one airframe plus one conventional warhead; drones are the cheapest class and the largest stock. |
| campaign:arsenal:fateh | 36 rounds | game abstraction | game-abstraction / low | 36 mated Fateh-110 class rounds. The ±25% band in inventory.ts is the disclosure of that uncertainty, not a second estimate. |
| campaign:arsenal:fattah | 6 rounds | game abstraction | game-abstraction / low | 6 mated Fattah rounds; ±40% displayed band, the widest in the arsenal. |
| campaign:arsenal:khorramshahr | 16 rounds | game abstraction | game-abstraction / low | 16 mated Khorramshahr rounds; ±33% displayed band. |
| opening:arsenal:asm | 9 mated_rounds | game abstraction | game-abstraction / low | 9 mated asm rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| opening:arsenal:drone | 62 mated_rounds | game abstraction | game-abstraction / low | 62 mated drone rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| opening:arsenal:fateh | 30 mated_rounds | game abstraction | game-abstraction / low | 30 mated fateh rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| opening:arsenal:fattah | 4 mated_rounds | game abstraction | game-abstraction / low | 4 mated fattah rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| opening:arsenal:khorramshahr | 12 mated_rounds | game abstraction | game-abstraction / low | 12 mated khorramshahr rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| renewed:arsenal:asm | 15 mated_rounds | game abstraction | game-abstraction / low | 15 mated asm rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| renewed:arsenal:drone | 88 mated_rounds | game abstraction | game-abstraction / low | 88 mated drone rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| renewed:arsenal:fateh | 42 mated_rounds | game abstraction | game-abstraction / low | 42 mated fateh rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| renewed:arsenal:fattah | 10 mated_rounds | game abstraction | game-abstraction / low | 10 mated fattah rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| renewed:arsenal:khorramshahr | 18 mated_rounds | game abstraction | game-abstraction / low | 18 mated khorramshahr rounds available at turn 1; launchers, production and expenditure follow the normal rules. |
| tutorial:arsenal:asm | 2 rounds | game abstraction | game-abstraction / low | 2 anti-ship rounds, enough for one demonstration shot. |
| tutorial:arsenal:drone | 12 rounds | game abstraction | game-abstraction / low | 12 mated drone rounds so a five-turn tutorial can be completed without resupply. |
| tutorial:arsenal:fateh | 8 rounds | game abstraction | game-abstraction / low | 8 mated Fateh-110 rounds. |
| tutorial:arsenal:fattah | 0 rounds | game abstraction | game-abstraction / low | 0 rounds by design. |
| tutorial:arsenal:khorramshahr | 0 rounds | game abstraction | game-abstraction / low | 0 rounds by design; the class exists but is not stocked. |

## Launchers

| Item | Value | Source | Confidence | Game mapping |
| --- | --- | --- | --- | --- |
| attrition:launchers:ballistic | 5 launch_platforms | game abstraction | game-abstraction / low | 5 ballistic launchers at start; the launcher budget is spent per turn. |
| attrition:launchers:drone | 7 launch_platforms | game abstraction | game-abstraction / low | 7 drone launchers at start; the launcher budget is spent per turn. |
| campaign:launchers:ballistic | 9 sorties_per_turn | game abstraction | game-abstraction / low | 9 ballistic sorties per turn for Fateh/Khorramshahr/Fattah/ASM. Reset each turn; shared with the AI. |
| campaign:launchers:drone | 12 sorties_per_turn | game abstraction | game-abstraction / low | 12 drone sorties per turn, shared by the player and the AI and reset each turn. A sortie is consumed per round fired. |
| opening:launchers:ballistic | 8 launch_platforms | game abstraction | game-abstraction / low | 8 ballistic launchers at start; the launcher budget is spent per turn. |
| opening:launchers:drone | 11 launch_platforms | game abstraction | game-abstraction / low | 11 drone launchers at start; the launcher budget is spent per turn. |
| renewed:launchers:ballistic | 10 launch_platforms | game abstraction | game-abstraction / low | 10 ballistic launchers at start; the launcher budget is spent per turn. |
| renewed:launchers:drone | 13 launch_platforms | game abstraction | game-abstraction / low | 13 drone launchers at start; the launcher budget is spent per turn. |
| tutorial:launchers:ballistic | 4 sorties_per_turn | game abstraction | game-abstraction / low | 4 ballistic sorties per turn. |
| tutorial:launchers:drone | 6 sorties_per_turn | game abstraction | game-abstraction / low | 6 drone sorties per turn so a single salvo teaches the budget without exhausting it. |

## Facilities

| Item | Value | Source | Confidence | Game mapping |
| --- | --- | --- | --- | --- |
| al_dhafra | — | US Air Forces Central | reported-estimate / medium | FacilityCategory radar, representing the AWACS/air-surveillance role; the node remains an airbase for basing rules. |
| al_udeid | — | US Air Forces Central | reported-estimate / high | FacilityCategory command. The airbase kind still controls sorties; the role is shown in the node card. |
| bandar_abbas | — | game abstraction | game-abstraction / low | FacilityCategory port-logistics on the port node; shipping effects continue to come from the port kind. |
| bandar_abbas_underground | — | CSIS Missile Threat | reported-estimate / low | FacilityCategory weapons-storage; drone regeneration 3 per turn at full integrity, a labelled abstraction rather than a production line. |
| fordow | — | IAEA | reported-estimate / high | FacilityCategory nuclear-enrichment. No production lines. buried 60 m: the hardest target in the theatre, reachable only by the B-2/MOP combination modelled here. |
| isfahan | — | IAEA | reported-estimate / medium | FacilityCategory nuclear-conversion. No production lines. Hardened, so damage requires sustained or bunker-buster strikes. |
| khojir | — | CSIS Missile Threat | reported-estimate / low | FacilityCategory missile-production, kind missile-industry, production lines missile + drone. Underground regeneration 2 drones / 2 missiles per turn at full integrity (labelled abstraction). |
| muwaffaq_salti | — | Missile Defense Agency | reported-estimate / high | FacilityCategory radar. Degrading the node reduces its contribution to regional BMD in the scenario narrative. |
| natanz | — | IAEA | reported-estimate / high | FacilityCategory nuclear-enrichment. No production lines. buried 25 m, surfaceFloor 55: only a bunker-buster reaches the hall. |
| nsa_bahrain | — | US Naval Forces Central Command | reported-estimate / high | FacilityCategory naval-facility. The naval node kind continues to govern shipping and escort rules. |
| parchin | — | CSIS Missile Threat | reported-estimate / low | FacilityCategory missile-production, kind missile-industry, production line missile. Underground regeneration 1 missile per turn at full integrity. |
| prince_sultan | — | US Air Forces Central | reported-estimate / medium | FacilityCategory command. Host consent still governs whether US missions may launch. |
| shahroud | — | CSIS Missile Threat | reported-estimate / low | FacilityCategory weapons-storage, kind missile-industry, production line missile (regeneration abstraction only). Underground regeneration 1 missile per turn. |
| tabriz_complex | — | game abstraction | game-abstraction / low | FacilityCategory defence-industry; missile + drone regeneration 1 each per turn at full integrity. Not a literal factory count. |
| tehran | — | game abstraction | game-abstraction / low | FacilityCategory command on the urban node. It does not add hit points or production. |

## Nuclear material

| Item | Value | Source | Confidence | Game mapping |
| --- | --- | --- | --- | --- |
| attrition:nuclear-material | 0 warhead_equivalents | game abstraction | game-abstraction / low | nuclearMaterial 0; intact enrichment sites and the escalation ladder carry the latency instead. |
| campaign:nuclear-material | 0 warhead_equivalents | game abstraction | game-abstraction / low | 0 warhead equivalents at start. The field exists to keep nuclear material disjoint from conventional rounds; no code path produces it in this build. |
| opening:nuclear-material | 0 warhead_equivalents | game abstraction | game-abstraction / low | nuclearMaterial 0; intact enrichment sites and the escalation ladder carry the latency instead. |
| renewed:nuclear-material | 0 warhead_equivalents | game abstraction | game-abstraction / low | nuclearMaterial 0; intact enrichment sites and the escalation ladder carry the latency instead. |
| tutorial:nuclear-material | 0 warhead_equivalents | game abstraction | game-abstraction / low | 0 warhead equivalents; never populated. |

## Scenario starting values

| Item | Value | Source | Confidence | Game mapping |
| --- | --- | --- | --- | --- |
| attrition:hosts | 8 host_nations | game abstraction | game-abstraction / low | Host threat seeds are listed in lateScenarios.ts; access closes through the normal politics rules. |
| attrition:initial-hormuz | 73 percent_disruption | game abstraction | game-abstraction / low | Initial Hormuz disruption 73. Values above 60 trigger logistics delays. |
| attrition:resources | 58 war_resources | game abstraction | game-abstraction / low | 58 starting resources with the standard per-turn income. |
| campaign:hosts | 8 host_nations | game abstraction | game-abstraction / low | Eight host states seeded at threat 15-45 in scenarios.json; threat rises with strikes and closes base access through the politics rules. |
| campaign:initial-hormuz | 30 percent_disruption | IEA | reported-estimate / medium | Initial disruption 30 on a 0-100 scale, representing peacetime friction plus pre-war risk, not a measurable closure. |
| campaign:resources | 160 war_resources | game abstraction | game-abstraction / low | 160 starting resources, +10 per turn income. One turn = 24 h for the opening campaign (BALANCE.iranResourceIncome). |
| opening:hosts | 8 host_nations | game abstraction | game-abstraction / low | Host threat seeds are listed in lateScenarios.ts; access closes through the normal politics rules. |
| opening:initial-hormuz | 41 percent_disruption | game abstraction | game-abstraction / low | Initial Hormuz disruption 41. Values above 60 trigger logistics delays. |
| opening:resources | 140 war_resources | game abstraction | game-abstraction / low | 140 starting resources with the standard per-turn income. |
| renewed:hosts | 8 host_nations | game abstraction | game-abstraction / low | Host threat seeds are listed in lateScenarios.ts; access closes through the normal politics rules. |
| renewed:initial-hormuz | 56 percent_disruption | game abstraction | game-abstraction / low | Initial Hormuz disruption 56. Values above 60 trigger logistics delays. |
| renewed:resources | 205 war_resources | game abstraction | game-abstraction / low | 205 starting resources with the standard per-turn income. |
| tutorial:hosts | 8 host_nations | game abstraction | game-abstraction / low | Eight host states seeded at threat 14-44 for the tutorial. |
| tutorial:initial-hormuz | 25 percent_disruption | game abstraction | game-abstraction / low | 25 initial disruption: below the interdict threshold (60) by design. |
| tutorial:resources | 40 war_resources | game abstraction | game-abstraction / low | 40 starting resources so production cannot dominate a five-turn lesson. |

## Political and economic context

| Item | Value | Source | Confidence | Game mapping |
| --- | --- | --- | --- | --- |
| congressional-support | 60 index | game abstraction | game-abstraction / low | Congress 60 at start, falling with casualties and escalation, recovering on quiet turns. Restrictions at 35, suspension at 20. |
| oil-price | 60 index | game abstraction | game-abstraction / low | Index 60 at start; rises with Hormuz disruption and sustained closure, clamped 40-220. The 130 threshold for the oil-shock path is a scenario constant. |

---

Every record is last reviewed on the date in `lastReviewed` and is validated by
`src/data/provenance.test.ts`, which fails if a required value loses its provenance.
