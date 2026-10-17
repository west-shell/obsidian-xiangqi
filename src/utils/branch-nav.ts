import type { ChessNode, NodeMap } from "../types";

/**
 * Path branch navigation helpers.
 *
 * The displayed path below the current node is a per-fork choice: at every
 * fork (a node with more than one child) the path follows
 * `pathChoices.get(fork.id) ?? 0` instead of blindly taking the first
 * child. Choices are view state only — they never mutate the tree or the
 * saved PGN.
 */

export type PathChoices = Map<string, number>;

/**
 * The child the displayed path takes at `node`: the stored choice when it
 * is still valid, otherwise the first child. `null` at line tips.
 */
export function pathChild(
  node: ChessNode,
  pathChoices?: PathChoices,
): ChessNode | null {
  const children = node.children;
  if (!children || children.length === 0) return null;
  const idx = pathChoices?.get(node.id);
  if (idx !== undefined && idx >= 0 && idx < children.length) {
    return children[idx];
  }
  return children[0];
}

/** Index of the branch the path currently takes at `fork` (clamped). */
export function pathBranchIndex(fork: ChessNode, pathChoices?: PathChoices) {
  const idx = pathChoices?.get(fork.id) ?? 0;
  return idx >= 0 && idx < fork.children.length ? idx : 0;
}

/**
 * Nearest fork strictly above `node` (an ancestor with more than one
 * child). The current node itself is never returned.
 */
export function findForkAbove(
  node: ChessNode,
  nodeMap: NodeMap,
): ChessNode | null {
  let cur = node.parentID ? (nodeMap.get(node.parentID) ?? null) : null;
  while (cur) {
    if (cur.children.length > 1) return cur;
    cur = cur.parentID ? (nodeMap.get(cur.parentID) ?? null) : null;
  }
  return null;
}

/**
 * Next fork strictly below `node` along the displayed path (following the
 * per-fork choices). The current node itself is never returned.
 */
export function findForkBelow(
  node: ChessNode,
  pathChoices?: PathChoices,
): ChessNode | null {
  let cur = pathChild(node, pathChoices);
  while (cur) {
    if (cur.children.length > 1) return cur;
    cur = pathChild(cur, pathChoices);
  }
  return null;
}

/**
 * First fork on the displayed path at or below `node` — the target of
 * branch switching: the current node when it is itself a fork, otherwise
 * the first fork further down the displayed continuation. Returns the fork
 * plus the index of the branch the path currently takes there.
 */
export function firstForkOnPath(
  node: ChessNode,
  pathChoices?: PathChoices,
): { fork: ChessNode; branchIndex: number } | null {
  let cur: ChessNode | null = node;
  while (cur) {
    if (cur.children.length > 1) {
      return { fork: cur, branchIndex: pathBranchIndex(cur, pathChoices) };
    }
    cur = pathChild(cur, pathChoices);
  }
  return null;
}

/**
 * Depth of `node` in plies from the root (root = 0), matching the tree
 * layout's layer numbering.
 */
export function nodeDepth(node: ChessNode, nodeMap: NodeMap): number {
  let depth = 0;
  let cur = node.parentID ? (nodeMap.get(node.parentID) ?? null) : null;
  while (cur) {
    depth++;
    cur = cur.parentID ? (nodeMap.get(cur.parentID) ?? null) : null;
  }
  return depth;
}

/**
 * Sibling-index step (+1/-1) matching a visual left/right move at `fork`.
 * The tree layout stacks extra branches to the RIGHT of the trunk on odd
 * layers and to its LEFT on even layers (root is layer 0), so which
 * index direction is "right" flips with the fork's depth parity.
 */
export function branchStepDirection(
  fork: ChessNode,
  nodeMap: NodeMap,
  right: boolean,
): 1 | -1 {
  const branchesRight = nodeDepth(fork, nodeMap) % 2 === 1;
  return right === branchesRight ? 1 : -1;
}
