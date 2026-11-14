/**
 * One-shot data integration: adds the sourced site/endurance/host-access blocks
 * from the supplementary briefs to the existing JSON, additively.
 *
 * Every added row carries `confidence` and `source`. Ranges are stored as
 * [min, max] with `confidence: "estimate_range"`; anything the briefs do not
 * state is `null` with `data_gap` and listed in DATA_GAPS.md.
 *
 * Run once: node scripts/apply-data-brief.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const write = (p, value) => writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);

const SOURCES = {
  sites: 'Supplementary brief A (site and unit tables), module {n}; originally OSINT/analyst compilation cited in the brief',
  endurance: 'Supplementary brief B (endurance logic), module {n}; originally RUSI/CSIS/Finance Ministry estimates cited in the brief',
};

const src = (brief, module) => ({
  source: (brief === 'A' ? SOURCES.sites : SOURCES.endurance).replace('{n}', String(module)),
});

/* ------------------------------------------------------------ order of battle */
const oob = read('src/data/orderOfBattle.json');

oob.meta = {
  ...oob.meta,
  note: `${oob.meta.note} Site and unit rows added from the supplementary briefs carry per-row confidence and source.`,
  integratedAt: '2026-11-14',
  confidenceLabels: ['confirmed', 'single_source', 'belligerent_claim', 'estimate_range', 'data_gap'],
};

const site = (id, name, side, host, lat, lon, role, extra = {}) => ({
  id,
  name,
  side,
  host,
  lat,
  lon,
  role,
  node_id: extra.node_id ?? null,
  personnel: extra.personnel ?? null,
  air_defence: extra.air_defence ?? [],
  aircraft: extra.aircraft ?? [],
  confidence: extra.confidence ?? 'confirmed',
  ...src('A', extra.module ?? 1),
  ...(extra.note ? { note: extra.note } : {}),
});

oob.sites = [
  // --- US / coalition (brief A, module 1) -----------------------------------
  site('al_udeid', 'Al Udeid Air Base', 'usa', 'qatar', 25.117, 51.315, 'CENTCOM forward HQ; 379th AEW; ~100 aircraft', {
    node_id: 'al_udeid', personnel: 10000,
    air_defence: ['THAAD battery', 'Patriot', 'AN/FPS-132 "Desert Eye"'],
    note: 'Radar status per IRGC claim: destroyed.',
  }),
  site('al_dhafra', 'Al Dhafra Air Base', 'usa', 'uae', 24.248, 54.548, '380th AEW; F-22, F-15, MQ-9, AWACS, tankers', {
    node_id: 'al_dhafra', personnel: 4250,
    air_defence: ['THAAD battery', 'Patriot'],
    aircraft: ['F-22', 'F-15', 'MQ-9', 'E-3 AWACS', 'KC-135/KC-46'],
    confidence: 'single_source',
    note: 'THAAD radar struck per IRGC claim (damage unconfirmed).',
  }),
  site('nsa_bahrain', 'NSA Bahrain (Fifth Fleet)', 'usa', 'bahrain', 26.21, 50.61, 'US Fifth Fleet HQ; destroyers and cruisers', {
    node_id: 'nsa_bahrain', personnel: 8500,
    air_defence: ['Patriot'],
    confidence: 'single_source',
    note: 'SATCOM terminal struck per IRGC claim.',
  }),
  site('prince_sultan', 'Prince Sultan Air Base', 'usa', 'saudi', 24.0, 47.5, 'US transport and ISR hub', {
    node_id: 'prince_sultan', personnel: 2300,
    air_defence: ['Patriot PAC-3', 'THAAD battery'],
    note: 'Coordinates approximate (Al Kharj). Saudi Arabia holds 108 Patriot launchers.',
  }),
  site('muwaffaq_salti', 'Muwaffaq Salti Air Base', 'usa', 'jordan', 32.3, 36.8, '332nd Expeditionary Wing; largest US aircraft concentration in theatre', {
    node_id: 'muwaffaq_salti', personnel: null,
    air_defence: ['THAAD radar', 'Patriot'],
    aircraft: ['F-35A', 'F-15E', 'F-16', 'A-10'],
    confidence: 'single_source',
    note: '~60 aircraft; THAAD radar struck per IRGC claim.',
  }),
  site('camp_arifjan', 'Camp Arifjan', 'usa', 'kuwait', 28.9, 48.1, 'US Central Army forward HQ; logistics hub', {
    node_id: 'ali_al_salem', personnel: 13500,
    air_defence: ['Patriot batteries'],
    note: 'Base struck by Iran during the campaign.',
  }),
  site('ayn_al_asad', 'Ayn al-Asad Airbase', 'usa', 'iraq', 33.8, 42.4, 'Iraqi control since January 2026; limited US presence', {
    personnel: null, confidence: 'single_source',
  }),
  site('erbil', 'Erbil Air Base', 'usa', 'iraq', 36.2, 44.0, 'US training, ISR and logistics', { personnel: null }),
  site('incirlik', 'Incirlik Air Base', 'usa', 'turkey', 37.0, 35.4, 'NATO/US presence', { node_id: 'incirlik', personnel: null }),
  site('duqm', 'Port of Duqm', 'usa', 'oman', 19.6, 57.7, 'US logistics and air access under the 2019 agreement', {
    personnel: null,
  }),
  site('thumrait', 'Thumrait Air Base', 'usa', 'oman', null, null, 'Oman air access', {
    confidence: 'data_gap', note: 'Listed in the brief without coordinates.',
  }),
  site('masirah', 'Masirah Air Base', 'usa', 'oman', null, null, 'Oman air access', {
    confidence: 'data_gap', note: 'Listed in the brief without coordinates.',
  }),
  site('cvn72', 'USS Abraham Lincoln (CVN-72)', 'usa', 'gulf', null, null, 'Carrier strike group, Arabian Sea near Oman', {
    aircraft: ['CVW: 3-4 F/A-18E/F squadrons', 'F-35C squadron', 'EA-18G', 'E-2D', 'MH-60R/S'],
    confidence: 'single_source',
  }),
  site('cvn78', 'USS Gerald R. Ford (CVN-78)', 'usa', 'mediterranean', null, null, 'Carrier strike group, eastern Mediterranean / Red Sea', {
    confidence: 'single_source',
  }),

  // --- Israel (brief A, module 2) -------------------------------------------
  site('nevatim', 'Nevatim Air Base', 'israel', 'israel', 31.21, 35.01, 'Primary F-35I base', {
    node_id: 'nevatim',
    aircraft: ['116th Lions of the South (F-35I)', '117th First Jet (F-35I)', '140th Golden Eagle (F-35I)', '120th Desert Giants (tankers)'],
    note: 'Runway and fuel infrastructure damaged during the war.',
  }),
  site('ramat_david', 'Ramat David Air Base', 'israel', 'israel', 32.66, 35.18, 'Northern fighter base', {
    node_id: 'ramat_david',
    aircraft: ['109th (F-16C/D)', '110th (F-16C/D)', '117th (F-16C/D)', '101st First Fighter (F-16C/D)'],
  }),
  site('hatzerim', 'Hatzerim Air Base', 'israel', 'israel', 31.23, 34.66, 'F-15I strike base', {
    node_id: 'hatzerim',
    aircraft: ['107th (F-16I)', '69th Hammers (F-15I)'],
  }),
  site('hatzor', 'Hatzor Air Base', 'israel', 'israel', 31.76, 34.72, 'Central fighter base; David\'s Sling HQ', {
    node_id: 'hatzor', aircraft: ['101st (F-16C/D)', '105th (F-16C/D)'],
  }),
  site('ramon', 'Ramon Air Base', 'israel', 'israel', 30.78, 34.66, 'Southern F-16I base', {
    node_id: 'ramon', aircraft: ['119th', '201st', '253rd (F-16I)'],
    note: 'Runway damaged during the war.',
  }),
  site('uvda', 'Uvda Air Base', 'israel', 'israel', 29.94, 34.94, 'Aggressor and training', {
    node_id: 'uvda', aircraft: ['115th (F-16A/B)'], confidence: 'single_source',
  }),
  site('idf_naval_haifa', 'Haifa Naval Base', 'israel', 'israel', null, null, 'Israeli naval base', {
    confidence: 'data_gap', note: 'Named in the brief; coordinates not supplied.',
  }),
  site('idf_naval_eilat', 'Eilat Naval Base', 'israel', 'israel', null, null, 'Israeli naval base', {
    confidence: 'data_gap', note: 'Named in the brief; coordinates not supplied.',
  }),
  site('iron_dome_battery', 'Iron Dome battery (central Israel example)', 'israel', 'israel', 32.3355, 34.9503, 'Iron Dome battery; 7 of 11 identified, 12-14 active', {
    air_defence: ['Iron Dome / Tamir'], confidence: 'single_source',
  }),
  site('davids_sling_battery', 'David\'s Sling battery (example site)', 'israel', 'israel', 32.8915, 35.0820, 'David\'s Sling; 4 of 6 identified', {
    air_defence: ['David\'s Sling / Stunner'], confidence: 'single_source',
  }),
  site('arrow3_battery', 'Arrow-3 battery area', 'israel', 'israel', 32.4333, 35.0, 'Arrow-3; 4 of 6 identified', {
    air_defence: ['Arrow-2/3'], confidence: 'single_source',
  }),

  // --- Iran: missile bases (brief A, module 3) ------------------------------
  site('tabriz_north', 'Tabriz North missile base', 'iran', 'iran', 38.251, 46.117, 'MRBM base; Shahab-3 silos', { module: 3 }),
  site('tabriz_south', 'Tabriz South missile base', 'iran', 'iran', 38.08, 46.28, 'MRBM base', { module: 3 }),
  site('kermanshah', 'Kermanshah (Shahid Montazeri) missile base', 'iran', 'iran', 34.482, 47.187, 'MRBM base; bunkers', { module: 3 }),
  site('panj_pelleh', 'Panj Pelleh launch site', 'iran', 'iran', 34.358, 47.3, 'Launch site', { module: 3, confidence: 'single_source' }),
  site('kamijeh', 'Kamijeh launch site', 'iran', 'iran', 34.52, 47.355, 'Launch site', { module: 3, confidence: 'single_source' }),
  site('shiraz_north', 'Shiraz North missile base', 'iran', 'iran', 29.723, 52.558, 'Heavy MRBM base; southern launch hub', { module: 3 }),
  site('bandar_abbas_khorgu', 'Bandar Abbas / Khorgu missile base', 'iran', 'iran', 27.18, 56.27, 'Coastal missile base; naval strike', { module: 3 }),
  site('hajabad', 'Hajabad underground launch facility', 'iran', 'iran', null, null, 'Underground launch facility ~130 km north of Bandar Abbas', {
    module: 3, confidence: 'single_source', note: 'Approximate location only; coordinates not supplied.',
  }),
  site('khorramabad', 'Khorramabad underground missile base', 'iran', 'iran', 33.5, 48.3, 'Underground missile base', { module: 3, confidence: 'single_source' }),
  site('bakhtaran', 'Bakhtaran missile base', 'iran', 'iran', 34.3, 47.1, 'Missile base', { module: 3, confidence: 'single_source' }),
  site('semnan', 'Semnan Missile Complex', 'iran', 'iran', 35.5, 53.5, 'Production and test facility', { module: 3 }),
  site('khojir', 'Khojir missile production', 'iran', 'iran', 35.6, 51.5, 'Missile production; heavily damaged', { module: 3 }),
  site('parchin', 'Parchin / Shahid Boroujerdi', 'iran', 'iran', 35.5, 51.8, 'Missile production; underground tunnels; MOP target', { module: 3 }),
  site('shahroud', 'Shahroud missile production', 'iran', 'iran', 36.4, 55.0, 'Liquid-propellant missile production; heavily damaged', { module: 3, confidence: 'single_source' }),
  site('oghab44', 'Oghab 44 underground air base', 'iran', 'iran', null, null, 'Underground air base north of the Strait of Hormuz', {
    module: 3, confidence: 'single_source', note: 'Named, no coordinates supplied.',
  }),

  // --- Iran: airbases and naval bases ---------------------------------------
  site('bandar_abbas_ab', 'Bandar Abbas Air Base', 'iran', 'iran', 27.22, 56.37, 'IRGC/Artesh; drones and maritime strike', { module: 3, confidence: 'single_source' }),
  site('khatam_ab', 'Khatam Air Base', 'iran', 'iran', 30.9, 50.5, 'IRIAF fighter base', { module: 3, confidence: 'single_source' }),
  site('dezful_ab', 'Dezful / Vahdati Air Base', 'iran', 'iran', 32.43, 48.4, 'Fighter and attack base', { module: 3, confidence: 'single_source' }),
  site('shiraz_ab', 'Shiraz Air Base', 'iran', 'iran', 29.54, 52.59, 'Fighter base; UAV launch sites nearby', { module: 3, confidence: 'single_source' }),
  site('tabriz_ab', 'Tabriz Air Base', 'iran', 'iran', 38.13, 46.24, 'Fighter base; IRGC missile complexes nearby', { module: 3, confidence: 'single_source' }),
  site('tehran_mehrabad', 'Tehran (Mehrabad / Doshan Tappeh)', 'iran', 'iran', 35.69, 51.31, 'Command and transport', { module: 3, confidence: 'single_source' }),
  site('bandar_abbas_naval', 'Bandar Abbas naval base', 'iran', 'iran', 27.14, 56.21, 'IRGCN/IRIN HQ; fast-attack craft; underground FAC base nearby', { module: 3 }),
  site('chabahar', 'Chabahar naval base', 'iran', 'iran', 25.29, 60.64, 'IRIN/IRGCN; naval facilities struck', { module: 3 }),
  site('jask', 'Jask naval base', 'iran', 'iran', 25.64, 57.77, 'IRGCN coastal missiles', { module: 3, confidence: 'single_source' }),
  site('kharg', 'Kharg Island', 'iran', 'iran', 29.23, 50.32, 'Oil terminal; naval/IRGC', { module: 3 }),

  // --- Iran: air defence and radar topology (brief A, module 4) -------------
  site('s300_tehran', 'S-300PMU-2 (Tehran)', 'iran', 'iran', 35.7, 51.4, 'Long-range SAM; 30N6E2 fire-control radar', {
    module: 4, air_defence: ['S-300PMU-2'], confidence: 'single_source',
    note: 'Engagement ~200 km. After 30N6E2 losses TELs were mated to Bavar-373.',
  }),
  site('bavar_fordow', 'Bavar-373 (Fordow)', 'iran', 'iran', 34.88, 50.99, 'Indigenous long-range SAM; Meraj-4 AESA', {
    module: 4, air_defence: ['Bavar-373', 'Meraj-4'], confidence: 'single_source',
    note: 'Engagement ~200-300 km; Meraj-4 detection 320-450 km.',
  }),
  site('khordad15_isfahan', 'Khordad-15 (Isfahan)', 'iran', 'iran', 32.65, 51.67, 'Medium-range SAM; road-mobile', {
    module: 4, air_defence: ['Khordad-15'], confidence: 'single_source',
    note: 'Engagement ~120 km; anti-stealth detection ~85 km.',
  }),
  site('talash_layered', '3rd Khordad / Talash (layered site)', 'iran', 'iran', 33.5, 51.0, 'Medium-range SAM', {
    module: 4, air_defence: ['3rd Khordad', 'Talash'], confidence: 'single_source',
    note: 'Engagement ~105 km; Ofogh radar track ~200 km.',
  }),
  site('s200_isfahan', 'S-200 (Isfahan)', 'iran', 'iran', 32.6, 51.7, 'Legacy long-range SAM', {
    module: 4, air_defence: ['S-200'], confidence: 'single_source', note: 'Range ~250 km.',
  }),
  site('meraj4_network', 'Meraj-4 surveillance network', 'iran', 'iran', 34.0, 51.5, 'S-band AESA surveillance; detection 320-450 km', {
    module: 4, confidence: 'single_source', note: 'Deployed nationwide; count unknown.',
  }),
  site('kavosh_radar', 'Kavosh (Kasta 2E2) gap-filler', 'iran', 'iran', 35.0, 51.0, 'Legacy surveillance radar (~150 km)', {
    module: 4, confidence: 'single_source',
  }),
  site('ghadir_radar', 'Ghadir over-the-horizon radar', 'iran', 'iran', 29.0, 53.0, 'Strategic early warning (~1,100 km)', {
    module: 4, confidence: 'single_source',
  }),
  site('alim_radar', 'Alim passive mobile radar', 'iran', 'iran', null, null, 'Mobile air-defence cueing (~250-300 km)', {
    module: 4, confidence: 'data_gap', note: 'Mobile; no fixed coordinates supplied.',
  }),

  // --- Proxies (brief A, module 6) ------------------------------------------
  site('hezbollah', 'Hezbollah (southern Lebanon, Bekaa, Beirut)', 'hezbollah', 'lebanon', 33.4, 35.5, 'Rocket and ATGM force; ~1,000 precision-guided', {
    module: 6, confidence: 'single_source', note: '15,000-20,000 rockets remaining (11k-13k in competing estimates).',
  }),
  site('houthi', 'Houthi forces (Bab al-Mandeb, Sanaa, Hodeidah)', 'houthi', 'yemen', 15.35, 44.2, 'Missiles and drones; ~90% indigenous production', {
    module: 6, confidence: 'single_source',
  }),
  site('pmf_anbar', 'PMF (Anbar: Al-Qaim, Habbaniyah, Taqqudum)', 'pmf', 'iraq', 33.4, 41.9, 'Rocket, ATGM and drone harassment', {
    module: 6, confidence: 'single_source',
  }),
  site('pmf_jurf', 'PMF (Jurf al-Sakhar, Camp Ashraf, Mosul outskirts, Jisr Diyala)', 'pmf', 'iraq', 32.9, 44.3, 'Rocket and drone harassment', {
    module: 6, confidence: 'single_source',
  }),
  site('hamas', 'Hamas (Gaza)', 'hamas', 'gaza', 31.4, 34.4, 'Rocket force, largely paused', {
    module: 6, confidence: 'single_source',
  }),
];

write('src/data/orderOfBattle.json', oob);

/* ---------------------------------------------------------------- logistics */
const logistics = read('src/data/logistics.json');

logistics.endurance = {
  note: 'Endurance layer from supplementary brief B. Values are starting inventories and rates, not scenario current state. Ranges are [min, max].',
  source: 'Supplementary brief B (endurance logic), modules 1-9',
  confidenceLabels: ['confirmed', 'single_source', 'belligerent_claim', 'estimate_range', 'data_gap'],
  munitions_depletion: {
    thaad: { label: 'THAAD interceptors', starting_inventory: [534, 534], expended_pct: [50, 60], production_per_year_prewar: 96, production_per_year_surge: 400, years_to_replenish: [2, 4], unit_cost_usd: [12000000, 15000000], confidence: 'confirmed', source: 'Brief B module 1; CSIS inventory estimate Dec 2025; MDA framework plan' },
    patriot_pac3: { label: 'Patriot PAC-3 MSE', starting_inventory: [2200, 2200], expended_pct: [45, 55], production_per_year_prewar: 600, production_per_year_surge: 2000, years_to_replenish: [3, 5], unit_cost_usd: [4000000, 4000000], confidence: 'confirmed', source: 'Brief B module 1; US Army figures and 2026 framework agreement' },
    prsm: { label: 'PrSM', starting_inventory: [90, 90], expended_pct: [45, 78], production_per_year_prewar: 400, production_per_year_surge: 550, years_to_replenish: [4, 4], unit_cost_usd: null, confidence: 'confirmed', source: 'Brief B module 1; Army procurement data' },
    tlam: { label: 'Tomahawk TLAM', starting_inventory: [3100, 3100], expended_pct: [29, 33], production_per_year_prewar: 1000, production_per_year_surge: 1000, years_to_replenish: [4, 4], unit_cost_usd: null, confidence: 'confirmed', source: 'Brief B module 1; Raytheon commitment to >1,000/year' },
    jassm: { label: 'JASSM', starting_inventory: [4400, 4400], expended_pct: [25, 30], production_per_year_prewar: 1100, production_per_year_surge: 1100, years_to_replenish: [4, 4], unit_cost_usd: null, confidence: 'confirmed', source: 'Brief B module 1' },
    sm3_sm6: { label: 'SM-3 / SM-6', starting_inventory: null, expended_pct: [20, 25], production_per_year_prewar: null, production_per_year_surge: null, years_to_replenish: [4, 5], unit_cost_usd: null, confidence: 'data_gap', source: 'Brief B module 1; inventory classified' },
    note: 'RUSI: 11,294 munitions in 16 days for ~$26bn. 850 Tomahawks expended in the first month, roughly ten times annual procurement.',
  },
  interceptor_depletion: {
    arrow: { label: 'Arrow-2/3', starting_inventory: null, expended_pct: null, depletion_horizon: 'end of March 2026 (war start 28 Feb)', replenish_years: [2, 3], critical_threshold_pct: 25, unit_cost_usd: [1500000, 3000000], confidence: 'single_source', source: 'Brief B module 2; Israeli interceptions shifted to David\'s Sling to preserve Arrow' },
    thaad: { label: 'THAAD', starting_inventory: [534, 534], expended_pct: [50, 60], depletion_horizon: 'within one month at current rates', replenish_years: [2, 4], critical_threshold_pct: 50, confidence: 'confirmed', source: 'Brief B module 2' },
    tamir: { label: 'Iron Dome Tamir', starting_inventory: [1500, 1500], expended_pct: null, depletion_horizon: 'not reached: production outpaced expenditure', replenish_years: [1, 1], critical_threshold_pct: 15, unit_cost_usd: [50000, 50000], confidence: 'confirmed', source: 'Brief B module 2; Rafael 24/7 surge and Arkansas plant (~1,000/year)' },
    stunner: { label: "David's Sling Stunner", starting_inventory: [600, 600], expended_pct: null, depletion_horizon: null, replenish_years: null, critical_threshold_pct: 20, unit_cost_usd: [1000000, 2000000], confidence: 'single_source', source: 'Brief B module 2; inventory estimate only' },
    daily_threat_rate: { ballistic_per_day: 33, drones_per_day: 94, confidence: 'confirmed', source: 'Brief B module 2; 28 Feb 2026 onward' },
    mechanisms: { interceptors_per_engagement_base: 2, radar_damage_multiplier: 1.6, confidence: 'estimate_range', source: 'Brief B module 2 mechanism; multiplier is a game calibration, not a published figure' },
  },
  sortie_capacity: {
    israel: { base_sorties: [350, 400], war_sorties: [160, 180], war_reduction_pct: 55, f35_sorties_per_day: { prewar: 2.2, wartime: 1.3 }, homeland_defense_diversion: 0.7, pilot_fatigue_threshold: '12-hour shifts, up to 3 missions/day', pilot_replacement_years: 5, aircraft_lost: 7, aircraft_damaged: 12, confidence: 'confirmed', source: 'Brief B module 3; multiple analyst estimates' },
    usa: { base_sorties: null, war_sorties: null, war_reduction_pct: null, homeland_defense_diversion: 0, pilot_replacement_years: 5, tanker_sortie_cap: { value: null, note: 'tanker availability is the decisive constraint; exact ceiling not published' }, confidence: 'data_gap', source: 'Brief B modules 3-4; sortie ceilings unquantified' },
    iran: { base_sorties: 0, war_sorties: 0, operational_fighters: 'nearly zero', f14_operational: [1, 2], pilot_hours_per_year: 100, su35_delivered: 0, confidence: 'single_source', source: 'Brief B module 3; IRIAF effectively non-functional' },
  },
  carrier_endurance: {
    us_carriers_total: 11,
    committed_to_theatre: 4,
    deployment_endurance_months: 9,
    repair_time_months: [12, 18],
    repair_time_prewar_months: [7, 8],
    ships_late_war: { carriers: 2, destroyers: 12, total_ships: 20, personnel: 20000 },
    repair_hub: 'Diego Garcia (~2,500 miles); Bahrain logistics damaged at war start',
    tanker_fleet_below_100_from: '2026-03',
    confidence: 'confirmed',
    source: 'Brief B module 4; US Navy deployment reporting',
  },
  iran_production: {
    missile_production_per_month_postwar: [50, 100],
    missile_production_per_month_prewar: [200, 300],
    drone_production_per_month: [400, 500],
    drone_capacity_claim_per_month: 10000,
    drone_capacity_claim_confidence: 'belligerent_claim',
    stockpile_assembly_ceiling: [200, 500],
    solid_fuel_blockade_modifier: 0.5,
    decline_curve: { surge_turns: 4, surge_multiplier: 1.5, steady_state_multiplier: 0.6 },
    confidence: 'estimate_range',
    source: 'Brief B module 5; production rates conflict across Western estimates (50 vs 100-300 vs 3,000/month)',
  },
  proxy_supply: {
    hezbollah: { resupply_rate: 0, starting_inventory: [15000, 20000], low_estimate: 11000, syria_route: 'closed since Dec 2024', confidence: 'single_source', source: 'Brief B module 6; IDF assessment' },
    houthi: { resupply_rate: 'small positive', indigenous_share: 0.9, missile_inventory: [100, 200], drone_inventory_max: 1000, confidence: 'single_source', source: 'Brief B module 6; ~90% manufactured in Yemen' },
    pmf: { resupply_rate: 'low', attacks_feb_mar_2026: 65, confidence: 'single_source', source: 'Brief B module 6; attack count from reporting' },
    hamas: { starting_inventory: [10000, 10000], confidence: 'estimate_range', source: 'Brief A module 6' },
  },
  iran_economy: {
    prewar_oil_exports_bpd: 2000000,
    oil_revenue_loss_pct: 90,
    budget_deficit_usd: 20000000000,
    forex_reserve_months: 3,
    frozen_assets_usd: 100000000000,
    frozen_assets_confidence: 'single_source',
    offshore_oil_barrels: 135000000,
    cbi_claim: 'sufficient reserves through the end of the Trump term',
    cbi_claim_confidence: 'belligerent_claim',
    confidence: 'single_source',
    source: 'Brief B module 5; Capital Economics / WSJ estimates',
  },
  israel_mobilization: {
    reservists_mobilized: 450000,
    gdp_growth_forecast: { before: 5.2, after: 4.7 },
    war_cost_usd: [11500000000, 21700000000],
    budget_deficit_ceiling_pct: { before: 3.9, after: 5.1 },
    output_gap_pct: 9,
    confidence: 'confirmed',
    source: 'Brief B module 8; Israeli Finance Ministry and Bank of Israel estimates',
  },
  cyber: {
    active_groups_prewar: 130,
    active_groups_during_war: 17,
    effectiveness: 'low; temporary disruption only',
    allowed_effects: ['one_turn_sortie_delay', 'temporary_radar_detection_reduction'],
    forbidden_effects: ['unit_destruction', 'strategic_flip'],
    confidence: 'single_source',
    source: 'Brief B module 7; no strategic cyber results documented',
  },
};

write('src/data/logistics.json', logistics);

/* ---------------------------------------------------------------- scenarios */
const scenarios = read('src/data/scenarios.json');
const campaign = scenarios.campaign;

campaign.hostAccess = {
  note: 'Opening-phase access posture. Thresholds are the existing host threat values plus a closure margin; closure margin is a game abstraction.',
  source: 'Brief A module 1 and brief B module 4 (GCC refusal of territory and airspace)',
  confidence: 'estimate_range',
  hosts: {
    qatar: { access_status_start: 'restricted', threat_threshold_restrict: 22, threat_threshold_close: 42, closure_duration_turns: 4, confidence: 'single_source', source: 'Brief A module 1: Al Udeid hosted US forces and was struck; Qatar restricts offensive sorties' },
    uae: { access_status_start: 'restricted', threat_threshold_restrict: 15, threat_threshold_close: 35, closure_duration_turns: 4, confidence: 'single_source', source: 'Brief A module 1: Al Dhafra struck; UAE declined offensive basing' },
    kuwait: { access_status_start: 'restricted', threat_threshold_restrict: 30, threat_threshold_close: 48, closure_duration_turns: 3, confidence: 'single_source', source: 'Brief A module 1: Camp Arifjan struck' },
    bahrain: { access_status_start: 'restricted', threat_threshold_restrict: 18, threat_threshold_close: 38, closure_duration_turns: 4, confidence: 'single_source', source: 'Brief A module 1: NSA Bahrain SATCOM struck per IRGC claim' },
    saudi: { access_status_start: 'restricted', threat_threshold_restrict: 28, threat_threshold_close: 50, closure_duration_turns: 5, confidence: 'single_source', source: 'Brief A module 1: Prince Sultan access contingent on Saudi consent' },
    turkey: { access_status_start: 'denied', threat_threshold_restrict: 45, threat_threshold_close: 60, closure_duration_turns: 6, confidence: 'single_source', source: 'Brief A module 1: Incirlik access requires Turkish consent' },
    jordan: { access_status_start: 'full', threat_threshold_restrict: 20, threat_threshold_close: 40, closure_duration_turns: 3, confidence: 'single_source', source: 'Brief A module 1: Muwaffaq Salti hosted the largest US aircraft concentration' },
    egypt: { access_status_start: 'restricted', threat_threshold_restrict: 25, threat_threshold_close: 45, closure_duration_turns: 4, confidence: 'data_gap', source: 'No explicit access figure in the briefs; Suez closure condition only' },
  },
};

campaign.history = [
  { id: 'opening_strike', date: '2026-02-28', scripted: true, trigger_condition: null, branch_effect: 'War begins; pre-war posture ends and the interceptor clock starts', confidence: 'confirmed', source: 'Brief A module 1; brief B module 2 (war start 28 Feb)' },
  { id: 'khamenei_killed', date: '2026-02-28', scripted: true, trigger_condition: null, branch_effect: 'Leadership shock; regime cohesion penalty and succession uncertainty', confidence: 'single_source', source: 'Brief A operational chronology' },
  { id: 'true_promise_4', date: '2026-03-01', scripted: true, trigger_condition: null, branch_effect: 'First large Iranian ballistic wave; interceptor expenditure spike', confidence: 'single_source', source: 'Brief A module 5 (True Promise waves)' },
  { id: 'irgc_radar_strikes', date: '2026-03-03', scripted: true, trigger_condition: null, branch_effect: 'THAAD AN/TPY-2 and AN/FPS-132 claims; radar-damage multiplier rises', confidence: 'belligerent_claim', source: 'Brief A module 4: IRGC claims, partly corroborated by imagery' },
  { id: 'assembly_of_experts_strike', date: '2026-03-10', scripted: true, trigger_condition: null, branch_effect: 'Strike on Qom; legitimacy and succession pressure', confidence: 'single_source', source: 'Brief A operational chronology' },
  { id: 'launcher_attrition', date: null, scripted: false, trigger_condition: 'iran_operational_launchers < 120', branch_effect: 'Iranian salvo size halves; production bottleneck becomes binding', confidence: 'estimate_range', source: 'Brief A module 5: post-strike launchers 80-120' },
  { id: 'f15e_shootdown', date: '2026-04-03', scripted: true, trigger_condition: null, branch_effect: 'Coalition aircraft loss and CSAR; permanent pilot loss applies', confidence: 'single_source', source: 'Brief A operational chronology' },
  { id: 'islamabad_mou', date: '2026-06-17', scripted: true, trigger_condition: null, branch_effect: 'Diplomatic pause; Pakistan defensive-intervention trigger armed', confidence: 'single_source', source: 'Brief A diplomacy timeline' },
  { id: 'ceasefire_collapse', date: '2026-07-02', scripted: true, trigger_condition: null, branch_effect: 'Talks fail; escalation ladder unlock', confidence: 'single_source', source: 'Brief A diplomacy timeline' },
  { id: 'gulf_barrages', date: '2026-07-11', scripted: true, trigger_condition: null, branch_effect: 'Massed Gulf missile barrages; host access restricted further', confidence: 'single_source', source: 'Brief A operational chronology' },
  { id: 'bab_al_mandeb_blockade', date: '2026-07-20', scripted: true, trigger_condition: null, branch_effect: 'Red Sea disruption; escort demand rises', confidence: 'single_source', source: 'Brief A proxies section' },
  { id: 'hezbollah_drone', date: '2026-08-15', scripted: true, trigger_condition: null, branch_effect: 'Hezbollah activation pressure; northern front opens if armed', confidence: 'single_source', source: 'Brief A proxies section' },
  { id: 'saudi_pipeline_attack', date: '2026-09-14', scripted: true, trigger_condition: null, branch_effect: 'East-West pipeline attack; oil price spike and Hormuz pressure', confidence: 'single_source', source: 'Brief A energy section' },
];

campaign.interventions = {
  note: 'Third-party triggers from brief A; thresholds are game abstractions over documented conditions.',
  source: 'Brief A diplomacy and proxies sections',
  confidence: 'estimate_range',
  pakistan: { trigger: 'oil_price >= 130 and saudi_casualties >= 25', effect: 'defensive intervention on the Saudi axis; no strikes on Iran proper', confidence: 'single_source', source: 'Brief A: Islamabad MoU context' },
  egypt: { trigger: 'hormuz < 25 for 3 turns', effect: 'Suez closure; adds transit delay and oil price pressure', confidence: 'single_source', source: 'Brief A: Suez closure condition' },
  hezbollah: { trigger: 'israeli_leadership_strikes >= 2 or lebanese_casualties >= 100', effect: 'full activation; rocket depletion begins', confidence: 'single_source', source: 'Brief A module 6' },
  houthi: { trigger: 'turn >= 12 or iran_request', effect: 'Bab al-Mandeb blockade; escort demand persists', confidence: 'single_source', source: 'Brief A: July 2026 blockade' },
  pmf: { trigger: 'us_basing_use >= 4 or iraqi_casualties >= 50', effect: 'periodic harassment of US logistics and base integrity', confidence: 'single_source', source: 'Brief A module 6' },
};

write('src/data/scenarios.json', scenarios);

console.log('order of battle sites:', oob.sites.length);
console.log('endurance blocks:', Object.keys(logistics.endurance).length);
console.log('history events:', campaign.history.length, 'hosts:', Object.keys(campaign.hostAccess.hosts).length);
