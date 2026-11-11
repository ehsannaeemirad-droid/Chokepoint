/**
 * Compatibility stamps for scenarios, saves and replays.
 *
 * Bump RULES_VERSION when resolution/validation semantics change, DATA_VERSION
 * when historical or scenario data changes in a way that alters play, and
 * REPLAY_VERSION when the replay file shape changes. A replay is compatible
 * only when all four stamps match the current build.
 */
export const RULES_VERSION = '1.0.0';
export const DATA_VERSION = '1.0.0';
export const SCENARIO_VERSION = 1;
export const REPLAY_VERSION = 5;
