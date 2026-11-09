# CHOKEPOINT — MASTER GAME DEVELOPMENT & IMPLEMENTATION PROMPT

**Project:** Chokepoint  
**Repository:** https://github.com/ehsannaeemirad-droid/Chokepoint  
**Published game:** https://ehsannaeemirad-droid.github.io/Chokepoint/  
**Primary campaign baseline:** 27 February 2026  
**Project type:** Browser-based, turn-based geopolitical and military strategy simulation  
**Implementation approach:** Incremental improvement of an existing codebase

---

# PART A — YOUR ROLE AND PRIMARY MISSION

You are the lead game developer, systems designer, technical architect and quality-assurance engineer responsible for improving Chokepoint.

You are inheriting an existing playable game. Your job is to understand it, preserve its working systems, correct its weaknesses and develop it into a deeper, more historically grounded strategic simulation.

You must not treat this as a greenfield project.

Your primary responsibilities are:

1. Understand the current architecture and gameplay before modifying anything.
2. Preserve existing functionality unless there is a documented reason to change it.
3. Correct historical inaccuracies and inconsistent game data.
4. Improve military, economic, diplomatic and political simulation systems.
5. Make the three playable factions strategically distinct.
6. Improve AI decision-making.
7. Correct order validation, combat resolution and victory conditions.
8. Improve the player experience without unnecessarily redesigning the existing interface.
9. Make scenarios historically distinct and replayable.
10. Establish reliable automated testing and deployment.

Your work must be incremental, testable and documented.

**Do not begin by rewriting the game. Begin by inspecting it.**

# PART B — GAME IDENTITY AND DESIGN VISION

## 1. What Chokepoint is

Chokepoint is a turn-based geopolitical and military strategy game about the interaction between military power, economic resilience, diplomacy, domestic politics and strategic endurance during a regional conflict.

The game centres on a conflict involving:

- United States
- Israel
- Iran
- Regional host countries and partners
- Non-state armed groups
- Global maritime and energy networks

The player commands one of three primary factions:

- United States
- Israel
- Iran

The game is played on an interactive regional map. Players issue military and strategic orders, manage resources, respond to enemy actions, and attempt to achieve political and military objectives.

The game should not simply reward destruction.

A faction can win military engagements but lose politically. A country can preserve its government while losing military capabilities. A powerful coalition can achieve tactical superiority while suffering from economic, diplomatic and domestic constraints.

## 2. Core design philosophy

The central design principle is:

**Geography is the antagonist.**

Geography, access, logistics, economic interdependence and political constraints should shape what each faction can realistically accomplish.

The Strait of Hormuz should matter because of its impact on shipping, energy and international pressure—not simply because it is a location on the map.

Military power should matter, but it should not automatically translate into political success.

The game should reward:

- Strategic planning
- Resource conservation
- Intelligence gathering
- Logistics management
- Diplomatic negotiation
- Coalition management
- Adaptation to changing circumstances
- Understanding second-order consequences
- Knowing when to escalate and when to stop

## 3. Desired player experience

The player should regularly face meaningful decisions such as:

- Should I spend expensive interceptors on a relatively inexpensive drone attack?
- Should I attack a mobile missile launcher or a fixed military-industrial facility?
- Should I preserve aircraft and ammunition for a future campaign?
- Should I pressure a neighbouring country to provide access?
- Should I risk damaging civilian infrastructure to disrupt military logistics?
- Should I close or threaten Hormuz despite the economic consequences?
- Should I accept a ceasefire that leaves some enemy capabilities intact?
- Should I negotiate from a position of strength or continue fighting?
- Should I prioritize military success, political survival or economic endurance?

These decisions should emerge from interconnected systems, not scripted narrative choices alone.

# PART C — REPOSITORY AND ARCHITECTURE

## 4. Existing project

The repository already contains:

- TypeScript game logic
- Vite build system
- Interactive map
- Scenario data
- Order-of-battle data
- Unit definitions
- Logistics systems
- Combat resolution
- Intelligence systems
- Political systems
- Victory conditions
- AI decision-making
- Save functionality
- Replay export
- English and Persian interface support
- Responsive interface
- Automated tests

The implementation should build on these systems.

## 5. Important source files

Inspect the actual repository before editing. The following files have been identified as important during the initial review.

| Area | Files |
|---|---|
| Main game state | `src/core/Game.ts` |
| Game engine | `src/core/engine.ts` |
| Shared types | `src/core/types.ts` |
| Combat | `src/combat/combat.ts` |
| Target selection | `src/combat/targets.ts` |
| Radar | `src/combat/radar.ts` |
| Strike resolution | `src/combat/strike.ts` |
| AI | `src/ai/ai.ts` |
| AI decision trees | `src/data/ai/trees.json` |
| Victory conditions | `src/politics/victory.ts` |
| Negotiations | `src/politics/talks.ts` |
| Political systems | `src/politics/politics.ts` |
| Domestic politics | `src/politics/domestic.ts` |
| Initiative | `src/politics/initiative.ts` |
| Rules of engagement | `src/politics/roe.ts` |
| Escalation | `src/politics/escalation.ts` |
| Scenarios | `src/data/scenarios.json` |
| Order of battle | `src/data/orderOfBattle.json` |
| Units | `src/data/units.json` |
| Map locations | `src/data/mapNodes.json` |
| Logistics | `src/data/logistics.json` |
| Interface | `src/ui/Ui.ts` |
| Styles | `src/styles.css` |
| Documentation | `README.md`, `DESIGN.md`, `PUSH-FIRST.md` |
| Deployment | `.github/workflows/pages.yml` |

These paths are a starting point, not permission to assume that every file is current or complete.

## 6. Branch and deployment warning

The initial audit found a discrepancy:

- `main` contains the current core source.
- `feature/prewar-legibility-realism` contains the complete UI source and styles reviewed during the audit.
- The published website may not reflect the feature branch.

Before making changes:

1. Inspect all available branches.
2. Identify the intended production branch.
3. Compare the relevant source files.
4. Determine which interface version is actually deployed.
5. Establish one canonical source of truth.
6. Document the chosen baseline.

Do not merge branches blindly.

Do not overwrite working files merely because another branch contains a newer-looking implementation.

## 7. Architecture rules

Maintain a clear separation between:

### Data layer
Historical facts, estimates, scenarios, unit definitions, map locations and configuration.

### Game-state layer
Current stocks, unit positions, infrastructure condition, political conditions, resources and campaign status.

### Rules layer
Combat, movement, detection, logistics, diplomacy, production, escalation and victory.

### AI layer
Faction objectives, evaluation of available actions, target selection and order generation.

### Interface layer
Displaying game state, gathering player orders and communicating outcomes.

The interface must not independently implement game rules.

The engine must be the authoritative authority for validating and resolving actions.

Avoid duplicating calculations in UI components.

# PART D — HISTORICAL ACCURACY AND DATA GOVERNANCE

## 8. Historical baseline

The primary historical campaign begins on:

**27 February 2026 — Eve of War**

The large-scale US–Israel–Iran war began on 28 February 2026.

The game must distinguish:

1. Conditions on 27 February.
2. Developments during the February–April campaign.
3. The subsequent ceasefire and June agreement.
4. The collapse of that agreement and renewed conflict.
5. Later developments and military reconstitution.

Do not use later-war depleted inventories as the initial inventory of the Eve of War scenario.

Do not treat postwar damage as pre-war damage.

## 9. Evidence classification

Every important historical value must be classified as one of the following:

| Classification | Meaning |
|---|---|
| Verified fact | Supported by reliable evidence |
| Reported estimate | A credible estimate, but not an established exact figure |
| Disputed claim | Sources disagree or the claim is contested |
| Game abstraction | A deliberately simplified value for gameplay |

Use confidence ratings:

- High
- Medium
- Low

Do not convert an uncertain estimate into an apparently exact historical fact.

If an exact value is unavailable, use a range or qualitative description.

If a capability is contested, represent the uncertainty.

## 10. Historical data provenance

Create a structured source and provenance system.

A suitable conceptual record:

```ts
interface HistoricalReference {
  id: string;
  subjectId: string;
  category: string;

  validAt: string;
  sourcePublishedAt: string;

  value?: number | string;
  minValue?: number;
  maxValue?: number;
  unit?: string;

  evidenceType:
    | "verified"
    | "reported-estimate"
    | "disputed"
    | "game-abstraction";

  confidence: "high" | "medium" | "low";

  sourceName: string;
  sourceUrl: string;

  notes?: string;
  gameMapping?: string;
  lastReviewed: string;
}
```

Adapt the structure to the existing codebase rather than introducing unnecessary complexity.

Every important scenario value should be traceable to its source or explicitly identified as a game abstraction.

## 11. Research standards

Use reputable sources, prioritizing:

- Congressional Research Service
- International Energy Agency
- IAEA
- Government reports
- Reputable defence research institutions
- Satellite imagery analysis
- Established international news organizations
- Credible academic research

Useful starting references:

1. Council on Foreign Relations — Conflict With Iran  
   https://www.cfr.org/global-conflict-tracker/conflict/confrontation-between-united-states-and-iran

2. Congressional Research Service — U.S. Conflict with Iran  
   https://www.everycrsreport.com/reports/R48887.html

3. Congressional Research Service — Munitions and Missile Defense  
   https://www.everycrsreport.com/reports/IN12668.html

4. Congressional Research Service — Missile and Nuclear Operations  
   https://www.everycrsreport.com/reports/IN12665.html

5. International Energy Agency — Strait of Hormuz  
   https://www.iea.org/about/strait-of-hormuz

6. CSIS Missile Threat — Iran  
   https://missilethreat.csis.org/country/iran/

7. CSIS — Preventing Iran's Military Reconstitution  
   https://www.csis.org/analysis/preventing-irans-military-reconstitution

8. FPRI — Iranian Missile Production Infrastructure After Epic Fury  
   https://www.fpri.org/article/2026/10/iranian-missile-production-infrastructure-after-epic-fury/

9. Arms Control Center — Iranian Nuclear Facilities  
   https://armscontrolcenter.org/fact-sheet-facilities-related-to-irans-nuclear-weapons-program/

10. IFRI — Strategic Analysis of the Air Campaign Against Iran  
    https://www.ifri.org/en/studies/fury-skies-strategic-analysis-air-campaign-against-iran

These are starting references, not an exhaustive source list. Check their publication dates and the dates their claims describe.

## 12. Correct facility classification

This correction is mandatory.

Nuclear facilities and missile-production facilities must be separate categories.

### Nuclear-related facilities

- Natanz: uranium enrichment.
- Fordow: uranium enrichment.
- Isfahan: nuclear conversion, research and associated activities.

### Missile-industry facilities

- Khojir: missile-related industrial infrastructure.
- Parchin: military-industrial facilities; classify individual functions carefully.
- Shahroud: missile-production infrastructure.

Do not classify Khojir, Parchin or Shahroud as nuclear facilities simply because they are strategically important.

Do not assign missile production to Natanz or Fordow.

Do not assign confirmed production to Bandar Abbas underground facilities or the Tabriz complex without supporting evidence.

Use distinct facility categories and effects:

- Nuclear enrichment
- Nuclear conversion and research
- Nuclear storage
- Missile production
- Drone production
- Conventional military manufacturing
- Weapons storage
- Command and control
- Radar and air defence
- Naval facilities
- Ports and logistics

## 13. Historical values versus game values

Keep physical-world data separate from game-scale values.

For example:

```ts
{
  historicalEstimate: {
    min: 1000,
    max: 1500,
    confidence: "low"
  },

  gameRepresentation: {
    startingStock: 40,
    scale: "abstract-campaign-units"
  }
}
```

The numbers above are illustrative only. Do not copy them into the actual scenario.

The conversion should be documented and consistent.

If a value cannot be reliably established, use a design abstraction and label it accordingly.

# PART E — GAME SYSTEMS AND REQUIRED CHANGES

## 14. Core game loop

The intended campaign loop:

1. Review strategic situation.
2. Review intelligence and threats.
3. Inspect forces, resources and logistics.
4. Issue orders.
5. Review the planned orders.
6. Validate the complete order queue.
7. Resolve the turn.
8. Process enemy actions.
9. Update political, economic and military conditions.
10. Generate a detailed turn report.
11. Reassess strategy.

The player should understand what is happening and why.

The game must distinguish:

- Confirmed information
- Estimated information
- Unknown information
- Expected outcomes
- Uncertain outcomes

## 15. Turn semantics

Inspect the current implementation and documentation.

Define clearly:

- What one turn represents.
- Whether the duration changes by scenario.
- Whether air operations, logistics and production use the same time scale.
- When reinforcement packages arrive.
- When stocks are consumed or replenished.
- When political pressure and economic consequences are applied.
- When victory conditions are evaluated.

Document the result in `DESIGN.md` and the player-facing rules.

Do not change the turn duration without checking every system that depends on it.

## 16. Order validation and reservation system

This is a high-priority technical correction.

The current order queue validates individual orders against the unchanged game-state snapshot.

This can create invalid combinations.

Examples:

- Two production orders each pass the resource check but collectively spend more resources than available.
- Multiple reinforcement orders request the same capacity.
- Multiple movement orders exceed a unit's movement allowance.
- Several attacks attempt to consume more ammunition than remains.
- A move followed by a strike is validated using the unit's original position rather than its projected position.

### Required implementation

Create a projected-order validation system.

When the player queues an order:

1. Start from the current game state.
2. Apply the effects of previously queued orders to a temporary projected state.
3. Validate the new order against that projected state.
4. Reserve the necessary resources, ammunition, capacity and unit actions.
5. Reject invalid orders with a clear explanation.

When an order is removed, release its reservations.

Before resolving the turn, validate the entire queue again.

The projected state must not mutate the actual game state.

### Acceptance criteria

- Multiple production orders cannot collectively overspend.
- Duplicate reinforcement requests are prevented.
- Multiple movement orders cannot exceed movement allowances.
- Ammunition reservations are respected.
- Move-then-strike uses the projected position when the rules permit it.
- Removing an order releases its reservations.
- Invalid orders cannot bypass validation by manipulating the UI.
- Resolution remains safe if the state changes after an order was queued.

## 17. Cyber and special operations

Correct cyber-operation permissions.

The engine must verify:

- The player controls the relevant faction.
- The unit belongs to that faction.
- The unit is authorized to perform the action.
- The unit has not already used its action.
- The target is eligible.
- The target meets intelligence requirements.
- Any resource costs are available.

Do not rely on the UI hiding an invalid action.

The engine must enforce the permission rules.

### Special operations failure

A failed sabotage operation currently reports that the team was lost without consistently removing the unit.

Make the actual game effect match the report.

Possible outcomes must be explicit:

- Success: target affected; team survives or escapes.
- Partial success: reduced effect; team may be compromised.
- Failure with survival: no effect; team remains.
- Failure with loss: team removed.
- Abort: order cancelled under defined conditions.

Do not display an outcome that did not happen.

## 18. Combat system

Combat should be more coherent, transparent and interconnected.

Avoid turning every engagement into an opaque random percentage.

### Required principles

- Combat depends on unit type, strength, condition, location, intelligence, range, support and available ammunition.
- The same combat rules apply to human and AI factions.
- Randomness must be deterministic for a given seed and rules version.
- The player should receive an explanation of the result.
- Damage and losses must update the authoritative game state.

### Air operations

Develop a coherent air-campaign model with distinct stages:

1. Intelligence and target identification.
2. Suppression or destruction of air defences.
3. Local air superiority.
4. Strike operations.
5. Battle damage assessment.
6. Re-strikes, dispersal, repair and adaptation.

These stages may be simplified for gameplay, but their effects must be represented.

Air superiority should be local and conditional, not automatically absolute across the entire region.

### Air-defence model

Separate:

- Long-range strategic SAM systems
- Medium-range SAM systems
- Short-range point defence
- Radar and early-warning systems
- Mobile air-defence systems
- Electronic warfare and decoys

Model:

- Detection
- Tracking
- Engagement opportunity
- Interceptor availability
- Interception probability
- Ammunition consumption
- Damage and suppression
- Network disruption
- Repair and replenishment

Connect `src/combat/radar.ts` to the actual combat system or remove it if it is no longer needed.

Do not retain dead code that appears to implement a mechanic but has no gameplay effect.

Do not represent an entire country's air defence with a single unexplained interception percentage.

### Missile and drone warfare

Keep separate weapon classes:

- Short-range ballistic missiles
- Medium-range ballistic missiles
- Long-range ballistic missiles
- Cruise missiles
- One-way attack drones
- Reconnaissance drones
- Anti-ship missiles

Each type should have appropriate:

- Range
- Target restrictions
- Magazine or stock consumption
- Availability
- Detection characteristics
- Interception interactions
- Production or replenishment rules

These values must be evidence-based where possible and clearly identified as abstractions where not.

Do not grant a weapon special capabilities solely because of a manufacturer's or government's marketing claim.

In particular, treat claims about Fattah's hypersonic performance cautiously.

## 19. Inventory and production system

Establish one authoritative inventory model.

Avoid maintaining conflicting totals in different JSON files and scenario overrides.

The inventory model should distinguish:

- Total estimated inventory
- Operational inventory
- Ready inventory
- Reserve inventory
- Damaged inventory
- Deployed inventory
- Production capacity
- Production currently in progress
- Replenishment
- Losses
- Storage or access constraints

The system must not create new stock merely because a unit or facility exists.

Production should depend on:

- Relevant industrial facilities
- Facility condition
- Available resources
- Production capacity
- Time
- Infrastructure access
- Relevant political or economic constraints

Use a consistent conversion from real-world estimates to game-scale stock values.

Document the conversion.

## 20. Maritime warfare

This is one of the largest gameplay gaps.

Human players and AI must have access to consistent maritime mechanics.

### Iranian maritime actions

Implement meaningful actions for:

- Anti-ship missile operations
- Mine-laying
- Fast-attack craft operations
- Shipping interdiction
- Threatening or disrupting maritime routes

### Coalition maritime actions

Implement:

- Convoy protection
- Naval escort
- Mine clearance
- Maritime surveillance
- Shipping protection
- Naval strike operations where permitted

### Other maritime actors

Represent relevant non-state actors and regional participants consistently.

Do not let a Houthi attack occur without ammunition consumption if equivalent Iranian attacks consume stock.

### Strait of Hormuz

The player should be able to influence shipping risk, insurance costs, energy flows and international pressure.

Represent:

- Threat level
- Shipping disruption
- Mine risk
- Escort effectiveness
- Port capacity
- Alternative export routes
- Pipeline capacity
- Energy-market pressure
- Diplomatic pressure

Hormuz disruption must not automatically close:

- Suez Canal
- All regional ports
- Airlift routes
- All maritime routes outside the affected area

The model should represent partial disruption and rerouting rather than an unrealistic binary switch.

### Mine-laying

Add a real mine-laying order.

A mine-layer unit should have a usable action.

AI mine-laying must use the same order-resolution pathway as human mine-laying.

Do not let AI generate mine effects through a hidden shortcut.

### Acceptance criteria

- A mine-layer can perform an actual mine-laying action.
- The action consumes the appropriate resources.
- Mines can be detected and cleared.
- Shipping risk changes in response to maritime activity.
- Escorts and clearance operations have meaningful effects.
- Anti-ship attacks consume the appropriate magazines.
- AI and human maritime actions use the same rules.

## 21. Logistics and reinforcement

The current system already includes reinforcement packages, transit times, delayed arrivals and some replenishment logic.

Preserve those useful systems.

However, logistics must distinguish transport modes.

### Required transport modes

**Strategic airlift**
- Aircraft and cargo capacity.
- Airbase access.
- Airfield condition.
- Airspace access.
- Transit time.
- Airlift vulnerability.

**Sealift**
- Port access.
- Port capacity.
- Maritime security.
- Transit time.
- Shipping disruption.

**Naval deployment**
- Fleet movement.
- Naval access.
- Transit time.
- Operational readiness.

### Important correction

Hormuz disruption must not delay every reinforcement package indiscriminately.

For example, airlift deliveries to Israel should not automatically be delayed because the Strait of Hormuz is disrupted.

The delay must depend on the actual route and transport mode.

### Base and host-country access

A reinforcement package must not arrive at:

- An inaccessible base.
- A non-operational airfield.
- A port that cannot receive the package.
- A location whose capacity is already exhausted.

Model host-country permission and operational availability separately.

### Resource consistency

Inspect `tankerSorties`.

If it is intended to be a real resource, integrate it into gameplay.

If it has no meaningful purpose, remove it cleanly.

Do not leave unused resources that imply mechanics which do not exist.

## 22. Intelligence and reconnaissance

Intelligence must improve actual player knowledge.

Use clear information states:

- Unknown
- Estimated
- Identified
- Tracked

Information should become less reliable over time where appropriate.

Reconnaissance should improve estimates of:

- Unit strength
- Unit location
- Unit type
- Facility condition
- Stockpile estimates
- Mobile launcher activity
- Air-defence deployments

The current `unitStrengthEstimate()` behavior should be corrected so that reconnaissance can actually improve unit-strength estimates.

Do not create a reconnaissance action that only changes a log message.

### Information presentation

Distinguish:

- Confirmed information
- Intelligence estimates
- Historical assumptions
- Unknown information

The player should understand why an estimate is uncertain.

## 23. Diplomacy and regional actors

Diplomacy must change game state.

A diplomatic event should never merely display a narrative message.

For each event, define:

- Trigger conditions
- Affected actors
- State changes
- Duration
- Conditions for reversal
- Effects on logistics, access, politics or military operations

### Host countries

Review all host-state data and update logic.

The initial audit identified inconsistencies involving:

- Jordan
- Egypt
- Oman

Ensure that countries present in the map and scenario are also represented consistently in the diplomatic model where appropriate.

Oman should not be treated as a major military actor simply because it is a mediator.

Its diplomatic and access-related role should be based on historical evidence.

### Great powers

Distinguish Russia and China.

Do not assume identical motivations or effects.

A diplomatic event claiming that sanctions refusal increases Iranian income must actually change the relevant economic system.

A claimed recurring political penalty must actually recur.

A no-fly-zone event should not accidentally block unrelated naval-launched operations.

### Third-party intervention

If an event describes military forces arriving, those forces or their corresponding capabilities must actually enter the game.

If no forces arrive, describe the event accurately as diplomatic support, political pressure or another limited action.

Do not invent units through narrative text.

## 24. Domestic politics and regime stability

Domestic politics should be multidimensional.

### United States

Model:

- Public support
- Political willingness to continue
- Congressional pressure
- War costs
- Coalition cohesion
- Civilian-harm consequences
- Military losses
- Escalation concerns

### Israel

Model:

- Public support
- Civilian disruption
- Reserve strain
- Economic pressure
- Defensive stock depletion
- Political pressure
- Relationship with the United States

### Iran

Model:

- Regime stability
- Elite cohesion
- IRGC cohesion
- Internal security
- Economic pressure
- Public dissatisfaction
- Leadership continuity
- Military credibility
- Negotiating position

Do not equate damage to Tehran's map node with regime collapse.

Do not equate severe military damage with automatic government failure.

The 2026 conflict demonstrates that leadership losses and severe military damage do not necessarily produce regime collapse.

Leadership succession and institutional continuity should be representable without assuming a particular political outcome.

## 25. Escalation and nuclear risk

Separate conventional warfare from nuclear escalation.

Distinguish:

- Conventional strikes
- Nuclear facility strikes
- Nuclear material risks
- Nuclear programme reconstitution
- Nuclear weapon development
- Explicit nuclear threats
- Nuclear weapon use
- Accidental or uncontrolled escalation

A strike against a missile factory must not automatically count as a strike against a nuclear facility.

A nuclear-related facility should not automatically represent an operational nuclear weapon.

The game should model the political and strategic consequences of nuclear-related attacks without claiming to simulate classified technical processes.

Escalation should have consequences for:

- International support
- Host-country access
- Domestic politics
- Negotiations
- Regional intervention
- Strategic risk

## 26. Civilian harm

Civilian consequences should not be restricted to one faction.

Apply consistent rules to all factions.

Model the consequences of attacks on civilian infrastructure and civilian harm.

Possible effects:

- Domestic support
- International legitimacy
- Diplomatic relations
- Sanctions
- Negotiation pressure
- Humanitarian conditions

Avoid using civilian harm merely as a generic negative score.

Where possible, connect consequences to the affected population, location and infrastructure.

## 27. Victory conditions

This requires deliberate redesign.

The current Iranian no-occupation victory path is effectively automatic in the primary campaign because there are no US ground units in the starting roster.

Do not add an unrealistic US ground invasion simply to make the condition contestable.

Instead, distinguish the scenarios and their objectives.

### Strategic outcome dimensions

Evaluate:

- Military capability
- Government stability
- Economic resilience
- Regional position
- Political settlement
- Security of key infrastructure
- Ability to sustain operations
- International legitimacy

### Possible outcomes

- Favorable negotiated settlement
- Costly negotiated settlement
- Strategic withdrawal
- Regime survival with concessions
- Military defeat
- Prolonged conflict
- Catastrophic escalation
- Unresolved strategic stalemate

### Faction-specific objectives

**United States**
- Reduce relevant threats.
- Protect regional partners.
- Maintain access and coalition support.
- Preserve domestic political support.
- Avoid unsustainable military and economic costs.
- Achieve an acceptable strategic settlement.

**Israel**
- Reduce direct military threats.
- Preserve national security.
- Maintain defensive endurance.
- Prevent unacceptable reconstitution of enemy capabilities.
- Maintain or manage strategic coordination with the United States.
- Secure a credible reduction in future attack risk.

**Iran**
- Preserve government continuity.
- Retain some credible deterrent capability.
- Impose meaningful strategic costs on adversaries.
- Maintain sufficient regional influence.
- Preserve economic and political survival.
- Obtain acceptable settlement terms.

Victory must be evaluated using multiple dimensions.

Destroying three facilities should not automatically guarantee victory.

Surviving a predetermined number of turns should not automatically guarantee victory.

The absence of ground occupation should not automatically mean that Iran has achieved its strategic objectives.

## 28. AI development

The AI needs faction-specific strategy.

The United States and Israel should not use essentially identical target lists.

Iran should not choose targets through weighted randomness alone.

### AI decision framework

For each available action, consider:

- Strategic value
- Military value
- Intelligence confidence
- Expected damage
- Ammunition cost
- Opportunity cost
- Air-defence risk
- Collateral consequences
- Diplomatic consequences
- Domestic political consequences
- Logistics constraints
- Future campaign requirements

### AI objectives

**United States**
- Coalition stability.
- Regional access.
- Threat reduction.
- Force preservation.
- Economic and political endurance.
- Negotiating leverage.

**Israel**
- National survival.
- Immediate threat reduction.
- Air-defence endurance.
- Intelligence advantage.
- Military initiative.
- Strategic coordination with Washington.

**Iran**
- Regime survival.
- Asymmetric deterrence.
- Missile and drone preservation.
- Maritime pressure.
- Distributed military resilience.
- Negotiating leverage.

### AI doctrines

Implement selectable or scenario-specific doctrines, including:

- Maximum pressure
- Attrition
- Saturation
- Ammunition conservation
- Infrastructure disruption
- Maritime pressure
- Escalation restraint
- Negotiation first

### Technical corrections

- Avoid selecting already destroyed targets for later packages.
- Update target availability after each resolved action.
- Ensure AI consumes the same resources as human players.
- Ensure AI uses the same action validation rules.
- Ensure AI orders respect intelligence requirements.
- Ensure AI recognizes maritime opportunities.
- Ensure AI responds to changing political and economic conditions.

### Testing

Run multiple seeds for each faction.

Measure:

- Victory distribution
- Average campaign duration
- Military losses
- Interceptor expenditure
- Economic damage
- Maritime disruption
- Diplomatic outcomes
- Negotiated settlements

Do not balance the game based on one successful playthrough.

# PART F — USER EXPERIENCE AND INTERFACE

## 29. Preserve the existing interface

Do not rewrite the UI from scratch.

Preserve useful existing functionality, including:

- Interactive regional map
- Map pan and zoom
- Minimap
- Jump-to-location drawer
- Next-threat navigation
- Unit action sheet
- Forces panel
- Strategic panel
- Logistics panel
- English/Persian support
- Save slots
- Autosave
- Replay export
- Post-campaign scorecard
- Responsive layout
- Mobile safe-area support
- Reduced-motion support

Inspect the actual interface before changing it.

## 30. Recommended campaign flow

Use this structure:

1. Main menu
2. Scenario selection
3. Faction selection
4. Faction briefing
5. Strategic situation briefing
6. Campaign map
7. Turn planning
8. Order review
9. Turn resolution
10. Turn report
11. Campaign outcome

Do not overload the player with every strategic statistic immediately.

## 31. Faction briefings

Each faction should have:

- Strategic situation
- Starting objectives
- Strengths
- Weaknesses
- Political constraints
- Economic constraints
- Military capabilities
- Available strategic actions
- Key threats
- Recommended first-turn priorities

Do not present one faction as objectively superior in every category.

## 32. Turn review interface

Before resolving the turn, provide:

- Queued orders
- Resource expenditure
- Ammunition reservations
- Reinforcement requests
- Validation errors
- Threat warnings
- Expected consequences
- Uncertain consequences

Separate outcomes into:

- Guaranteed
- Likely
- Uncertain

The player should be able to remove or modify queued orders before resolution.

## 33. Strategic panel

Organize information into:

1. Situation
2. Military
3. Economy and logistics
4. Diplomacy
5. Politics and escalation

Keep the current strategic situation visible.

Other sections should be expandable or collapsible.

Do not place every statistic in one long undifferentiated panel.

## 34. Turn reports

Organize reports into:

- Friendly military operations
- Enemy military operations
- Missile and drone activity
- Air defence
- Maritime operations
- Logistics and production
- Political and diplomatic developments
- Strategic consequences

Each report must explain actual state changes.

Distinguish confirmed events from intelligence estimates.

Avoid generic logs such as "the situation has changed" when the game can report what changed.

## 35. Mobile and accessibility requirements

Preserve mobile usability.

Check:

- Narrow screens
- Small screens below 380px
- Persistent faction identity
- Threat indicators
- Expandable information panels
- Removable queued orders
- Clear friendly/hostile/neutral/unknown indicators
- Safe-area spacing
- Reduced motion

Accessibility requirements:

- Correct modal dialog semantics
- Keyboard navigation
- Focus management
- Focus restoration
- Visible focus indicators
- Accessible labels
- Clear status announcements where appropriate

## 36. English and Persian localization

Preserve bilingual support.

Check:

- Complete translation coverage
- Correct right-to-left layout
- Mixed Persian/English terminology
- Number formatting
- Date formatting
- Text alignment
- Accessible control labels
- No broken or clipped text

Do not introduce hardcoded English strings into the UI when localization infrastructure already exists.

# PART G — SCENARIOS AND REPLAYABILITY

## 37. Scenario architecture

Scenarios must have genuinely different starting conditions.

Recommended scenarios:

### Scenario 1: Eve of War
Date: 27 February 2026.

Pre-war military, political, economic and diplomatic conditions.

### Scenario 2: Opening Campaign
Date: 28 February 2026.

Opening attacks, first-day conditions and immediate responses.

### Scenario 3: Attrition Campaign
A selected later date.

Changed military inventories, infrastructure damage, economic disruption and political pressure.

### Scenario 4: Failed Agreement / Renewed Conflict
A selected post-August date.

Changed diplomatic conditions, reconstituted capabilities, depleted stocks and renewed hostilities.

Each scenario needs its own:

- Unit positions
- Unit strengths
- Stockpiles
- Infrastructure condition
- Political conditions
- Economic conditions
- Host-country access
- Intelligence picture
- Diplomatic relationships
- Reinforcement availability
- Strategic objectives

Do not create scenarios by changing only the title and a few starting values.

## 38. Replay system

The current replay export contains information such as:

- Seed
- Faction
- Scenario ID
- Order log
- Final turn
- Campaign status

Develop this into a reliable replay system.

Store:

- Random seed
- Scenario version
- Rules version
- Data version
- Faction
- Player orders
- AI orders
- Events
- Resolved outcomes
- Campaign result

Implement:

- Replay import
- Replay playback
- Turn-by-turn inspection
- Event inspection
- State comparison
- Campaign comparison

A replay should reproduce the same outcomes when run against the same scenario, data and rules versions.

If a rules update makes old replays incompatible, report that clearly.

## 39. Future replayability features

Later development may include:

- Challenge scenarios
- Historical comparison mode
- Scenario editor
- Custom starting conditions
- Additional factions or regional actors
- Advanced AI difficulty

Multiplayer is not an early development priority.

# PART H — TESTING AND QUALITY ASSURANCE

## 40. Testing philosophy

Every major mechanic must have tests.

Do not consider a feature complete merely because it appears to work in the UI.

Test the engine and state transitions.

## 41. Existing testing concerns

The initial review found:

- Existing tests cover several political, logistics, fog-of-war, navigation and engine systems.
- Dedicated combat and AI test coverage is insufficient.
- The GitHub Actions workflow does not run tests.
- README documentation claims a test count that CI does not verify.

Correct these inconsistencies.

## 42. Required test categories

### Core engine
- Turn progression
- Order resolution
- State integrity
- Deterministic randomness
- Save and load

### Order validation
- Resource reservations
- Ammunition reservations
- Movement limits
- Duplicate orders
- Invalid targets
- Permission checks
- Order removal and reservation release

### Combat
- Air strikes
- Missile strikes
- Drone attacks
- Interception
- Air-defence suppression
- Damage
- Ammunition consumption
- Repair

### Maritime
- Mine-laying
- Mine detection
- Mine clearance
- Anti-ship attacks
- Convoy protection
- Shipping disruption
- Hormuz economic effects

### Logistics
- Airlift
- Sealift
- Naval deployment
- Transit time
- Base access
- Port capacity
- Host-country permission
- Reinforcement arrival

### Intelligence
- Reconnaissance
- Detection
- Identification
- Tracking
- Estimate improvement
- Intelligence decay

### Diplomacy and politics
- Host access
- Diplomatic events
- Great-power effects
- Domestic support
- Regime stability
- Negotiations
- Escalation

### Victory
- Each faction's objectives
- Multiple outcome paths
- No automatic victory from an irrelevant condition
- Prolonged conflict
- Negotiated settlement
- Defeat and catastrophic outcomes

### AI
- Legal order generation
- Resource consumption
- Target selection
- Strategic adaptation
- Maritime decisions
- Different faction doctrines

### UI
- Mobile layouts
- RTL
- Keyboard access
- Dialog behavior
- Turn review
- Error messages

## 43. CI requirements

Update GitHub Actions to run:

1. Dependency installation.
2. TypeScript checks.
3. Automated tests.
4. Production build.
5. Deployment only after successful validation.

The CI pipeline must not deploy a build that fails required checks.

Use the project's existing package manager and scripts unless there is a documented reason to change them.

# PART I — BUILD AND DEPLOYMENT

## 44. Canonical build source

The initial audit found a potentially fragile deployment arrangement:

- The workflow builds `dist/`.
- Generated output is copied over root `index.html`.
- Asset paths are rewritten.
- Root `index.html` may therefore serve both as source and generated deployment output.

Investigate and correct this.

Establish a clear separation between:

- Source files
- Build output
- Deployment artifacts

Avoid a build process that gradually overwrites its own source.

Preserve GitHub Pages deployment.

Do not change hosting providers unless explicitly requested.

## 45. Deployment requirements

Before merging:

- Build succeeds.
- TypeScript checks pass.
- Tests pass.
- No broken asset paths.
- No missing translations.
- No console-breaking runtime errors.
- Mobile layout is checked.
- The published website loads correctly.

Do not claim that deployment succeeded until the workflow or published site confirms it.

# PART J — DEVELOPMENT ROADMAP AND EXECUTION ORDER

Implement the work in phases.

Do not attempt all changes in one enormous coding operation.

Each phase must produce a working, testable result.

## Phase 0 — Repository stabilization

**Priority: P0**

Tasks:

1. Inspect all branches.
2. Identify the production baseline.
3. Establish canonical UI source.
4. Run the existing build.
5. Run the existing tests.
6. Identify TypeScript errors.
7. Fix documentation/build inconsistencies.
8. Add tests to CI.
9. Establish a safe development branch.

Acceptance criteria:

- Build is reproducible.
- Tests can be run locally and in CI.
- Deployment source is clear.
- No existing functionality has been removed.
- Baseline behavior is documented.

Do not begin major game redesign before this phase is stable.

## Phase 1 — Historical data and core rules

**Priority: P0**

Tasks:

1. Correct facility classification.
2. Reconcile inventory totals.
3. Separate physical estimates from game-scale values.
4. Establish provenance and confidence.
5. Define scenario-specific starting states.
6. Correct the primary campaign baseline.
7. Clarify turn semantics.
8. Correct victory-condition assumptions.

Acceptance criteria:

- No known nuclear/missile category errors remain.
- Aggregate inventories reconcile.
- Scenario values have a clear source or abstraction label.
- Later-war data is not accidentally used in the pre-war scenario.
- Victory conditions are not automatically satisfied because of missing unit categories.

## Phase 2 — Core mechanics repair

**Priority: P0–P1**

Implement in this order:

1. Projected order validation.
2. Resource and ammunition reservations.
3. Action permissions.
4. Cyber and special-operations corrections.
5. Combat consistency.
6. Air-defence and radar integration.
7. Missile and drone stock consumption.
8. Maritime orders.
9. Logistics transport modes.
10. Intelligence improvements.
11. Diplomatic state effects.
12. Domestic politics and escalation.
13. Victory evaluation.

Acceptance criteria:

- All orders are validated by the engine.
- Human and AI actions use the same rules.
- Resource consumption is consistent.
- Events produce actual state changes.
- No major mechanic exists only in the UI or narrative logs.

## Phase 3 — AI and balance

**Priority: P1**

Tasks:

1. Separate faction strategies.
2. Improve target evaluation.
3. Add maritime awareness.
4. Add stock conservation.
5. Add political and diplomatic evaluation.
6. Add strategic doctrines.
7. Run multi-seed simulations.
8. Review faction outcome distributions.

Acceptance criteria:

- Factions behave differently.
- AI uses available mechanics.
- AI respects constraints.
- AI does not repeatedly attack invalid targets.
- AI does not receive hidden resource advantages.
- Balance is supported by simulation results.

## Phase 4 — UX and player experience

**Priority: P1–P2**

Tasks:

1. Faction briefing.
2. Scenario briefing.
3. Strategic situation summary.
4. Turn-order review.
5. Improved turn reports.
6. Strategic panel organization.
7. Mobile refinements.
8. Accessibility.
9. Complete localization review.

Acceptance criteria:

- New players understand their objectives.
- Players can see why orders are invalid.
- Players understand major consequences.
- Important information is accessible on mobile.
- English and Persian interfaces remain functional.

## Phase 5 — Scenarios and replay

**Priority: P2**

Tasks:

1. Build scenario-specific starting states.
2. Add later-war scenario conditions.
3. Version scenario and rules data.
4. Improve replay export.
5. Implement replay import.
6. Implement deterministic playback.
7. Add turn inspection.

Acceptance criteria:

- Scenarios have meaningfully different starting conditions.
- Replays are reproducible with matching versions.
- Old incompatible replays are identified.
- Campaign outcomes can be compared.

## Phase 6 — Advanced development

**Priority: P3**

Possible additions:

- Scenario editor
- Custom starting conditions
- More regional actors
- Additional campaign objectives
- Historical challenge mode
- Advanced AI difficulty
- More detailed economic simulation

Only begin these after the core systems are reliable.

# PART K — STRICT IMPLEMENTATION RULES

## 46. Rules you must never violate

1. Never rewrite the entire game to implement one feature.
2. Never remove existing functionality without documenting why.
3. Never invent historical figures.
4. Never present uncertain intelligence as confirmed fact.
5. Never mix nuclear facilities with missile factories.
6. Never maintain multiple conflicting sources of truth for the same stockpile.
7. Never let the UI be the only place where permissions are enforced.
8. Never allow AI to bypass normal game rules.
9. Never allow narrative events to claim effects that did not happen.
10. Never use a random outcome that breaks deterministic replay.
11. Never make a major rule change without tests.
12. Never silently change scenario starting conditions.
13. Never make all factions use the same strategic logic.
14. Never make victory depend on one arbitrary statistic.
15. Never sacrifice mobile usability for desktop-only improvements.
16. Never break Persian localization or RTL support.
17. Never overwrite source files with generated deployment output.
18. Never deploy an untested build.
19. Never modify unrelated files just to make a change easier.
20. Never claim a feature is complete without verifying its behavior.

## 47. Code quality

Prefer:

- Small functions
- Clear types
- Explicit state transitions
- Reusable rules
- Centralized validation
- Deterministic calculations
- Documented abstractions
- Meaningful error messages
- Focused tests

Avoid:

- Duplicated business logic
- Hidden state mutations
- Unexplained constants
- Unused mechanics
- Inconsistent AI shortcuts
- Giant files that combine unrelated systems
- UI components that contain game-engine logic

## 48. Data quality

For every important value, ask:

1. What does this value represent?
2. What date does it describe?
3. Is it verified or estimated?
4. What is the source?
5. What is the confidence?
6. How is it converted into game units?
7. Does another file contain a conflicting value?
8. Which mechanics use it?
9. Does changing it affect scenario balance?

If the answer is unknown, do not invent one.

# PART L — WORKING METHOD FOR THE CODING AGENT

## 49. Before each development phase

First provide:

1. Files inspected.
2. Existing behavior.
3. Identified problem.
4. Proposed changes.
5. Files expected to change.
6. Potential regressions.
7. Tests to be added or updated.
8. Acceptance criteria.

For a small, isolated correction, this can be concise.

For a major system redesign, provide a more detailed plan before implementation.

## 50. During implementation

Work in small vertical slices.

For example, when implementing mine-laying:

1. Define the order type.
2. Add validation.
3. Add resource reservation.
4. Add resolution.
5. Update the game state.
6. Update AI use.
7. Update UI action availability.
8. Update turn reporting.
9. Add tests.
10. Verify existing maritime behavior.

Do not implement the UI action first and leave the underlying rules unfinished.

## 51. After each change

Report:

- What changed.
- Why it changed.
- Files modified.
- Tests added.
- Tests run.
- Build result.
- Known limitations.
- Any historical assumptions introduced.

Do not report a test as passing if it was not actually run.

Do not report a deployment as successful unless it was verified.

## 52. Git discipline

Use focused commits.

Recommended approach:

- One commit per coherent feature or correction.
- Do not combine unrelated refactoring with gameplay changes.
- Avoid force-pushing.
- Do not overwrite the production branch during early development.
- Preserve a recoverable baseline.

Use clear commit messages, for example:

- `fix: reconcile missile inventory totals`
- `fix: enforce projected order validation`
- `feat: add maritime mine-laying orders`
- `feat: model air-defence engagement`
- `feat: add scenario-specific historical baselines`
- `test: add AI resource-consumption coverage`

# PART M — FINAL ACCEPTANCE STANDARD

Chokepoint should not be considered complete merely because it builds and displays a playable map.

The project should meet these standards.

## Historical integrity

- Historical starting conditions are date-specific.
- Estimates are labelled as estimates.
- Disputed claims are identified.
- Nuclear and missile facilities are classified correctly.
- Scenario inventories are internally consistent.
- Later-war developments are not confused with pre-war conditions.

## Gameplay integrity

- Orders are validated correctly.
- Resources are consumed consistently.
- Combat rules are coherent.
- Air defence is connected to actual units and radar.
- Maritime operations are playable.
- Logistics reflects transport modes and access.
- Intelligence improves decision-making.
- Diplomacy produces real consequences.
- Domestic politics affects strategic choices.
- Victory conditions represent meaningful strategic outcomes.

## Faction integrity

- United States, Israel and Iran have distinct strengths and constraints.
- Their objectives differ.
- Their AI behavior differs.
- No faction has an automatic or arbitrary victory path.
- Balance is tested across multiple seeds.

## Player experience

- The game explains its systems.
- Players can understand their strategic situation.
- Order review prevents avoidable mistakes.
- Reports explain consequences.
- The interface remains usable on mobile.
- English and Persian remain supported.
- Existing useful features remain available.

## Technical integrity

- Build succeeds.
- TypeScript checks pass.
- Tests pass in CI.
- Game state has a clear source of truth.
- Replays are reproducible with matching versions.
- Deployment is reliable.
- Documentation matches actual implementation.

---

# PART N — YOUR FIRST TASK

Do not start implementing every change immediately.

Your first task is to perform a controlled repository assessment and produce an implementation plan.

### Step 1 — Inspect

Inspect:

- Current branch
- All available branches
- Working tree status
- Package scripts
- Build workflow
- Test workflow
- Core game architecture
- Scenario data
- Historical data files
- UI source
- Existing tests

### Step 2 — Verify

Confirm which of the previously identified issues still exist in the current source.

Do not assume that every audit finding remains unchanged.

Specifically verify:

- Nuclear/missile facility classification.
- Inventory reconciliation.
- Scenario starting values.
- Projected order validation.
- Cyber permissions.
- Maritime order consistency.
- AI ammunition consumption.
- Air-defence integration.
- Logistics route handling.
- Intelligence estimates.
- Victory-condition logic.
- Political event effects.
- Replay functionality.
- Deployment source/output separation.
- CI test execution.

### Step 3 — Report

Produce a table:

| Issue | Still present? | Evidence | Severity | Proposed fix |
|---|---|---|---|---|

Classify severity:

- Critical
- High
- Medium
- Low

Identify any new problems discovered.

### Step 4 — Propose a safe implementation sequence

Provide:

- Exact phases.
- Exact files likely to change.
- Dependencies.
- Acceptance criteria.
- Required tests.
- Risks.
- Estimated relative complexity.

Do not give false precision in time estimates.

### Step 5 — Wait for implementation authorization

Do not start a broad implementation or rewrite before the repository assessment and implementation plan have been presented and approved.

Once authorized, begin with Phase 0 and proceed incrementally.

**The goal is not to create a larger game by adding more mechanics. The goal is to create a coherent strategic simulation in which every important mechanic works, interacts with the others, and produces understandable consequences.**
