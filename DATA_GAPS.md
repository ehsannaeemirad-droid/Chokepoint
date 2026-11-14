# Data gaps and contested values

Every parameter in the game carries a confidence label. This file lists the ones
that are **not** `confirmed`, so a reader can see where the simulation is
inferring rather than reporting. Labels used:

- `confirmed` — consistent across the sources cited in the briefs.
- `single_source` — one source only, or corroborated but not independently quantified.
- `belligerent_claim` — a claim by a party to the conflict; stored, never treated as fact.
- `estimate_range` — the sources give a band, or disagree; the game uses the band.
- `data_gap` — no open-source value was found. The field is `null` and named below.

## Site layer (`src/data/orderOfBattle.json` → `sites`)

| Item | Status | What the game does |
| --- | --- | --- |
| Thumrait, Masirah air bases | `data_gap` | Named in the brief without coordinates; `lat`/`lon` are `null` and the sites are data-only until coordinates are supplied. |
| Haifa and Eilat naval bases | `data_gap` | Named without coordinates. |
| Hajabad underground launch facility | `single_source` | "~130 km north of Bandar Abbas"; no coordinates, stored `null`. |
| Oghab 44 underground air base | `single_source` | Named only; no coordinates. |
| Alim passive radar | `data_gap` | Mobile system, no fixed site. |
| Prince Sultan coordinates | `confirmed` (approximate) | Al Kharj area only, not a surveyed position. |
| Muwaffaq Salti coordinates | `confirmed` (approximate) | Azraq area only. |
| IRGC claims of destroyed radars (AN/TPY-2 in UAE and Jordan, AN/FPS-132 in Qatar) | `belligerent_claim` | Modelled as probabilistic degradation, never binary destruction. |
| Iranian air-defence radar coverage per site | `data_gap` | Range rings only; no site-by-site coverage map exists publicly. |

## Endurance layer (`src/data/logistics.json` → `endurance`)

| Item | Status | What the game does |
| --- | --- | --- |
| SM-3 / SM-6 inventory and production | `data_gap` | Inventory `null`; expenditure stored as 20–25% and replenishment 4–5 years. |
| Arrow-2/3 inventory | `data_gap` (classified) | Stored as `null`; the game uses a depletion horizon (end of March) instead of a count. |
| David's Sling inventory | `single_source` | 600 rounds, unverified. |
| THAAD inventory | `confirmed` with conflict | 534 rounds (Dec 2025 estimate); the loss valuation is disputed ($3.15B vs $3.84B), so value is not modelled. |
| Iran missile production | `estimate_range` | 50–100/month post-attrition vs 100–300 vs an outlier 3,000; 200–300/month pre-war. |
| Iran production from stockpile ceiling | `estimate_range` | "Several hundred" → 200–500; once exhausted the rate falls to steady state. |
| Iran drone capacity claim (10,000/month) | `belligerent_claim` | Stored as a ceiling claim, not a production rate. |
| Hezbollah arsenal | `estimate_range` | 15,000–20,000 central, 11,000–13,000 low; monotonic depletion from the central figure. |
| Houthi production rate | `single_source` (qualitative) | "Small positive, not blockade-dependent"; no quantified rate exists. |
| US sortie ceiling and tanker cap | `data_gap` | Tanker availability is modelled as the binding constraint; no numeric ceiling is published. |
| Egypt host access | `data_gap` | Only the Suez closure condition is documented. |
| Iranian forex reserves | `estimate_range` vs claim | 3 months of imports (independent) against the CBI claim of sufficiency; the claim is labelled `belligerent_claim`. |
| Iranian missile CEP (Kheibar Shekan, Fattah) | `estimate_range` | Claimed <100 m, unverified; stored band 100–500 m. |
| Minab school casualty claim and similar | `belligerent_claim` | Not modelled as a value; retained only as narrative where used. |

## Scenario layer (`src/data/scenarios.json` → `campaign`)

| Item | Status | What the game does |
| --- | --- | --- |
| Host threat thresholds and closure margins | `estimate_range` | Restrict thresholds reuse the existing host values; closure margin is a game abstraction. |
| Pakistan, Egypt, Hezbollah, Houthi, PMF intervention triggers | `estimate_range` | Documented conditions turned into numeric thresholds; the mapping is stated in `interventions.note`. |
| Event dates for scripted chronology | `single_source` | Dates follow the briefs' chronology; anything not dated uses a `trigger_condition` instead of an invented date. |

## How these are consumed

Munitions depletion, interceptor depletion, the radar-damage multiplier, sortie
fatigue, carrier endurance and Iranian production decline are now implemented in `src/combat/endurance.ts` and read `logistics.json`. They are
off by default (`scenarios.json` → `systems`, all `false`), so the balance
baseline is unchanged; `README.md` documents the flags. All twelve endurance blocks now have live mechanics; the remaining gaps are
within them: only the Houthis field units, so Hezbollah/Hamas/PMF resupply rows
are data only, and the turn thresholds (carrier 20, reservist fatigue 12) are
stated game-scale readings rather than published dates.

## Proxy and cyber modelling gaps

- **Hezbollah, Hamas and the PMF have no units in the order of battle**, so their
  documented inventories and zero/low resupply cannot yet affect play. Their
  endurance rows are carried for when those formations are modelled.
- **Cyber effects are mapped, not simulated in depth.** The record allows only a
  one-turn sortie delay and a temporary radar-detection reduction; both are
  implemented as short SEAD suppression and a detection multiplier. No unit
  destruction is permitted under the flag, which is a deliberate departure from
  the older abstracted cyber strike.
- **The reservist-fatigue start turn (12) and the carrier clock (20) are
  game-scale conversions** of "four months" and "nine months" onto a 30-turn
  campaign, not published event dates.
