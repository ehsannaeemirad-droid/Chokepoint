/** Minimal deterministic behaviour-tree interpreter (JSON-defined trees). */
import type { FactionId, GameSnapshot, ResolveEvent } from '../core/types';
import type { TheaterMap } from '../map/TheaterMap';

export interface SelectorNode {
  type: 'selector';
  children: TreeNode[];
}
export interface SequenceNode {
  type: 'sequence';
  children: TreeNode[];
}
export interface ConditionNode {
  type: 'condition';
  check: string;
  host?: string;
  node?: string;
  value?: number;
  faction?: string;
}
export interface ActionNode {
  type: 'action';
  do: string;
  host?: string;
  faction?: string;
  node?: string;
  turns?: number;
  value?: number;
}
export type TreeNode = SelectorNode | SequenceNode | ConditionNode | ActionNode;

export interface AiContext {
  snap: GameSnapshot;
  map: TheaterMap;
  faction: FactionId;
  rng: () => number;
  events: ResolveEvent[];
}

export type ConditionCheck = (ctx: AiContext, node: ConditionNode) => boolean;
export type ActionDo = (ctx: AiContext, node: ActionNode) => boolean;

/**
 * Runs a tree. Selector succeeds on the first successful child; sequence fails on
 * the first failed child. Actions return false when they had nothing to do.
 */
export function runTree(
  node: TreeNode,
  ctx: AiContext,
  checks: Record<string, ConditionCheck>,
  actions: Record<string, ActionDo>,
): boolean {
  switch (node.type) {
    case 'selector': {
      for (const child of node.children) {
        if (runTree(child, ctx, checks, actions)) return true;
      }
      return false;
    }
    case 'sequence': {
      for (const child of node.children) {
        if (!runTree(child, ctx, checks, actions)) return false;
      }
      return true;
    }
    case 'condition': {
      const check = checks[node.check];
      if (!check) return false;
      return check(ctx, node);
    }
    case 'action': {
      const action = actions[node.do];
      if (!action) return false;
      return action(ctx, node);
    }
    default:
      return false;
  }
}
