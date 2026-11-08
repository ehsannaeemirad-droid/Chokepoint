/**
 * Phase 3: the Qatar-mediated ceasefire talks.
 *
 * A negotiation state machine over the snapshot, fully deterministic:
 *
 *   none → offered → talks → (agreed: tiered armistice ends the campaign)
 *                ↘ collapsed (offer lapsed or the player walked away; Qatar
 *                  may offer again after `reofferCooldown` turns)
 *
 * Qatar offers when the war has visibly stalled or burned: Iran's war cost is
 * past a share of its threshold, Hormuz has been badly disrupted for turns,
 * or US political will is fading. A US/Israel player can `pursue` (talks
 * begin) or `walk` (collapse). While talks run, progress grows every turn and
 * is set back when the coalition keeps striking Iranian soil (measured as a
 * rise in the nuclear-escalation meter — a deterministic, already-tracked
 * signal). At full progress the armistice is signed and the campaign ends
 * with a tiered outcome:
 *   - Favorable armistice: Iran's war cost is past `favorableWarCostShare` of
 *     its threshold and the Gulf basing network still holds — coalition win.
 *   - Costly armistice: anything less — Iran claims the field, coalition loss.
 * The Iran player sees the mirror statuses of the same world state.
 */
import type { CeasefireTalks, GameSnapshot, ResolveEvent, TalksConfig } from '../core/types';
import { clamp, operationalGulfBases } from '../core/world';
import type { TheaterMap } from '../map/TheaterMap';

export const DEFAULT_TALKS_CFG: TalksConfig = {
  offerWarCostShare: 0.6,
  offerHormuzTurns: 4,
  offerWill: 25,
  lapseTurns: 3,
  reofferCooldown: 6,
  startProgress: 20,
  baseProgress: 6,
  warCostBonus: 4,
  warCostBonusShare: 0.8,
  escalationPenalty: 8,
  agreeProgress: 100,
  favorableWarCostShare: 0.8,
  favorableBases: 3,
};

export function talksCfg(snap: GameSnapshot): TalksConfig {
  return snap.talksCfg ?? DEFAULT_TALKS_CFG;
}

export function defaultCeasefireTalks(): CeasefireTalks {
  return { state: 'none', progress: 0, startedTurn: 0, lastEventTurn: -99, lastEscalation: 0 };
}

/** Whether Qatar would offer mediation this turn (thresholds from data). */
export function qatarOfferDue(snap: GameSnapshot): boolean {
  const cfg = talksCfg(snap);
  const m = snap.meters;
  const warCostDue = m.iranWarCost >= m.iranWarCostThreshold * cfg.offerWarCostShare;
  const hormuzDue = m.hormuzTurnsAbove50 >= cfg.offerHormuzTurns;
  const willDue = snap.resources.politicalWill <= cfg.offerWill;
  return warCostDue || hormuzDue || willDue;
}

function offerAllowed(snap: GameSnapshot): boolean {
  const talks = snap.ceasefire;
  const cfg = talksCfg(snap);
  if (!talks) return false;
  if (talks.state === 'talks') return false;
  return snap.turn - talks.lastEventTurn >= cfg.reofferCooldown;
}

/**
 * Talks phase, once per resolved turn after the domestic phase. Offers,
 * lapses, progresses and — at full progress — ends the campaign through the
 * tiered outcome that `checkOutcome` reads.
 */
export function updateTalks(snap: GameSnapshot, events: ResolveEvent[]): void {
  const talks = snap.ceasefire;
  if (!talks) return;
  const cfg = talksCfg(snap);

  if (talks.state === 'none' || talks.state === 'collapsed') {
    if (qatarOfferDue(snap) && offerAllowed(snap)) {
      talks.state = 'offered';
      talks.lastEventTurn = snap.turn;
      events.push({
        text: 'Qatar offers to mediate a ceasefire: Doha sees a window before the war burns out. Pursue the talks or walk away.',
        tone: 'info',
        faction: 'qatar',
      });
    }
    return;
  }

  if (talks.state === 'offered') {
    if (snap.turn - talks.lastEventTurn >= cfg.lapseTurns) {
      talks.state = 'collapsed';
      talks.lastEventTurn = snap.turn;
      events.push({
        text: 'The Qatari mediation offer lapsed unanswered; Doha will not raise it again for a while.',
        tone: 'warn',
        faction: 'qatar',
      });
    }
    return;
  }

  // state === 'talks'
  const escalationRise = snap.meters.nuclearEscalation > talks.lastEscalation;
  talks.lastEscalation = snap.meters.nuclearEscalation;
  let delta = cfg.baseProgress;
  if (snap.meters.iranWarCost >= snap.meters.iranWarCostThreshold * cfg.warCostBonusShare) {
    delta += cfg.warCostBonus;
  }
  if (escalationRise) {
    delta -= cfg.escalationPenalty;
    events.push({
      text: `Strikes on Iranian soil during the talks set the mediation back (−${cfg.escalationPenalty} progress).`,
      tone: 'warn',
      faction: 'qatar',
    });
  }
  talks.progress = clamp(talks.progress + delta, 0, cfg.agreeProgress);
  events.push({
    text: `Ceasefire talks in Doha progress: ${talks.progress}/${cfg.agreeProgress}.`,
    tone: 'info',
    faction: 'qatar',
  });
}

/** Validation for `{ kind: 'talks' }`. Coalition players only. */
export function validateTalksOrder(snap: GameSnapshot, stance: 'pursue' | 'walk'): string | null {
  const talks = snap.ceasefire;
  if (!talks) return 'No mediation track in this scenario';
  if (snap.faction === 'iran') return 'Tehran cannot answer Doha here — the offer is to the coalition';
  if (stance === 'pursue' && talks.state !== 'offered') return 'There is no standing offer to pursue';
  if (stance === 'walk' && talks.state !== 'offered' && talks.state !== 'talks') return 'Nothing to walk away from';
  return null;
}

/** Apply a talks decision. Called from `applyOrder`. */
export function applyTalksOrder(snap: GameSnapshot, stance: 'pursue' | 'walk', events: ResolveEvent[]): void {
  const talks = snap.ceasefire;
  if (!talks) return;
  if (stance === 'pursue') {
    const cfg = talksCfg(snap);
    talks.state = 'talks';
    talks.progress = cfg.startProgress;
    talks.startedTurn = snap.turn;
    talks.lastEscalation = snap.meters.nuclearEscalation;
    events.push({
      text: `Washington takes up the Qatari track: talks open in Doha at ${talks.progress}/${cfg.agreeProgress} progress.`,
      tone: 'info',
      faction: 'usa',
    });
    return;
  }
  talks.state = 'collapsed';
  talks.lastEventTurn = snap.turn;
  events.push({
    text: 'Washington walks away from the Qatari track; the war continues and Doha steps back.',
    tone: 'warn',
    faction: 'usa',
  });
}

export type ArmisticeTier = 'favorable' | 'costly';

/**
 * If the talks reached full progress, this returns the tiered armistice
 * outcome; otherwise `null`. Favorable requires Iran's war cost past the
 * configured share of its threshold AND the Gulf basing network intact.
 */
export function armisticeOutcome(snap: GameSnapshot, map: TheaterMap): { tier: ArmisticeTier; text: string } | null {
  const talks = snap.ceasefire;
  if (!talks || talks.state !== 'talks') return null;
  const cfg = talksCfg(snap);
  if (talks.progress < cfg.agreeProgress) return null;

  const favorable =
    snap.meters.iranWarCost >= snap.meters.iranWarCostThreshold * cfg.favorableWarCostShare &&
    operationalGulfBases(snap, map) >= cfg.favorableBases;
  if (favorable) {
    return {
      tier: 'favorable',
      text:
        'A favorable armistice is signed in Doha: Iran\u2019s war cost broke past its ceiling while the Gulf basing network held, and Tehran accepts coalition terms. The campaign ends at the table.',
    };
  }
  return {
    tier: 'costly',
    text:
      'A costly armistice is signed in Doha: exhausted, the coalition settles for terms short of its objectives while Iran\u2019s regime still stands. The campaign ends at the table.',
  };
}
