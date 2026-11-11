/**
 * Strategic situation summary (SPEC Phase 4 item 3).
 *
 * A short, deterministic reading of the current position: whose turn it is,
 * which own objective is most urgent, the meters that drive it, and the
 * strongest enemy path. It reuses the objectives view so the summary and the
 * strip can never disagree, and it reads no state the player cannot already
 * inspect in the strategic panel.
 */
import type { GameSnapshot } from '../core/types';
import type { TheaterMap } from '../map/TheaterMap';
import { totalRounds } from '../core/inventory';
import { t, type StringKey } from '../i18n';
import { buildObjectives, type ObjectiveRow } from './objectives';

export interface SituationSummary {
  headline: string;
  focus: string;
  metrics: string[];
  threat: string;
  tone: ObjectiveRow['tone'];
}

function labelFor(key: string): string {
  try {
    return t(key as StringKey) || key;
  } catch {
    return key;
  }
}

function urgency(row: ObjectiveRow): number {
  return row.tone === 'bad' ? 0 : row.tone === 'warn' ? 1 : 2;
}

export function buildSituation(snap: GameSnapshot, map: TheaterMap): SituationSummary {
  const phase = snap.phase === 'prewar' ? t('situation.prewar') : t('situation.war');
  const headline = t('situation.turn', { turn: snap.turn, max: snap.maxTurns, phase });

  const view = buildObjectives(snap, map);
  const own = view.rows.filter((row) => !row.enemy);
  const focusRow = [...own].sort((a, b) => urgency(a) - urgency(b) || a.progress - b.progress)[0];

  const focus = focusRow
    ? `${labelFor(focusRow.labelKey)} — ${focusRow.movesIt}`
    : t('situation.noFocus');

  const metrics =
    snap.faction === 'iran'
      ? [
          t('situation.stability', { n: Math.round(snap.iranDomestic?.stability ?? 0) }),
          t('situation.resources', { n: Math.round(snap.iran.resources) }),
          t('situation.rounds', { n: Math.round(totalRounds(snap.iran)) }),
          t('situation.hormuz', { n: Math.round(snap.meters.hormuz) }),
        ]
      : [
          t('situation.hormuz', { n: Math.round(snap.meters.hormuz) }),
          t('situation.oil', { n: Math.round(snap.meters.oilPrice) }),
          t('situation.congress', { n: Math.round(snap.domestic?.congress ?? 0) }),
          t('situation.will', { n: Math.round(snap.resources.politicalWill) }),
        ];

  const threatRow = view.rows.find((row) => row.enemy);
  const threat = threatRow
    ? t('situation.threatLine', {
        label: labelFor(threatRow.labelKey),
        n: threatRow.progress,
      })
    : t('situation.noThreat');

  return { headline, focus, metrics, threat, tone: focusRow?.tone ?? 'info' };
}
