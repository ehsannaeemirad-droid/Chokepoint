/**
 * Completeness checks for the two data decisions that used to be implicit:
 * every weapon now carries a modelled Pk (never a claimed published one), and
 * every site states whether its personnel and aircraft numbers are known.
 */
import { describe, expect, it } from 'vitest';
import oob from './orderOfBattle.json';

describe('weapon Pk completeness', () => {
  it('fills both Pk fields with a stated basis', () => {
    for (const weapon of oob.weaponPerformance) {
      expect(typeof weapon.base_pk, weapon.id).toBe('number');
      expect(weapon.base_pk, weapon.id).toBeGreaterThanOrEqual(0);
      expect(weapon.base_pk, weapon.id).toBeLessThanOrEqual(1);
      expect(typeof weapon.interception_pk, weapon.id).toBe('number');
      expect(weapon.interception_pk, weapon.id).toBeGreaterThanOrEqual(0);
      expect(weapon.interception_pk, weapon.id).toBeLessThanOrEqual(1);
      expect(weapon.pk_basis?.length ?? 0, weapon.id).toBeGreaterThan(10);
    }
  });

  it('does not give a strike weapon an interception value', () => {
    for (const weapon of oob.weaponPerformance) {
      if (weapon.pk_basis.startsWith('interceptor')) continue;
      expect(weapon.interception_pk, weapon.id).toBe(0);
    }
  });
});

describe('site structured-data gaps', () => {
  it('marks every site whose personnel or aircraft count is unavailable', () => {
    for (const site of oob.sites) {
      const gaps = new Set(site.data_gaps ?? []);
      if (!site.personnel) expect(gaps.has('personnel'), site.id).toBe(true);
      if (!site.aircraft?.length) expect(gaps.has('aircraft'), site.id).toBe(true);
      if (site.personnel) expect(gaps.has('personnel'), site.id).toBe(false);
      if (site.aircraft?.length) expect(gaps.has('aircraft'), site.id).toBe(false);
    }
  });
});
