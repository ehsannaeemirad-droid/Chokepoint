/**
 * Task 1a completion: structured personnel and aircraft detail where the brief
 * states it. Counts are only entered when the brief gives one; otherwise the
 * type is listed with `count: null` rather than an invented number.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/data/orderOfBattle.json';
const oob = JSON.parse(readFileSync(path, 'utf8'));
const byId = new Map(oob.sites.map((s) => [s.id, s]));

const PERSONNEL = {
  al_udeid: [9000, 11000],
  al_dhafra: [3500, 5000],
  nsa_bahrain: [8000, 9000],
  prince_sultan: [2300, 2300],
  camp_arifjan: [13500, 13500],
};

const AIRCRAFT = {
  al_udeid: [{ type: 'mixed coalition wing', count: 100 }],
  al_dhafra: [
    { type: 'F-22A', count: null },
    { type: 'F-15E', count: null },
    { type: 'MQ-9', count: null },
    { type: 'E-3 AWACS', count: null },
    { type: 'KC-135/KC-46 tankers', count: null },
  ],
  muwaffaq_salti: [
    { type: 'F-35A', count: null },
    { type: 'F-15E', count: null },
    { type: 'F-16', count: null },
    { type: 'A-10C', count: null },
  ],
};

const SQUADRONS = {
  nevatim: [
    { number: '116', name: 'Lions of the South', aircraft: 'F-35I' },
    { number: '117', name: 'First Jet', aircraft: 'F-35I' },
    { number: '140', name: 'Golden Eagle', aircraft: 'F-35I' },
    { number: '120', name: 'Desert Giants', aircraft: 'KC-707 tankers' },
  ],
  ramat_david: [
    { number: '109', name: null, aircraft: 'F-16C/D' },
    { number: '110', name: null, aircraft: 'F-16C/D' },
    { number: '101', name: 'First Fighter', aircraft: 'F-16C/D' },
  ],
  hatzerim: [
    { number: '107', name: null, aircraft: 'F-16I' },
    { number: '69', name: 'Hammers', aircraft: 'F-15I' },
  ],
  hatzor: [
    { number: '101', name: null, aircraft: 'F-16C/D' },
    { number: '105', name: null, aircraft: 'F-16C/D' },
  ],
  ramon: [
    { number: '119', name: null, aircraft: 'F-16I' },
    { number: '201', name: null, aircraft: 'F-16I' },
    { number: '253', name: null, aircraft: 'F-16I' },
  ],
  uvda: [{ number: '115', name: null, aircraft: 'F-16A/B' }],
};

let touched = 0;
for (const [id, range] of Object.entries(PERSONNEL)) {
  const site = byId.get(id);
  if (!site) continue;
  site.personnel_range = range;
  site.personnel = Math.round((range[0] + range[1]) / 2);
  touched++;
}
for (const [id, aircraft] of Object.entries(AIRCRAFT)) {
  const site = byId.get(id);
  if (!site) continue;
  site.aircraft = aircraft;
  touched++;
}
for (const [id, squadrons] of Object.entries(SQUADRONS)) {
  const site = byId.get(id);
  if (!site) continue;
  site.squadrons = squadrons;
  site.aircraft = squadrons.map((s) => ({ type: s.aircraft, count: null, squadron: s.number }));
  touched++;
}

writeFileSync(path, JSON.stringify(oob, null, 2) + '\n');
console.log(`updated ${touched} sites`);
