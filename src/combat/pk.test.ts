import { describe, expect, it } from 'vitest';
import { gpsDeniedPk, interceptionPk, strikePkFactor, weaponIdFor } from './pk';

describe('weapon Pk bridge', () => {
  it('scales strike damage from the mapped weapon record', () => {
    // Shahed-136 has a 0.15 area model, so it keeps 66% of its nominal damage.
    expect(weaponIdFor('shahed136')).toBe('shahed-136');
    expect(strikePkFactor('shahed136')).toBeCloseTo(0.66, 2);
    // A precise guided weapon keeps full damage.
    expect(strikePkFactor('b2')).toBe(1);
    // Aircraft now have their own sourced munition records.
    expect(weaponIdFor('f35a')).toBe('jdam-gbu31');
    expect(weaponIdFor('f15e')).toBe('jdam-gbu31');
    expect(weaponIdFor('f35i')).toBe('jdam-gbu31');
    expect(weaponIdFor('f15i')).toBe('spice-2000');
    expect(weaponIdFor('b52')).toBe('jassm-er');
    expect(weaponIdFor('mq9')).toBe('hellfire-agm114');
    expect(strikePkFactor('f35a')).toBe(1);
    expect(strikePkFactor('mq9')).toBe(1);
  });

  it('falls back to INS-only accuracy when GPS is denied', () => {
    // 10 m point target: a 30 m INS-only JDAM is far weaker than its 5 m GPS CEP.
    expect(gpsDeniedPk('f35a')).toBeCloseTo(0.074, 2);
    expect(gpsDeniedPk('b52')).toBeCloseTo(0.336, 2);
    expect(strikePkFactor('f35a', true)).toBeCloseTo(0.63, 2);
    expect(strikePkFactor('b52', true)).toBeCloseTo(0.73, 2);
    // Laser and electro-optical weapons do not depend on GPS.
    expect(strikePkFactor('mq9', true)).toBe(1);
    expect(strikePkFactor('f15i', true)).toBe(1);
    expect(gpsDeniedPk('mq9')).toBeNull();
  });

  it('supplies interceptor probabilities from the weapon data', () => {
    expect(interceptionPk('thaad')).toBe(0.8);
    expect(interceptionPk('patriot')).toBe(0.65);
    expect(interceptionPk('iron_dome')).toBe(0.85);
    expect(interceptionPk('f35a')).toBeNull();
  });
});
