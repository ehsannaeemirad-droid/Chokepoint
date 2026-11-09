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
    sourceUrl: 'https://www.iaea.org/',
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
    sourceUrl: 'https://www.iaea.org/',
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
    sourceUrl: 'https://www.iaea.org/',
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
];
