/**
 * Pk bridge between the weapon-performance data and combat resolution.
 *
 * The values in `weaponPerformance` are model outputs with a stated `pk_basis`
 * (see docs/CALIBRATION_2026.md), not published hit probabilities. Combat uses
 * them in two narrow ways:
 *
 * - interceptor rows supply the per-engagement kill probability, falling back to
 *   the unit's own `intercept` when a system has no weapon record;
 * - strike rows scale the damage of the units they are mapped to, so a weapon
 *   with poor circular error does less damage than a precise one. Units without
 *   a weapon record keep their existing damage.
 */
import oob from '../data/orderOfBattle.json';

interface WeaponRow {
  id: string;
  base_pk: number | null;
  interception_pk: number | null;
  game_field?: { unit_type_id?: string | null };
}

const rows = (oob.weaponPerformance as unknown as WeaponRow[]).filter(
  (row) => row.game_field?.unit_type_id && row.base_pk !== null,
);

const byUnit = new Map<string, WeaponRow>();
for (const row of rows) byUnit.set(row.game_field!.unit_type_id!, row);

/** Interception probability recorded for a defensive unit, when present. */
export function interceptionPk(unitTypeId: string): number | null {
  const row = byUnit.get(unitTypeId);
  if (!row || row.interception_pk === null) return null;
  return row.interception_pk;
}

/**
 * Damage multiplier from the strike weapon's Pk. Pk 1 keeps full damage; Pk 0
 * leaves 60% (the floor represents collateral effect from a near miss). Units
 * without a weapon record return 1.
 */
export function strikePkFactor(unitTypeId: string): number {
  const row = byUnit.get(unitTypeId);
  if (!row || row.base_pk === null) return 1;
  return 0.6 + 0.4 * row.base_pk;
}

/** Weapon record id mapped to a unit, for tests and tooltips. */
export function weaponIdFor(unitTypeId: string): string | null {
  return byUnit.get(unitTypeId)?.id ?? null;
}
