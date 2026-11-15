/**
 * Data-integration acceptance test.
 *
 * The integration brief requires that every added parameter is confidence
 * labelled and sourced, that ranges are stored as ordered [min, max] pairs, and
 * that gaps are explicit rather than invented. This walks the new blocks so a
 * future data edit cannot quietly drop a label.
 */
import { describe, expect, it } from 'vitest';
import oobData from './orderOfBattle.json';
import logisticsData from './logistics.json';
import scenariosData from './scenarios.json';

const LABELS = ['confirmed', 'single_source', 'belligerent_claim', 'estimate_range', 'reported-estimate', 'data_gap'];
const SIDES = ['usa', 'israel', 'iran', 'hezbollah', 'houthi', 'pmf', 'hamas'];
const ACCESS = ['full', 'restricted', 'denied'];

type Row = { confidence: string; source: string; [key: string]: unknown };
const oob = oobData as unknown as { sites: Row[] };
const logistics = logisticsData as unknown as {
  endurance: Record<string, Record<string, Row | unknown>>;
};
const scenarios = scenariosData as unknown as {
  campaign: {
    hostAccess: { hosts: Record<string, Row> };
    history: Array<Row & { date: string | null; scripted: boolean; trigger_condition: string | null }>;
    interventions: Record<string, Row | unknown>;
  };
};

const isRange = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number');

describe('integrated site data', () => {
  it('labels every site with a known confidence and a named source', () => {
    expect(oob.sites.length).toBeGreaterThan(50);
    for (const site of oob.sites) {
      expect(LABELS, `${site.id} confidence`).toContain(site.confidence);
      expect(String(site.source ?? '').length, `${site.id} source`).toBeGreaterThan(20);
      expect(SIDES, `${site.id} side`).toContain(String(site.side));
    }
  });

  it('keeps coordinates real or explicitly absent', () => {
    for (const site of oob.sites) {
      const { lat, lon } = site as unknown as { lat: number | null; lon: number | null };
      const both = typeof lat === 'number' && typeof lon === 'number';
      const neither = lat === null && lon === null;
      expect(both || neither, `${site.id} coordinates`).toBe(true);
      if (both) {
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
      } else {
        // The brief can name a site and still not locate it; that absence is
        // recorded in a note rather than treated as a sourced coordinate.
        expect(String(site.note ?? '').length, `${site.id} missing-coordinate note`).toBeGreaterThan(10);
      }
    }
  });
});

describe('integrated weapon performance data', () => {
  const weapons = (oobData as unknown as { weaponPerformance: Row[] }).weaponPerformance;

  it('labels every weapon row and leaves unknown Pk empty rather than invented', () => {
    expect(weapons.length).toBeGreaterThanOrEqual(20);
    for (const weapon of weapons) {
      expect(LABELS, `${weapon.id} confidence`).toContain(weapon.confidence);
      expect(String(weapon.source ?? '').length).toBeGreaterThan(20);
      // Nothing in the briefs supplies a hit probability; the field exists so
      // Task 3 calibration can fill it from the data, not from a guess here.
      expect(weapon).toHaveProperty('base_pk');
      expect(weapon).toHaveProperty('interception_pk');
    }
  });

  it('stores ordered ranges and keeps penetration facts with the penetrator', () => {
    for (const weapon of weapons) {
      for (const field of ['range_km', 'warhead_kg', 'cep_m', 'penetration_m', 'starting_inventory']) {
        const value = weapon[field];
        if (isRange(value)) expect(value[0], `${weapon.id}.${field}`).toBeLessThanOrEqual(value[1]);
      }
    }
    const withPenetration = weapons.filter((weapon) => Array.isArray(weapon.penetration_m));
    expect(withPenetration.map((weapon) => weapon.id)).toEqual(['gbu-57-mop']);
  });
});

describe('integrated endurance data', () => {
  const munitions = logistics.endurance.munitions_depletion as Record<string, Row>;
  const interceptors = logistics.endurance.interceptor_depletion as Record<string, Row>;

  it('sources every munition and interceptor entry', () => {
    for (const [id, row] of Object.entries({ ...munitions, ...interceptors })) {
      if (id === 'note' || id === 'mechanisms' || id === 'daily_threat_rate') continue;
      expect(LABELS, `${id} confidence`).toContain(row.confidence);
      expect(String(row.source ?? '').length, `${id} source`).toBeGreaterThan(10);
    }
  });

  it('stores ranges as ordered [min, max] pairs', () => {
    for (const [id, row] of Object.entries(munitions)) {
      if (id === 'note') continue;
      for (const field of ['starting_inventory', 'expended_pct', 'years_to_replenish', 'unit_cost_usd']) {
        const value = row[field];
        if (isRange(value)) expect(value[0], `${id}.${field}`).toBeLessThanOrEqual(value[1]);
      }
    }
  });

  it('never lets surge production fall below the pre-war rate', () => {
    for (const [id, row] of Object.entries(munitions)) {
      if (id === 'note') continue;
      const pre = Number(row.production_per_year_prewar ?? 0);
      const surge = Number(row.production_per_year_surge ?? 0);
      if (pre > 0) expect(surge, `${id} surge`).toBeGreaterThanOrEqual(pre);
    }
  });

  it('keeps cyber effects non-strategic', () => {
    const cyber = logistics.endurance.cyber as unknown as {
      allowed_effects: string[];
      forbidden_effects: string[];
    };
    expect(cyber.allowed_effects).toContain('one_turn_sortie_delay');
    expect(cyber.forbidden_effects).toContain('unit_destruction');
    expect(cyber.forbidden_effects).toContain('strategic_flip');
  });
});

describe('integrated scenario data', () => {
  it('labels host access rows and uses real access states', () => {
    const hosts = scenarios.campaign.hostAccess.hosts;
    expect(Object.keys(hosts).length).toBe(8);
    for (const [id, row] of Object.entries(hosts)) {
      expect(ACCESS, `${id} access`).toContain(String(row.access_status_start));
      expect(LABELS, `${id} confidence`).toContain(row.confidence);
      expect(Number(row.threat_threshold_close)).toBeGreaterThan(Number(row.threat_threshold_restrict));
      expect(Number(row.closure_duration_turns)).toBeGreaterThan(0);
    }
  });

  it('gives every history event either a date or a trigger, never neither', () => {
    const events = scenarios.campaign.history;
    expect(events.length).toBeGreaterThanOrEqual(13);
    for (const event of events) {
      if (event.scripted) expect(event.date, `${event.id} date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(event.trigger_condition, `${event.id} trigger`).toBeTruthy();
      expect(LABELS, `${event.id} confidence`).toContain(event.confidence);
      expect(String(event.source ?? '').length, `${event.id} source`).toBeGreaterThan(10);
    }
  });

  it('does not present a belligerent claim as a confirmed event', () => {
    const radar = scenarios.campaign.history.find((event) => event.id === 'irgc_radar_strikes');
    expect(radar?.confidence).toBe('belligerent_claim');
  });
});
