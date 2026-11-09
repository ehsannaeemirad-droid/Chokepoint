/**
 * Engine-level order authorisation (Phase 2 item 2).
 *
 * The engine, not the UI and not a unit's faction string, decides whether the
 * player may issue an order. `canPlayerOrder` is the single authority: it checks
 * that the actor belongs to the player, that the action fits the unit, and that
 * the target is eligible. Every order kind is classified in `SCOPE`, so a new
 * kind fails compilation until it has a permission rule.
 */
import type { GameSnapshot, Order } from './types';
import type { TheaterMap } from '../map/TheaterMap';
import { unitType } from './world';
import { cyberTargets } from '../combat/combat';

export type PermissionCode =
  | 'not-your-unit'
  | 'unknown-unit'
  | 'wrong-faction'
  | 'wrong-unit-category'
  | 'target-ineligible';

export type OrderPermission = { ok: true } | { ok: false; code: PermissionCode; reason: string };

/** Who may issue each order kind; adding a kind breaks this map's type. */
const SCOPE: Record<Order['kind'], 'unit' | 'iran' | 'usa' | 'player' | 'coalition'> = {
  move: 'unit',
  strike: 'unit',
  special: 'unit',
  cyber: 'unit',
  mine: 'unit',
  clear: 'unit',
  escort: 'unit',
  hold: 'unit',
  produce: 'iran',
  nuclear: 'iran',
  diplomacy: 'usa',
  reinforce: 'usa',
  airlift: 'usa',
  communicate: 'usa',
  'israel-initiative': 'player',
  talks: 'player',
  roe: 'coalition',
};

const COALITION = new Set(['usa', 'israel']);

const STRIKE_FORBIDDEN = new Set(['defense', 'production', 'cyber']);

export function canPlayerOrder(snap: GameSnapshot, map: TheaterMap, order: Order): OrderPermission {
  void map;
  const scope = SCOPE[order.kind];

  if (scope === 'iran' && snap.faction !== 'iran') {
    return { ok: false, code: 'wrong-faction', reason: 'Only Iran can issue that order' };
  }
  if (scope === 'usa' && snap.faction !== 'usa') {
    return { ok: false, code: 'wrong-faction', reason: 'Only the United States can issue that order' };
  }
  if (scope === 'coalition' && !COALITION.has(snap.faction)) {
    return { ok: false, code: 'wrong-faction', reason: 'Only the coalition sets rules of engagement' };
  }
  if (scope !== 'unit') return { ok: true };

  const unitOrder = order as Extract<Order, { unitUid: string }>;
  const unit = snap.units.find((u) => u.uid === unitOrder.unitUid);
  if (!unit) return { ok: false, code: 'unknown-unit', reason: 'Select one of your units' };
  if (unit.faction !== snap.faction) {
    return {
      ok: false,
      code: 'not-your-unit',
      reason: `${unit.name} is not under your command`,
    };
  }

  const category = unitType(unit.typeId).category;
  if (order.kind === 'cyber') {
    if (category !== 'cyber') {
      return { ok: false, code: 'wrong-unit-category', reason: 'That unit cannot run cyber operations' };
    }
    if (cyberTargets(snap).length === 0) {
      return {
        ok: false,
        code: 'target-ineligible',
        reason: 'No geolocated Iranian launcher to disable',
      };
    }
  }
  if (order.kind === 'mine' && unit.typeId !== 'mine_layer') {
    return { ok: false, code: 'wrong-unit-category', reason: 'Only a mine warfare group can lay mines' };
  }
  if ((order.kind === 'clear' || order.kind === 'escort') && category !== 'naval') {
    return { ok: false, code: 'wrong-unit-category', reason: 'Only a naval unit can do that' };
  }
  if (order.kind === 'special' && category !== 'specops') {
    return { ok: false, code: 'wrong-unit-category', reason: 'Not a special operations unit' };
  }
  if (order.kind === 'strike' && STRIKE_FORBIDDEN.has(category)) {
    return { ok: false, code: 'wrong-unit-category', reason: 'This unit cannot conduct strikes' };
  }
  return { ok: true };
}
