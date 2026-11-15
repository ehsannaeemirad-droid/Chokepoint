import { describe, expect, it } from 'vitest';
import { interceptionPk, strikePkFactor, weaponIdFor } from './pk';

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

  it('supplies interceptor probabilities from the weapon data', () => {
    expect(interceptionPk('thaad')).toBe(0.8);
    expect(interceptionPk('patriot')).toBe(0.65);
    expect(interceptionPk('iron_dome')).toBe(0.85);
    expect(interceptionPk('f35a')).toBeNull();
  });
});
