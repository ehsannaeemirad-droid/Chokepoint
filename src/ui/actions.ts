/**
 * Which actions the unit action sheet offers for a unit.
 *
 * Kept out of the DOM layer so the sheet's contents can be asserted in tests
 * without a browser: `Ui.unitCard` renders exactly this list.
 */
import type { InteractionMode } from '../core/Game';
import type { UnitTypeDef } from '../core/types';
import type { StringKey } from '../i18n';

export type SheetActionId =
  | 'mode:move'
  | 'mode:strike'
  | 'mode:special'
  | 'mode:mine'
  | 'mode:clear'
  | 'cyber-order'
  | 'escort-order'
  | 'hold'
  | 'clear-selection';

/** Button labels, through the same dictionary the rest of the chrome uses. */
export const SHEET_ACTION_LABEL: Record<SheetActionId, StringKey> = {
  'mode:move': 'btn.move',
  'mode:strike': 'btn.attack',
  'mode:special': 'btn.sabotage',
  'mode:mine': 'btn.mine',
  'mode:clear': 'btn.clear',
  'cyber-order': 'btn.cyber',
  'escort-order': 'btn.escort',
  hold: 'btn.hold',
  'clear-selection': 'btn.deselect',
};

/** The mode an action id selects, if it is a targeting mode. */
export function modeOf(id: SheetActionId): InteractionMode | null {
  return id.startsWith('mode:') ? (id.slice('mode:'.length) as InteractionMode) : null;
}

export function sheetActions(def: UnitTypeDef): SheetActionId[] {
  const actions: SheetActionId[] = [];
  const canMove = def.mov > 0 && def.category !== 'cyber' && def.category !== 'production';
  const canStrike =
    def.atk > 0 && def.rng > 0 && def.category !== 'defense' && def.category !== 'production' && def.category !== 'cyber';

  if (canMove) actions.push('mode:move');
  if (canStrike) actions.push('mode:strike');
  if (def.category === 'specops') actions.push('mode:special');
  if (def.id === 'unit8200') actions.push('cyber-order');
  // Mine warfare and maritime work are engine-authorised order kinds that had
  // no button, so a mine group could not lay a field and a warship could not
  // clear or escort from the sheet.
  if (def.id === 'mine_layer') actions.push('mode:mine');
  if (def.category === 'naval') actions.push('mode:clear', 'escort-order');
  actions.push('hold', 'clear-selection');
  return actions;
}
