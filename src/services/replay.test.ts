import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from '../core/Game';
import { DATA_VERSION, REPLAY_VERSION, RULES_VERSION } from '../core/versions';
import { parseReplay, playReplay, serializeReplay } from './replay';

function store(): void {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
    },
    configurable: true,
    writable: true,
  });
}

function playedGame(): Game {
  const game = new Game();
  game.start('campaign', 'usa', 7788);
  game.queueOrder({ kind: 'hold', unitUid: game.snap.units.find((u) => u.faction === 'usa')!.uid });
  game.endTurn();
  game.queueOrder({ kind: 'hold', unitUid: game.snap.units.find((u) => u.faction === 'usa')!.uid });
  game.endTurn();
  return game;
}

describe('replay format', () => {
  beforeEach(store);

  it('round-trips a campaign and reproduces every turn', () => {
    const game = playedGame();
    const text = serializeReplay(game.snap);
    const parsed = parseReplay(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.replay.version).toBe(REPLAY_VERSION);
    expect(parsed.replay.turns).toHaveLength(2);
    expect(parsed.replay.turns[0]!.summary).toBeTruthy();

    const playback = playReplay(parsed.replay);
    expect(playback.ok).toBe(true);
    expect(playback.turns).toHaveLength(2);
    expect(playback.turns.every((t) => t.matches)).toBe(true);
    expect(playback.status).toBe(game.snap.status);
    expect(playback.summary).toEqual(parsed.replay.turns[1]!.summary);
  });

  it('rejects a replay from another format version and says so', () => {
    const file = JSON.parse(serializeReplay(playedGame().snap));
    file.version = 4;
    const parsed = parseReplay(JSON.stringify(file));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issue.kind).toBe('unsupported-version');
      expect(parsed.issue.message).toContain('format 4');
    }
  });

  it('rejects rules, data and scenario mismatches explicitly', () => {
    const file = JSON.parse(serializeReplay(playedGame().snap));
    file.rulesVersion = '0.9.0';
    file.dataVersion = '0.8.0';
    file.scenarioVersion = 99;
    const parsed = parseReplay(JSON.stringify(file));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issue.kind).toBe('version-mismatch');
      expect(parsed.issue.message).toContain('rules 0.9.0');
      expect(parsed.issue.message).toContain('data 0.8.0');
      expect(parsed.issue.message).toContain('scenario 99');
    }
  });

  it('rejects unknown scenarios, bad JSON and impostor files', () => {
    const unknown = parseReplay(
      JSON.stringify({
        kind: 'chokepoint-replay',
        version: REPLAY_VERSION,
        scenarioId: 'no-such-scenario',
        faction: 'usa',
        seed: 1,
        turns: [],
        status: 'playing',
        rulesVersion: RULES_VERSION,
        dataVersion: DATA_VERSION,
        scenarioVersion: 1,
      }),
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.issue.kind).toBe('unknown-scenario');
    expect(parseReplay('{').ok).toBe(false);
    expect(parseReplay(JSON.stringify({ kind: 'save' })).ok).toBe(false);
  });

  it('reports a playback divergence instead of claiming success', () => {
    const file = JSON.parse(serializeReplay(playedGame().snap));
    file.turns[0].status = 'won';
    const parsed = parseReplay(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const playback = playReplay(parsed.replay);
    expect(playback.ok).toBe(false);
    expect(playback.issue?.kind).toBe('playback-mismatch');
    expect(playback.issue?.turn).toBe(1);
  });

  it('does not write the autosave while replaying', () => {
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => map.set(k, v),
        removeItem: (k: string) => map.delete(k),
      },
      configurable: true,
      writable: true,
    });
    const text = serializeReplay(playedGame().snap);
    map.clear();
    const parsed = parseReplay(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    playReplay(parsed.replay);
    expect(map.size).toBe(0);
  });
});
