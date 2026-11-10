/**
 * Iran's domestic system (Phase 2 item 10, SPEC §24).
 *
 * Regime outcomes are not read off the Tehran map node. Six bounded dimensions
 * are driven by war cost, economic pressure, leadership strikes, military
 * losses and public dissatisfaction. Capital damage is a small input, never a
 * collapse switch: a devastated Tehran with cohesive institutions can hold,
 * and a largely intact capital with a broken economy can fracture.
 */
import type { GameSnapshot, IranDomestic, ResolveEvent } from '../core/types';
import { clamp, nodeState } from '../core/world';

const NUCLEAR_SITES = ['isfahan', 'natanz', 'fordow'];

export function defaultIranDomestic(): IranDomestic {
  return {
    stability: 70,
    eliteCohesion: 70,
    irgcCohesion: 70,
    publicDissatisfaction: 30,
    economicPressure: 25,
    militaryCredibility: 65,
    leadershipContinuity: 100,
    negotiationPosition: 40,
  };
}

export function ensureIranDomestic(snap: GameSnapshot): IranDomestic {
  if (!snap.iranDomestic) snap.iranDomestic = defaultIranDomestic();
  return snap.iranDomestic;
}

function drift(current: number, target: number, step: number): number {
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

function bestNuclearIntegrity(snap: GameSnapshot): number {
  return Math.max(...NUCLEAR_SITES.map((id) => nodeState(snap, id).integrity));
}

export function updateIranDomestic(snap: GameSnapshot, events: ResolveEvent[]): void {
  const d = ensureIranDomestic(snap);
  const warShare = clamp(snap.meters.iranWarCost / Math.max(1, snap.meters.iranWarCostThreshold), 0, 1.5);
  const tehranDamage = 1 - nodeState(snap, 'tehran').integrity / 100;
  const nuclearLoss = 1 - bestNuclearIntegrity(snap) / 100;

  const economyTarget = clamp(Math.round(22 + warShare * 34 + Math.max(0, snap.meters.oilPrice - 80) * 0.22), 0, 100);
  const dissatisfactionTarget = clamp(
    Math.round(d.economicPressure * 0.55 + warShare * 18 + snap.meters.populationImpacts * 2),
    0,
    100,
  );
  const credibilityTarget = clamp(
    Math.round(90 - warShare * 30 - nuclearLoss * 15 - Math.max(0, 3 - snap.iran.mines / 4) * 2),
    0,
    100,
  );
  const continuityTarget = clamp(100 - snap.meters.leadershipStrikes * 12, 0, 100);

  d.economicPressure = drift(d.economicPressure, economyTarget, 8);
  d.publicDissatisfaction = drift(d.publicDissatisfaction, dissatisfactionTarget, 6);
  d.militaryCredibility = drift(d.militaryCredibility, credibilityTarget, 7);
  d.leadershipContinuity = drift(d.leadershipContinuity, continuityTarget, 20);

  // Elite and IRGC cohesion react to different signals, so they can split.
  const eliteTarget = clamp(
    Math.round(85 - dissatisfactionTarget * 0.35 - warShare * 12 - (100 - d.leadershipContinuity) * 0.25),
    0,
    100,
  );
  const irgcTarget = clamp(
    Math.round(80 - dissatisfactionTarget * 0.2 - warShare * 10 - (100 - d.militaryCredibility) * 0.3),
    0,
    100,
  );
  d.eliteCohesion = drift(d.eliteCohesion, eliteTarget, 5);
  d.irgcCohesion = drift(d.irgcCohesion, irgcTarget, 5);

  // Stability is institutional plus material. Capital damage is deliberately a
  // minor term (max -8): the 2026 lesson is that damage alone does not collapse
  // the regime, and that cohesion matters more than rubble.
  const stabilityTarget = clamp(
    Math.round(
      78 -
        d.publicDissatisfaction * 0.28 -
        warShare * 18 -
        (100 - d.eliteCohesion) * 0.12 -
        (100 - d.irgcCohesion) * 0.1 -
        snap.meters.leadershipStrikes * 4 -
        tehranDamage * 8,
    ),
    0,
    100,
  );
  const before = d.stability;
  d.stability = drift(d.stability, stabilityTarget, 6);

  d.negotiationPosition = clamp(
    Math.round(warShare * 40 + snap.meters.hormuz * 0.25 + (100 - d.publicDissatisfaction) * 0.2),
    0,
    100,
  );

  if (before >= 40 && d.stability < 40) {
    events.push({
      text: `Iranian regime stability falls to ${d.stability}: elite cohesion ${d.eliteCohesion}, IRGC cohesion ${d.irgcCohesion}.`,
      tone: 'warn',
      faction: 'iran',
    });
  }
  if (d.eliteCohesion < 40 && d.irgcCohesion < 40) {
    events.push({
      text: 'Iranian elite and IRGC cohesion are both below 40: the regime faces an internal contest, not an automatic collapse.',
      tone: 'warn',
      faction: 'iran',
    });
  }
}
