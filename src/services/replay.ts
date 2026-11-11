/**
 * Replay export, validation and deterministic playback (SPEC Phase 5).
 *
 * A replay is a versioned description of a campaign: scenario/faction/seed,
 * the rules/data/scenario stamps, every resolved turn with its orders, events
 * and state summary, and the final result. Playback starts a fresh Game and
 * re-queues the recorded orders turn by turn, then compares the reproduced
 * status and summary with the recording at every turn.
 */
import { Game, SCENARIOS } from '../core/Game';
import type { GameSnapshot, GameStatus, PlayableFactionId, ResolveEvent, TurnRecord, TurnSummary } from '../core/types';
import { DATA_VERSION, REPLAY_VERSION, RULES_VERSION, SCENARIO_VERSION } from '../core/versions';

export type ReplaySummary = TurnSummary;

export interface ReplayFile {
  kind: 'chokepoint-replay';
  version: number;
  createdAt: string;
  scenarioId: string;
  scenarioVersion: number;
  rulesVersion: string;
  dataVersion: string;
  faction: PlayableFactionId;
  seed: number;
  turns: TurnRecord[];
  finalTurn: number;
  status: GameStatus;
  outcome: string;
}

export type ReplayIssueKind =
  | 'invalid-file'
  | 'unsupported-version'
  | 'unknown-scenario'
  | 'version-mismatch'
  | 'playback-failed'
  | 'playback-mismatch';

export interface ReplayIssue {
  kind: ReplayIssueKind;
  message: string;
  turn?: number;
}

export type ParseReplayResult = { ok: true; replay: ReplayFile } | { ok: false; issue: ReplayIssue };

export interface PlaybackTurn {
  turn: number;
  orders: TurnRecord['orders'];
  events: ResolveEvent[];
  status: GameStatus;
  outcome: string;
  summary: ReplaySummary;
  matches: boolean;
}

export interface PlaybackResult {
  ok: boolean;
  turn: number;
  turns: PlaybackTurn[];
  status: GameStatus;
  outcome: string;
  summary: ReplaySummary;
  issue?: ReplayIssue;
}

export function snapshotSummary(snap: GameSnapshot): ReplaySummary {
  return {
    hormuz: Math.round(snap.meters.hormuz),
    oilPrice: Math.round(snap.meters.oilPrice),
    politicalWill: Math.round(snap.resources.politicalWill),
    iranWarCost: Math.round(snap.meters.iranWarCost),
    nuclearEscalation: Math.round(snap.meters.nuclearEscalation),
    stability: Math.round(snap.iranDomestic?.stability ?? 0),
  };
}

export function serializeReplay(snapshot: GameSnapshot): string {
  const replay: ReplayFile = {
    kind: 'chokepoint-replay',
    version: REPLAY_VERSION,
    createdAt: new Date().toISOString(),
    scenarioId: snapshot.scenarioId,
    scenarioVersion: snapshot.scenarioVersion ?? 0,
    rulesVersion: snapshot.rulesVersion ?? RULES_VERSION,
    dataVersion: snapshot.dataVersion ?? DATA_VERSION,
    faction: snapshot.faction,
    seed: snapshot.seed,
    turns: snapshot.history ?? [],
    finalTurn: snapshot.turn,
    status: snapshot.status,
    outcome: snapshot.outcome,
  };
  return JSON.stringify(replay, null, 2);
}

const STATUSES: GameStatus[] = ['playing', 'won', 'lost'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function issue(kind: ReplayIssueKind, message: string, turn?: number): { ok: false; issue: ReplayIssue } {
  return { ok: false, issue: turn === undefined ? { kind, message } : { kind, message, turn } };
}

export function parseReplay(text: string): ParseReplayResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return issue('invalid-file', 'The selected file is not valid JSON.');
  }
  if (!isObject(raw) || raw.kind !== 'chokepoint-replay') {
    return issue('invalid-file', 'The selected file is not a Chokepoint replay.');
  }
  if (raw.version !== REPLAY_VERSION) {
    return issue(
      'unsupported-version',
      `This replay uses format ${String(raw.version)}; this build reads format ${REPLAY_VERSION}. Older replays cannot be resumed safely.`,
    );
  }
  const scenarioId = typeof raw.scenarioId === 'string' ? raw.scenarioId : '';
  if (!SCENARIOS[scenarioId]) {
    return issue('unknown-scenario', `The replay names an unknown scenario: ${scenarioId || '(missing)'}.`);
  }
  const faction = raw.faction;
  if (faction !== 'usa' && faction !== 'israel' && faction !== 'iran') {
    return issue('invalid-file', 'The replay has no valid player faction.');
  }
  if (typeof raw.seed !== 'number' || !Number.isFinite(raw.seed)) {
    return issue('invalid-file', 'The replay has no valid seed.');
  }
  if (!Array.isArray(raw.turns)) {
    return issue('invalid-file', 'The replay has no turn log.');
  }
  if (!STATUSES.includes(raw.status as GameStatus)) {
    return issue('invalid-file', 'The replay has no valid final status.');
  }

  const mismatches: string[] = [];
  if (raw.rulesVersion !== RULES_VERSION) mismatches.push(`rules ${String(raw.rulesVersion)} ≠ ${RULES_VERSION}`);
  if (raw.dataVersion !== DATA_VERSION) mismatches.push(`data ${String(raw.dataVersion)} ≠ ${DATA_VERSION}`);
  const scenarioVersion = SCENARIOS[scenarioId]!.version ?? SCENARIO_VERSION;
  if (raw.scenarioVersion !== scenarioVersion) {
    mismatches.push(`scenario ${String(raw.scenarioVersion)} ≠ ${scenarioVersion}`);
  }
  if (mismatches.length > 0) {
    return issue('version-mismatch', `Incompatible versions: ${mismatches.join('; ')}.`);
  }

  return {
    ok: true,
    replay: {
      kind: 'chokepoint-replay',
      version: REPLAY_VERSION,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      scenarioId,
      scenarioVersion,
      rulesVersion: RULES_VERSION,
      dataVersion: DATA_VERSION,
      faction,
      seed: raw.seed,
      turns: raw.turns as TurnRecord[],
      finalTurn: typeof raw.finalTurn === 'number' ? raw.finalTurn : raw.turns.length + 1,
      status: raw.status as GameStatus,
      outcome: typeof raw.outcome === 'string' ? raw.outcome : '',
    },
  };
}

function sameSummary(a: ReplaySummary, b: ReplaySummary): boolean {
  return (Object.keys(a) as Array<keyof ReplaySummary>).every((key) => a[key] === b[key]);
}

export function playReplay(replay: ReplayFile): PlaybackResult {
  const game = new Game();
  game.persist = false;
  game.start(replay.scenarioId, replay.faction, replay.seed);
  const turns: PlaybackTurn[] = [];

  for (const recorded of replay.turns) {
    game.clearOrders();
    for (const order of recorded.orders ?? []) {
      const queued = game.queueOrder(order);
      if (!queued.ok) {
        return {
          ok: false,
          turn: recorded.turn,
          turns,
          status: game.snap.status,
          outcome: game.snap.outcome,
          summary: snapshotSummary(game.snap),
          issue: {
            kind: 'playback-failed',
            message: `Turn ${recorded.turn}: the engine rejected a recorded ${order.kind} order (${queued.reason ?? queued.code ?? 'unknown'}).`,
            turn: recorded.turn,
          },
        };
      }
    }
    const result = game.endTurn();
    const status = game.snap.status;
    const outcome = game.snap.outcome;
    const summary = snapshotSummary(game.snap);
    const matches =
      status === recorded.status && (!recorded.summary || sameSummary(summary, recorded.summary));
    turns.push({
      turn: recorded.turn,
      orders: recorded.orders ?? [],
      events: result.events,
      status,
      outcome,
      summary,
      matches,
    });
    if (!matches) {
      return {
        ok: false,
        turn: recorded.turn,
        turns,
        status,
        outcome,
        summary,
        issue: {
          kind: 'playback-mismatch',
          message: `Turn ${recorded.turn}: reproduced state does not match the recording.`,
          turn: recorded.turn,
        },
      };
    }
  }

  const finalMatches = game.snap.status === replay.status && game.snap.turn === replay.finalTurn;
  if (!finalMatches) {
    return {
      ok: false,
      turn: game.snap.turn,
      turns,
      status: game.snap.status,
      outcome: game.snap.outcome,
      summary: snapshotSummary(game.snap),
      issue: {
        kind: 'playback-mismatch',
        message: `Final state differs: recorded turn ${replay.finalTurn}/${replay.status}, reproduced turn ${game.snap.turn}/${game.snap.status}.`,
      },
    };
  }

  return {
    ok: true,
    turn: game.snap.turn,
    turns,
    status: game.snap.status,
    outcome: game.snap.outcome,
    summary: snapshotSummary(game.snap),
  };
}
