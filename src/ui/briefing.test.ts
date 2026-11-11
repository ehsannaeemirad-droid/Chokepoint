import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../core/Game';
import type { PlayableFactionId } from '../core/types';
import {
  FACTION_BRIEFINGS,
  SCENARIO_BRIEFINGS,
  factionBriefing,
  scenarioBriefing,
  type Bi,
} from './briefing';

const FACTIONS: PlayableFactionId[] = ['usa', 'israel', 'iran'];

function full(bi: Bi): boolean {
  return bi.en.trim().length > 0 && bi.fa.trim().length > 0;
}

describe('faction briefings', () => {
  it('covers every playable faction', () => {
    expect(Object.keys(FACTION_BRIEFINGS).sort()).toEqual([...FACTIONS].sort());
    for (const faction of FACTIONS) {
      expect(factionBriefing(faction)).toBe(FACTION_BRIEFINGS[faction]);
    }
  });

  it.each(FACTIONS)('gives %s every briefing section in both languages', (faction) => {
    const briefing = factionBriefing(faction);
    expect(full(briefing.situation)).toBe(true);
    for (const section of [
      briefing.objectives,
      briefing.strengths,
      briefing.weaknesses,
      briefing.political,
      briefing.economic,
      briefing.capabilities,
      briefing.actions,
      briefing.threats,
      briefing.firstTurn,
    ]) {
      expect(section.length).toBeGreaterThan(0);
      for (const line of section) expect(full(line)).toBe(true);
    }
  });

  it('does not repeat the same copy across factions', () => {
    const situations = FACTIONS.map((f) => factionBriefing(f).situation.en);
    expect(new Set(situations).size).toBe(FACTIONS.length);
    const priorities = FACTIONS.map((f) => factionBriefing(f).firstTurn[0]!.en);
    expect(new Set(priorities).size).toBe(FACTIONS.length);
  });

  it('names real constraints rather than declaring one side superior', () => {
    for (const faction of FACTIONS) {
      const briefing = factionBriefing(faction);
      expect(briefing.weaknesses.length).toBeGreaterThanOrEqual(2);
      expect(briefing.political.length).toBeGreaterThanOrEqual(1);
      expect(briefing.economic.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('scenario briefings', () => {
  it('covers every scenario in the game data', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const briefing = scenarioBriefing(id);
      expect(full(briefing.title)).toBe(true);
      expect(full(briefing.era)).toBe(true);
      expect(full(briefing.situation)).toBe(true);
      expect(briefing.objectives.length).toBeGreaterThan(0);
      expect(briefing.ending.length).toBeGreaterThan(0);
      expect(briefing.firstTurn.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the campaign briefing for an unknown scenario', () => {
    expect(scenarioBriefing('missing')).toBe(SCENARIO_BRIEFINGS.campaign);
  });

  it('keeps the tutorial briefing short and the campaign briefing explicit', () => {
    expect(scenarioBriefing('tutorial').era.en).toContain('5 turns');
    expect(scenarioBriefing('campaign').situation.en).toContain('no automatic first strike');
  });
});
