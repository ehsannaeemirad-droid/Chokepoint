/**
 * Historical references for the modelled values (Phase 1c).
 *
 * Source policy: no URL or publication title is asserted that has not been
 * confirmed. Where a public source is named it is an organisation-level page
 * (IAEA, CSIS Missile Threat, CRS, Arms Control Association, IEA, FPRI, IFRI),
 * never a fabricated article. Every number that is a game-scale decision rather
 * than a published figure is labelled `game-abstraction` and says how it was
 * converted. Facilities use `notes` + `gameMapping` instead of a numeric value,
 * because what is sourced there is the site's role, not a quantity.
 */
import type { HistoricalReference } from '../core/provenance';
import { DELIVERY_CLASSES } from '../core/inventory';
import { LATE_SCENARIOS } from './lateScenarios';

const REVIEWED = '2026-11-09';
const PREWAR = '2026-02-27';

function ref(record: Omit<HistoricalReference, 'lastReviewed'>): HistoricalReference {
  return { lastReviewed: REVIEWED, ...record };
}

export const REFERENCES: HistoricalReference[] = [
  // ---- facilities -----------------------------------------------------------
  ref({
    id: 'ref-facility-isfahan',
    subjectId: 'isfahan',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'IAEA',
    sourceUrl: 'https://www.iaea.org/sites/default/files/25/06/gov2025-24.pdf',
    notes:
      'Isfahan hosts Iran’s uranium conversion plant; enrichment and munition assembly are not attributed to this site in this build.',
    gameMapping:
      'FacilityCategory nuclear-conversion. No production lines. Hardened, so damage requires sustained or bunker-buster strikes.',
  }),
  ref({
    id: 'ref-facility-natanz',
    subjectId: 'natanz',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'IAEA',
    sourceUrl: 'https://www.iaea.org/sites/default/files/25/06/gov2025-24.pdf',
    notes:
      'Natanz is Iran’s main gas-centrifuge enrichment site, with a hall under concrete and earth cover.',
    gameMapping:
      'FacilityCategory nuclear-enrichment. No production lines. buried 25 m, surfaceFloor 55: only a bunker-buster reaches the hall.',
  }),
  ref({
    id: 'ref-facility-fordow',
    subjectId: 'fordow',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'IAEA',
    sourceUrl: 'https://www.iaea.org/sites/default/files/25/06/gov2025-24.pdf',
    notes: 'Fordow is a deep underground enrichment hall inside a mountain.',
    gameMapping:
      'FacilityCategory nuclear-enrichment. No production lines. buried 60 m: the hardest target in the theatre, reachable only by the B-2/MOP combination modelled here.',
  }),
  ref({
    id: 'ref-facility-khojir',
    subjectId: 'khojir',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'low',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/',
    notes:
      'Open-source reporting places a dispersed underground production complex east of Tehran; the coordinates in this build are approximate.',
    gameMapping:
      'FacilityCategory missile-production, kind missile-industry, production lines missile + drone. Underground regeneration 2 drones / 2 missiles per turn at full integrity (labelled abstraction).',
  }),
  ref({
    id: 'ref-facility-parchin',
    subjectId: 'parchin',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'low',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/',
    notes:
      'Parchin is reported as a hardened research and missile-related production complex; coordinates are approximate and the facility’s exact role is disputed in open sources.',
    gameMapping:
      'FacilityCategory missile-production, kind missile-industry, production line missile. Underground regeneration 1 missile per turn at full integrity.',
  }),
  ref({
    id: 'ref-facility-shahroud',
    subjectId: 'shahroud',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'low',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/',
    notes:
      'Shahroud is reported as a long-range missile storage and transporter-erector-launcher dispersal area; coordinates are approximate.',
    gameMapping:
      'FacilityCategory weapons-storage, kind missile-industry, production line missile (regeneration abstraction only). Underground regeneration 1 missile per turn.',
  }),
  ref({
    id: 'ref-facility-bandar-abbas-storage',
    subjectId: 'bandar_abbas_underground',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'low',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/',
    notes:
      'Coastal underground munition storage is reported near Bandar Abbas, adjacent to IRGC-N facilities; coordinates approximate.',
    gameMapping:
      'FacilityCategory weapons-storage; drone regeneration 3 per turn at full integrity, a labelled abstraction rather than a production line.',
  }),
  ref({
    id: 'ref-facility-tabriz',
    subjectId: 'tabriz_complex',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'No single published figure supports this site’s output. It stands for dispersed northwest industrial depth, aggregated into one map node.',
    gameMapping:
      'FacilityCategory defence-industry; missile + drone regeneration 1 each per turn at full integrity. Not a literal factory count.',
  }),

  // ---- campaign arsenal -----------------------------------------------------
  ref({
    id: 'ref-campaign-arsenal-drone',
    subjectId: 'campaign:arsenal:drone',
    category: 'arsenal',
    validAt: PREWAR,
    value: 72,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'Open-source reporting gives order-of-magnitude drone inventories, not a launchable-round count for a specific day.',
    gameMapping:
      '72 mated Shahed-136 rounds at the 27 Feb 2026 start. One round = one airframe plus one conventional warhead; drones are the cheapest class and the largest stock.',
  }),
  ref({
    id: 'ref-campaign-arsenal-fateh',
    subjectId: 'campaign:arsenal:fateh',
    category: 'arsenal',
    validAt: PREWAR,
    value: 36,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Short-range ballistic inventory is estimated within a wide band in open sources.',
    gameMapping:
      '36 mated Fateh-110 class rounds. The ±25% band in inventory.ts is the disclosure of that uncertainty, not a second estimate.',
  }),
  ref({
    id: 'ref-campaign-arsenal-khorramshahr',
    subjectId: 'campaign:arsenal:khorramshahr',
    category: 'arsenal',
    validAt: PREWAR,
    value: 16,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Medium-range ballistic stock counts are not published with confidence.',
    gameMapping: '16 mated Khorramshahr rounds; ±33% displayed band.',
  }),
  ref({
    id: 'ref-campaign-arsenal-fattah',
    subjectId: 'campaign:arsenal:fattah',
    category: 'arsenal',
    validAt: PREWAR,
    value: 6,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Hypersonic-class stocks are the least certain in the model; the game keeps them scarce.',
    gameMapping: '6 mated Fattah rounds; ±40% displayed band, the widest in the arsenal.',
  }),
  ref({
    id: 'ref-campaign-arsenal-asm',
    subjectId: 'campaign:arsenal:asm',
    category: 'arsenal',
    validAt: PREWAR,
    value: 12,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Coastal anti-ship batteries are counted as launchers in open sources, not as rounds.',
    gameMapping: '12 anti-ship rounds for the asm_launcher unit; one round per shot.',
  }),
  ref({
    id: 'ref-tutorial-arsenal-drone',
    subjectId: 'tutorial:arsenal:drone',
    category: 'arsenal',
    validAt: PREWAR,
    value: 12,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial stocks are a reduced teaching scenario, not a historical baseline.',
    gameMapping: '12 mated drone rounds so a five-turn tutorial can be completed without resupply.',
  }),
  ref({
    id: 'ref-tutorial-arsenal-fateh',
    subjectId: 'tutorial:arsenal:fateh',
    category: 'arsenal',
    validAt: PREWAR,
    value: 8,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial value.',
    gameMapping: '8 mated Fateh-110 rounds.',
  }),
  ref({
    id: 'ref-tutorial-arsenal-khorramshahr',
    subjectId: 'tutorial:arsenal:khorramshahr',
    category: 'arsenal',
    validAt: PREWAR,
    value: 0,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Removed from the tutorial so the player sees one ballistic class at a time.',
    gameMapping: '0 rounds by design; the class exists but is not stocked.',
  }),
  ref({
    id: 'ref-tutorial-arsenal-fattah',
    subjectId: 'tutorial:arsenal:fattah',
    category: 'arsenal',
    validAt: PREWAR,
    value: 0,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Removed from the tutorial to keep the first five turns legible.',
    gameMapping: '0 rounds by design.',
  }),
  ref({
    id: 'ref-tutorial-arsenal-asm',
    subjectId: 'tutorial:arsenal:asm',
    category: 'arsenal',
    validAt: PREWAR,
    value: 2,
    unit: 'rounds',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial value.',
    gameMapping: '2 anti-ship rounds, enough for one demonstration shot.',
  }),

  // ---- launchers ------------------------------------------------------------
  ref({
    id: 'ref-campaign-launchers-drone',
    subjectId: 'campaign:launchers:drone',
    category: 'launcher',
    validAt: PREWAR,
    value: 12,
    unit: 'sorties_per_turn',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'The model needs a per-turn launch capacity; published reporting counts launchers and units, not sorties.',
    gameMapping:
      '12 drone sorties per turn, shared by the player and the AI and reset each turn. A sortie is consumed per round fired.',
  }),
  ref({
    id: 'ref-campaign-launchers-ballistic',
    subjectId: 'campaign:launchers:ballistic',
    category: 'launcher',
    validAt: PREWAR,
    value: 9,
    unit: 'sorties_per_turn',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Ballistic launcher availability is reported as ranges, not a per-day sortie count.',
    gameMapping:
      '9 ballistic sorties per turn for Fateh/Khorramshahr/Fattah/ASM. Reset each turn; shared with the AI.',
  }),
  ref({
    id: 'ref-tutorial-launchers-drone',
    subjectId: 'tutorial:launchers:drone',
    category: 'launcher',
    validAt: PREWAR,
    value: 6,
    unit: 'sorties_per_turn',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial value.',
    gameMapping: '6 drone sorties per turn so a single salvo teaches the budget without exhausting it.',
  }),
  ref({
    id: 'ref-tutorial-launchers-ballistic',
    subjectId: 'tutorial:launchers:ballistic',
    category: 'launcher',
    validAt: PREWAR,
    value: 4,
    unit: 'sorties_per_turn',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial value.',
    gameMapping: '4 ballistic sorties per turn.',
  }),

  // ---- nuclear material -----------------------------------------------------
  ref({
    id: 'ref-campaign-nuclear-material',
    subjectId: 'campaign:nuclear-material',
    category: 'nuclear-material',
    validAt: PREWAR,
    value: 0,
    unit: 'warhead_equivalents',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'The build models a threshold nuclear programme through facility integrity and escalation, not a stockpile of warheads.',
    gameMapping:
      '0 warhead equivalents at start. The field exists to keep nuclear material disjoint from conventional rounds; no code path produces it in this build.',
  }),
  ref({
    id: 'ref-tutorial-nuclear-material',
    subjectId: 'tutorial:nuclear-material',
    category: 'nuclear-material',
    validAt: PREWAR,
    value: 0,
    unit: 'warhead_equivalents',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'The tutorial does not model the nuclear programme.',
    gameMapping: '0 warhead equivalents; never populated.',
  }),

  // ---- scenario starting values --------------------------------------------
  ref({
    id: 'ref-campaign-resources',
    subjectId: 'campaign:resources',
    category: 'scenario',
    validAt: PREWAR,
    value: 160,
    unit: 'war_resources',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Iranian war production is an abstraction of industrial capacity scaled to a 30-turn campaign.',
    gameMapping:
      '160 starting resources, +10 per turn income. One turn = 24 h for the opening campaign (BALANCE.iranResourceIncome).',
  }),
  ref({
    id: 'ref-campaign-initial-hormuz',
    subjectId: 'campaign:initial-hormuz',
    category: 'scenario',
    validAt: PREWAR,
    value: 30,
    unit: 'percent_disruption',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'IEA',
    sourceUrl: 'https://www.iea.org/',
    notes:
      'Pre-war Hormuz transit is not reported as a single disruption index; the real baseline is normal commercial flow with insurance and escort risk.',
    gameMapping:
      'Initial disruption 30 on a 0-100 scale, representing peacetime friction plus pre-war risk, not a measurable closure.',
  }),
  ref({
    id: 'ref-campaign-hosts',
    subjectId: 'campaign:hosts',
    category: 'scenario',
    validAt: PREWAR,
    value: 8,
    unit: 'host_nations',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'Each host’s threat perception (15-45) is a scenario choice, not a published survey figure.',
    gameMapping:
      'Eight host states seeded at threat 15-45 in scenarios.json; threat rises with strikes and closes base access through the politics rules.',
  }),
  ref({
    id: 'ref-tutorial-resources',
    subjectId: 'tutorial:resources',
    category: 'scenario',
    validAt: PREWAR,
    value: 40,
    unit: 'war_resources',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial value.',
    gameMapping: '40 starting resources so production cannot dominate a five-turn lesson.',
  }),
  ref({
    id: 'ref-tutorial-initial-hormuz',
    subjectId: 'tutorial:initial-hormuz',
    category: 'scenario',
    validAt: PREWAR,
    value: 25,
    unit: 'percent_disruption',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial value.',
    gameMapping: '25 initial disruption: below the interdict threshold (60) by design.',
  }),
  ref({
    id: 'ref-tutorial-hosts',
    subjectId: 'tutorial:hosts',
    category: 'scenario',
    validAt: PREWAR,
    value: 8,
    unit: 'host_nations',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tutorial values, each two points below the campaign seed.',
    gameMapping: 'Eight host states seeded at threat 14-44 for the tutorial.',
  }),

  // ---- oil and economic context -------------------------------------------
  ref({
    id: 'ref-market-oil-price',
    subjectId: 'oil-price',
    category: 'politics',
    validAt: PREWAR,
    value: 60,
    unit: 'index',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'The oil price meter is an index, not a dollar price. IEA reporting is the reference frame for the direction of travel, not for this number.',
    gameMapping:
      'Index 60 at start; rises with Hormuz disruption and sustained closure, clamped 40-220. The 130 threshold for the oil-shock path is a scenario constant.',
  }),
  ref({
    id: 'ref-domestic-congress',
    subjectId: 'congressional-support',
    category: 'politics',
    validAt: PREWAR,
    value: 60,
    unit: 'index',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'Congressional support is modelled as an index seeded from scenario data; CRS is the reference frame for the war-powers structure, not for the number.',
    gameMapping:
      'Congress 60 at start, falling with casualties and escalation, recovering on quiet turns. Restrictions at 35, suspension at 20.',
  }),

  // ---- classified radar, command and naval roles (Phase 1c closeout) -------
  ref({
    id: 'ref-facility-al-udeid',
    subjectId: 'al_udeid',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'US Air Forces Central',
    sourceUrl: 'https://www.afcent.af.mil/',
    notes: 'Al Udeid is the forward headquarters of US Air Forces Central and a major coalition command node.',
    gameMapping: 'FacilityCategory command. The airbase kind still controls sorties; the role is shown in the node card.',
  }),
  ref({
    id: 'ref-facility-al-dhafra',
    subjectId: 'al_dhafra',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'US Air Forces Central',
    sourceUrl: 'https://www.afcent.af.mil/',
    notes: 'Al Dhafra hosts US tankers and AWACS aircraft that cue regional air and missile defence.',
    gameMapping: 'FacilityCategory radar, representing the AWACS/air-surveillance role; the node remains an airbase for basing rules.',
  }),
  ref({
    id: 'ref-facility-muwaffaq-salti',
    subjectId: 'muwaffaq_salti',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'Missile Defense Agency',
    sourceUrl: 'https://www.mda.mil/global/documents/pdf/antpy2.pdf',
    notes: 'Muwaffaq Salti hosted a US AN/TPY-2 forward-based X-band radar for ballistic-missile defence cueing.',
    gameMapping: 'FacilityCategory radar. Degrading the node reduces its contribution to regional BMD in the scenario narrative.',
  }),
  ref({
    id: 'ref-facility-nsa-bahrain',
    subjectId: 'nsa_bahrain',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'US Naval Forces Central Command',
    sourceUrl: 'https://www.cusnc.navy.mil/',
    notes: 'NSA Bahrain is the home of US Naval Forces Central Command and the Fifth Fleet.',
    gameMapping: 'FacilityCategory naval-facility. The naval node kind continues to govern shipping and escort rules.',
  }),
  ref({
    id: 'ref-facility-prince-sultan',
    subjectId: 'prince_sultan',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'US Air Forces Central',
    sourceUrl: 'https://www.afcent.af.mil/',
    notes: 'Prince Sultan Air Base is a Saudi airbase with contingent US access and command infrastructure.',
    gameMapping: 'FacilityCategory command. Host consent still governs whether US missions may launch.',
  }),
  ref({
    id: 'ref-facility-tehran',
    subjectId: 'tehran',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Tehran is modelled as the Iranian political-military command centre; no single physical command building is asserted.',
    gameMapping: 'FacilityCategory command on the urban node. It does not add hit points or production.',
  }),
  ref({
    id: 'ref-facility-bandar-abbas',
    subjectId: 'bandar_abbas',
    category: 'facility',
    validAt: PREWAR,
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes: 'Bandar Abbas combines a major port, naval base and weapons-storage area; the node is abstracted at port level.',
    gameMapping: 'FacilityCategory port-logistics on the port node; shipping effects continue to come from the port kind.',
  }),
];

// ---- weapon systems (Phase 5) ----------------------------------------------
// Model-specific records: what public sources say about the family's range and
// accuracy class, and how this build turned that into hexes and a penetration
// value. No precise CEP is asserted as a hit probability.
REFERENCES.push(
  ref({
    id: 'ref-weapon-shahed136',
    subjectId: 'shahed136',
    category: 'weapon',
    validAt: PREWAR,
    min: 1000,
    max: 2500,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/missile/shahed-131-and-136/',
    sourcePublishedAt: '2026-05-22',
    notes:
      'Published estimates put the Shahed-136 between 1,000 and 2,000 km, with DIA assessing 2,500 km; Iran Watch lists a 40-50 kg warhead. One-way attack, pre-programmed before launch.',
    gameMapping:
      'Range 20 hexes on the compressed theatre map, not a 1:1 km conversion. One round = one airframe plus one warhead; 5 resources to produce, 4 per turn, one launcher sortie per shot.',
  }),
  ref({
    id: 'ref-weapon-fateh110',
    subjectId: 'fateh110',
    category: 'weapon',
    validAt: PREWAR,
    min: 300,
    max: 700,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'Iran Watch',
    sourceUrl:
      'https://www.iranwatch.org/our-publications/weapon-program-background-report/table-irans-ballistic-missile-arsenal',
    sourcePublishedAt: '2026-01-26',
    notes:
      'Fateh-110 is listed at about 300 km with a roughly 100 m CEP; the Zolfaghar variant at 700 km with a 10-30 m CEP. The game models the family, so one accuracy band covers both.',
    gameMapping:
      'Range 9 hexes reaches the Gulf bases. Penetration 0.5 stands for the family mix: the older variants are less accurate than the Zolfaghar, and a single CEP is deliberately not converted into a hit probability.',
  }),
  ref({
    id: 'ref-weapon-khorramshahr',
    subjectId: 'khorramshahr',
    category: 'weapon',
    validAt: PREWAR,
    min: 1700,
    max: 2000,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/missile/khorramshahr/',
    sourcePublishedAt: '2017-09-29',
    notes:
      'Emad is reported at about 1,700 km and Khorramshahr at a claimed 2,000 km, with a smaller-reentry-vehicle version displayed in 2019 at up to 3,000 km. Reported accuracy is far coarser than the solid-fuel Fateh family.',
    gameMapping:
      'Range 27 hexes covers Israel and every Gulf base. Penetration 1 reflects payload and reach, not precision: this family is modelled as easy to detect and hard to stop rather than accurate.',
  }),
  ref({
    id: 'ref-weapon-fattah',
    subjectId: 'fattah',
    category: 'weapon',
    validAt: PREWAR,
    value: 1400,
    unit: 'km_range',
    evidenceType: 'disputed',
    confidence: 'low',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/country/iran/',
    sourcePublishedAt: '2018-06-14',
    notes:
      'Fattah is an Iranian-claimed hypersonic glide vehicle. Range and manoeuvre performance are claims that open sources have not independently confirmed, so this build treats it as a threat class rather than a measured capability.',
    gameMapping:
      'Range 27 hexes, threat class hypersonic, and only the Arrow-3 layer has a non-zero hypersonic intercept. Six rounds at the campaign start keep an unverified capability scarce.',
  }),
  ref({
    id: 'ref-weapon-asm-launcher',
    subjectId: 'asm_launcher',
    category: 'weapon',
    validAt: PREWAR,
    min: 120,
    max: 300,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/country/iran/',
    sourcePublishedAt: '2018-06-14',
    notes:
      'Noor, Ghadir and Khalij Fars are anti-ship derivatives reported in the low hundreds of kilometres, which covers the Strait from the Iranian coast.',
    gameMapping:
      'Range 8 hexes from the coast reaches the shipping lanes. Each battery in range adds 10% Hormuz disruption; the unit is a launcher, and its rounds are tracked by the ASM arsenal class.',
  }),
  ref({
    id: 'ref-weapon-mine-layer',
    subjectId: 'mine_layer',
    category: 'weapon',
    validAt: PREWAR,
    value: 2,
    unit: 'game_hex_range',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'Iranian naval mining is publicly reported, but no open source gives a usable mine count for a specific week, so no number is asserted here.',
    gameMapping:
      'A mine-layer unit with range 2 that spends one turn to add 15% Hormuz disruption. The mine count is a scenario decision, not a published figure.',
  }),
  ref({
    id: 'ref-weapon-fac',
    subjectId: 'fac',
    category: 'weapon',
    validAt: PREWAR,
    value: 3,
    unit: 'game_hex_range',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'IRGC-N small craft and fast attack craft are widely reported; their numbers and readiness are not published with any confidence.',
    gameMapping:
      'Range 3, adds 5% Hormuz disruption per surviving group. It stands for a harassing presence rather than a counted flotilla.',
  }),
);

// ---- coalition and proxy systems (Phase 5b) --------------------------------
// The same treatment for the other side of the map. Aircraft and interceptors
// are recorded by published combat radius or engagement range; units that are
// formations rather than airframes (a carrier group, a special-operations team,
// a signals unit) are labelled abstractions instead of being given a fake range.
REFERENCES.push(
  ref({
    id: 'ref-weapon-f35a',
    subjectId: 'f35a',
    category: 'weapon',
    validAt: PREWAR,
    value: 1093,
    unit: 'km_radius',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'Lockheed Martin F-35 Fast Facts',
    sourceUrl: 'https://www.lockheedmartin.com/content/dam/lockheed-martin/aero/documents/F-35/F35FastFacts3_2020.pdf',
    sourcePublishedAt: '2020-03-09',
    notes:
      'Combat radius on internal fuel is published as greater than 590 nm / 1,093 km on the USAF profile, with a 2,200 km range. Radius, not range: the aircraft must come home.',
    gameMapping:
      'Range 24 hexes is a theatre radius with tanker support, not 1,093 km converted one-to-one. Stealth 0.45 raises the chance a raid goes undetected; penetration 2 reflects a small internal payload.',
  }),
  ref({
    id: 'ref-weapon-f15e',
    subjectId: 'f15e',
    category: 'weapon',
    validAt: PREWAR,
    value: 1270,
    unit: 'km_radius',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'US Air Force F-15E fact sheet',
    sourceUrl: 'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104471/f-15e-strike-eagle/',
    sourceUndated: true,
    notes:
      'Published combat radius on an air-interdiction profile is about 687 nm / 1,270 km with conformal tanks; ferry range is roughly 3,900 km. The Air Force fact sheet itself carries no publication date.',
    gameMapping:
      'Range 24 hexes. Penetration 6 against 2 for the F-35A: the Strike Eagle carries the heavy load and pays for it with a much larger radar signature.',
  }),
  ref({
    id: 'ref-weapon-b2',
    subjectId: 'b2',
    category: 'weapon',
    validAt: PREWAR,
    value: 9600,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'US Air Force B-2 fact sheet',
    sourceUrl: 'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104482/b-2-spirit/',
    sourceUndated: true,
    notes:
      'Unrefuelled range is given as approximately 6,000 nm / 9,600 km, with a 18,000 kg payload. Sorties in this scenario are flown from Diego Garcia with tanker support.',
    gameMapping:
      'Range 40 hexes is the whole theatre, standing in for a Diego Garcia rotation rather than an unrefuelled radius. Penetration 60 is the bunker-buster special case; one airframe per four turns keeps a strategic asset scarce.',
  }),
  ref({
    id: 'ref-weapon-b52',
    subjectId: 'b52',
    category: 'weapon',
    validAt: PREWAR,
    value: 14080,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'Federation of American Scientists',
    sourceUrl: 'https://nuke.fas.org/guide/usa/bomber/b-52.htm',
    sourcePublishedAt: '2000-04-23',
    notes:
      'Unrefuelled combat range is given as in excess of 8,800 miles / 14,080 km, with up to 20 air-launched cruise missiles carried. The figure predates the current H-model upgrades but the airframe has not changed.',
    gameMapping:
      'Range 34 hexes: the aircraft fires standoff cruise missiles from outside Iranian air-defence range, which is why its penetration value is low relative to its attack strength.',
  }),
  ref({
    id: 'ref-weapon-csg',
    subjectId: 'csg',
    category: 'weapon',
    validAt: PREWAR,
    value: 14,
    unit: 'game_hex_range',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'A carrier strike group is a formation, not a weapon: its reach depends on the air wing, the escorts and the sea room. No single published range describes it, so none is asserted.',
    gameMapping:
      'Range 14 hexes, intercept 0.7 against drones and cruise missiles, coverage 2: the group is modelled as a mobile airbase with Aegis area defence, which is what the campaign needs it to be.',
  }),
  ref({
    id: 'ref-weapon-patriot',
    subjectId: 'patriot',
    category: 'weapon',
    validAt: PREWAR,
    min: 20,
    max: 30,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'Missile Defense Advocacy Alliance',
    sourceUrl: 'https://www.missiledefenseadvocacy.org/defense-systems/patriot-advanced-capability-3-missile/',
    sourcePublishedAt: '2020-08-28',
    notes:
      'PAC-3 CRI is listed at about 20 km against ballistic targets and PAC-3 MSE at about 30 km, while the radar detects beyond 100 km (CRS, 2026). Interceptor reach, not radar reach, is what bounds a battery.',
    gameMapping:
      'Coverage 4 hexes and intercept 0.65 against drones, cruise and ballistic missiles; each engagement spends one round from the shared interceptor stock. Rounds are the real constraint, not the launcher.',
  }),
  ref({
    id: 'ref-weapon-thaad',
    subjectId: 'thaad',
    category: 'weapon',
    validAt: PREWAR,
    min: 150,
    max: 200,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'Congressional Research Service IF12645',
    sourceUrl: 'https://www.congress.gov/crs-product/IF12645',
    sourcePublishedAt: '2026-06-23',
    notes:
      'CRS reports THAAD engaging targets at 150-200 km, with a battery of six launchers and 48 interceptors. It covers the middle tier: ballistic missiles in or just outside the atmosphere.',
    gameMapping:
      'Coverage 6 hexes, intercept 0.8, ballistic targets only, two rounds per engagement. The 48-round battery load is abstracted into the shared interceptor pool rather than tracked per battery.',
  }),
  ref({
    id: 'ref-weapon-mq9',
    subjectId: 'mq9',
    category: 'weapon',
    validAt: PREWAR,
    value: 1851,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'US Air Force MQ-9 fact sheet',
    sourceUrl: 'https://www.creech.af.mil/About-Us/Fact-Sheets/Display/Article/669890/mq-9-reaper-fact-sheet/',
    sourceUndated: true,
    notes:
      'Range is given as 1,150 miles / 1,000 nm on 200 knots, with a ceiling up to 50,000 ft. Endurance, not speed, is the defining figure.',
    gameMapping:
      'Range 14 hexes. The unit exists mainly for its sensor: it reveals hidden Iranian launchers for a turn, and its light munitions are secondary.',
  }),
  ref({
    id: 'ref-weapon-sof',
    subjectId: 'sof',
    category: 'weapon',
    validAt: PREWAR,
    value: 1,
    unit: 'game_hex_range',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'Special-operations teams are reported to operate inside Iran, but no open source describes their reach or manning in a way that could be turned into a range.',
    gameMapping:
      'Adjacent-hex sabotage only: one hex of reach, resolved as an abstract operation rather than a modelled raid.',
  }),
  ref({
    id: 'ref-weapon-iron-dome',
    subjectId: 'iron_dome',
    category: 'weapon',
    validAt: PREWAR,
    min: 4,
    max: 70,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'BBC News',
    sourceUrl: 'https://www.bbc.co.uk/news/world-middle-east-20385306',
    sourcePublishedAt: '2024-10-16',
    notes:
      'Tamir is described as engaging rockets inside roughly 70 km; no minimum is published, so the 4 km floor is a modelling choice, not a sourced figure. Only threats judged to hit built-up areas are engaged.',
    gameMapping:
      'Coverage 3 hexes, intercept 0.85 against drones and cruise missiles, one round per engagement: the highest single-shot probability in the game, paired with the shortest reach.',
  }),
  ref({
    id: 'ref-weapon-davids-sling',
    subjectId: 'davids_sling',
    category: 'weapon',
    validAt: PREWAR,
    min: 40,
    max: 300,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'high',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/defsys/davids-sling/',
    sourcePublishedAt: '2021-07-13',
    notes:
      'The Stunner interceptor is reported to engage at 40-300 km and up to 15 km altitude, with no warhead: it destroys by direct impact.',
    gameMapping:
      'Coverage 5 hexes, intercept 0.7 against cruise and ballistic missiles. The middle tier between Iron Dome and Arrow, as in the real architecture.',
  }),
  ref({
    id: 'ref-weapon-arrow2',
    subjectId: 'arrow2',
    category: 'weapon',
    validAt: PREWAR,
    value: 100,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/defsys/arrow-2/',
    sourceUndated: true,
    notes:
      'Arrow-2 is reported with a maximum intercept range of about 100 km and an engagement altitude around 50 km, using a fragmentation warhead in the upper atmosphere.',
    gameMapping:
      'Coverage 8 hexes, intercept 0.65 against ballistic missiles; it is the layer most likely to be saturated by a large salvo.',
  }),
  ref({
    id: 'ref-weapon-arrow3',
    subjectId: 'arrow3',
    category: 'weapon',
    validAt: PREWAR,
    value: 2400,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'BBC News',
    sourceUrl: 'https://www.bbc.co.uk/news/world-middle-east-20385306',
    sourcePublishedAt: '2024-10-16',
    notes:
      'Arrow-3 is described as intercepting outside the atmosphere at a reported 2,400 km flyout, which is engagement geometry rather than the distance it can defend.',
    gameMapping:
      'Coverage 8 hexes and the only layer with a non-zero hypersonic intercept, standing for the exo-atmospheric shot rather than a 2,400 km defended area.',
  }),
  ref({
    id: 'ref-weapon-iron-beam',
    subjectId: 'iron_beam',
    category: 'weapon',
    validAt: PREWAR,
    min: 2,
    max: 10,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'low',
    sourceName: 'The Indian Express',
    sourceUrl: 'https://indianexpress.com/article/explained/everyday-explainers/israels-air-defence-system-iron-dome-arrow-david-sling-9600057/',
    sourcePublishedAt: '2024-10-02',
    notes:
      'Iron Beam is reported for rockets at up to about 10 km. Performance against larger rockets, and behaviour in bad weather, remain claims rather than measured public figures.',
    gameMapping:
      'Coverage 2 hexes with a high intercept probability and no interceptor expenditure: a short-range complement to Iron Dome, deliberately the smallest footprint on the map.',
  }),
  ref({
    id: 'ref-weapon-f15i',
    subjectId: 'f15i',
    category: 'weapon',
    validAt: PREWAR,
    value: 1270,
    unit: 'km_radius',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'US Air Force F-15E fact sheet',
    sourceUrl: 'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104471/f-15e-strike-eagle/',
    sourceUndated: true,
    notes:
      'The F-15I Ra’am is the Israeli F-15E variant. Performance is taken from the US aircraft; Israeli-specific modifications and loadouts are not public.',
    gameMapping:
      'Range 33 hexes: a longer theatre reach than the US F-15E because Israeli sorties here are modelled with tanker support from home bases.',
  }),
  ref({
    id: 'ref-weapon-f35i',
    subjectId: 'f35i',
    category: 'weapon',
    validAt: PREWAR,
    value: 1093,
    unit: 'km_radius',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'Lockheed Martin F-35 Fast Facts',
    sourceUrl: 'https://www.lockheedmartin.com/content/dam/lockheed-martin/aero/documents/F-35/F35FastFacts3_2020.pdf',
    sourcePublishedAt: '2020-03-09',
    notes:
      'The F-35I Adir is the Israeli F-35A, so the published USAF-profile radius of 1,093 km is used. Israeli-specific systems are not public.',
    gameMapping:
      'Range 31 hexes with the same stealth value as the US aircraft; the extra reach stands for basing geometry, not a different airframe.',
  }),
  ref({
    id: 'ref-weapon-merkava',
    subjectId: 'merkava',
    category: 'weapon',
    validAt: PREWAR,
    value: 1,
    unit: 'game_hex_range',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'A tank brigade’s relevant reach in this theatre is a ground frontage, not a range; no published figure is asserted.',
    gameMapping:
      'One hex: a ground holding unit that anchors a front and cannot strike across the theatre.',
  }),
  ref({
    id: 'ref-weapon-unit8200',
    subjectId: 'unit8200',
    category: 'weapon',
    validAt: PREWAR,
    value: 10,
    unit: 'game_hex_range',
    evidenceType: 'game-abstraction',
    confidence: 'low',
    notes:
      'Signals-intelligence reach is not publicly describable in kilometres; the unit’s effect is modelled rather than measured.',
    gameMapping:
      'Ten hexes of intelligence reach: reveals and degrades Iranian networks without inflicting damage.',
  }),
  ref({
    id: 'ref-weapon-houthi-drone',
    subjectId: 'houthi_drone',
    category: 'weapon',
    validAt: PREWAR,
    min: 1000,
    max: 2500,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/missile/shahed-131-and-136/',
    sourcePublishedAt: '2026-05-22',
    notes:
      'Houthi one-way attack drones are Iranian Shahed-family airframes, so the Shahed range band is used; local assembly and modification are reported but not measured.',
    gameMapping:
      'Range 22 hexes from Yemen covers the southern Gulf and the Red Sea approaches. The cell regenerates slowly: it is a harassment capability, not a decisive one.',
  }),
  ref({
    id: 'ref-weapon-houthi-missile',
    subjectId: 'houthi_missile',
    category: 'weapon',
    validAt: PREWAR,
    min: 1000,
    max: 1500,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'low',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/country/iran/',
    sourcePublishedAt: '2018-06-14',
    notes:
      'Burkan and Hatem variants are Iranian-derived with reported ranges in the low thousands of kilometres. Warhead and accuracy figures are claimed rather than verified.',
    gameMapping:
      'Range 34 hexes reaches Israel and the central Gulf. Low accuracy is expressed as a high interception chance rather than a separate CEP value.',
  }),
  ref({
    id: 'ref-weapon-houthi-asm',
    subjectId: 'houthi_asm',
    category: 'weapon',
    validAt: PREWAR,
    min: 120,
    max: 300,
    unit: 'km_range',
    evidenceType: 'reported-estimate',
    confidence: 'medium',
    sourceName: 'CSIS Missile Threat',
    sourceUrl: 'https://missilethreat.csis.org/country/iran/',
    sourcePublishedAt: '2018-06-14',
    notes:
      'Anti-ship variants derived from the Noor and Ghadir families, reported in the low hundreds of kilometres, which is enough to threaten the Bab al-Mandeb approaches.',
    gameMapping:
      'Range 8 hexes from the Yemeni coast; each battery in range adds disruption to Red Sea shipping rather than to Hormuz.',
  }),
);

// ---- later-war scenarios (Phase 5) -----------------------------------------
// Alternate starts are game abstractions: their dates and depletion are the
// scenario design, not a published order of battle.
for (const scenario of Object.values(LATE_SCENARIOS)) {
  const validAt = scenario.startDate ?? PREWAR;
  const tag = scenario.id;
  for (const cls of DELIVERY_CLASSES) {
    REFERENCES.push(
      ref({
        id: `ref-${tag}-arsenal-${cls}`,
        subjectId: `${tag}:arsenal:${cls}`,
        category: 'arsenal',
        validAt,
        value: scenario.iran.rounds[cls],
        unit: 'mated_rounds',
        evidenceType: 'game-abstraction',
        confidence: 'low',
        notes: `${scenario.name}: mated ${cls} rounds at the scenario start. The later-war inventory is a design assumption, not a published count.`,
        gameMapping: `${scenario.iran.rounds[cls]} mated ${cls} rounds available at turn 1; launchers, production and expenditure follow the normal rules.`,
      }),
    );
  }
  for (const pool of ['drone', 'ballistic'] as const) {
    REFERENCES.push(
      ref({
        id: `ref-${tag}-launchers-${pool}`,
        subjectId: `${tag}:launchers:${pool}`,
        category: 'launcher',
        validAt,
        value: scenario.iran.launchers[pool],
        unit: 'launch_platforms',
        evidenceType: 'game-abstraction',
        confidence: 'low',
        notes: `${scenario.name}: surviving ${pool} launch platforms after the preceding campaign period.`,
        gameMapping: `${scenario.iran.launchers[pool]} ${pool} launchers at start; the launcher budget is spent per turn.`,
      }),
    );
  }
  REFERENCES.push(
    ref({
      id: `ref-${tag}-nuclear-material`,
      subjectId: `${tag}:nuclear-material`,
      category: 'nuclear-material',
      validAt,
      value: scenario.iran.nuclearMaterial,
      unit: 'warhead_equivalents',
      evidenceType: 'game-abstraction',
      confidence: 'low',
      notes: 'No warhead-grade material is fielded in this scenario; capability is represented by the nuclear programme and escalation meters.',
      gameMapping: 'nuclearMaterial 0; intact enrichment sites and the escalation ladder carry the latency instead.',
    }),
    ref({
      id: `ref-${tag}-resources`,
      subjectId: `${tag}:resources`,
      category: 'scenario',
      validAt,
      value: scenario.iran.resources,
      unit: 'war_resources',
      evidenceType: 'game-abstraction',
      confidence: 'low',
      notes: `${scenario.name}: production resources, adjusted to reflect the war economy at this date.`,
      gameMapping: `${scenario.iran.resources} starting resources with the standard per-turn income.`,
    }),
    ref({
      id: `ref-${tag}-initial-hormuz`,
      subjectId: `${tag}:initial-hormuz`,
      category: 'scenario',
      validAt,
      value: scenario.initialHormuz,
      unit: 'percent_disruption',
      evidenceType: 'game-abstraction',
      confidence: 'low',
      notes: `${scenario.name}: opening disruption on the 0-100 index; later-war shipping conditions are a scenario choice.`,
      gameMapping: `Initial Hormuz disruption ${scenario.initialHormuz}. Values above 60 trigger logistics delays.`,
    }),
    ref({
      id: `ref-${tag}-hosts`,
      subjectId: `${tag}:hosts`,
      category: 'scenario',
      validAt,
      value: 8,
      unit: 'host_nations',
      evidenceType: 'game-abstraction',
      confidence: 'low',
      notes: `${scenario.name}: eight host states with elevated threat perception after weeks of war.`,
      gameMapping: `Host threat seeds are listed in lateScenarios.ts; access closes through the normal politics rules.`,
    }),
  );
}
