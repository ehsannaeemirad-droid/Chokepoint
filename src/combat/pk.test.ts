import { describe, expect, it } from 'vitest';
import { interceptionPk, strikePkFactor, weaponIdFor } from './pk';

describe('weapon Pk bridge', () => {
  it('scales strike damage from the mapped weapon record', () => {
    // Shahed-136 has a 0.15 area model, so it keeps 66% of its nominal damage.
    expect(weaponIdFor('shahed136')).toBe('shahed-136');
    expect(strikePkFactor('shahed136')).toBeCloseTo(0.66, 2);
    // A precise guided weapon keeps full damage.
    expect(strikePkFactor('b2')).toBe(1);
    // Airframes without a briefed munition row use the stated precision-air model.
    expect(strikePkFactor('f35a')).toBeCloseTo(0.94, 2);
    expect(strikePkFactor('mq9')).toBeCloseTo(0.94, 2);
  });

  it('supplies interceptor probabilities from the weapon data', () => {
    expect(interceptionPk('thaad')).toBe(0.8);
    expect(interceptionPk('patriot')).toBe(0.65);
    expect(interceptionPk('iron_dome')).toBe(0.85);
    expect(interceptionPk('f35a')).toBeNull();
  });
});
