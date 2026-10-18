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
 * The child the rendered tree continues into below `node`: folding
 * collapses a node's extra children, so a folded node always follows
 * its first child regardless of the stored choice.
 */
export function renderedChild(
  node: ChessNode,
  pathChoices?: PathChoices,
  folded: Set<string> = new Set(),
): ChessNode | null {
  if (folded.size > 0 && folded.has(node.id)) {
    return node.children[0] ?? null;
  }
  return pathChild(node, pathChoices);
}

/**
 * The visible line tip the rendered continuation from `node` ends at
 * (following the per-fork choices and, at folded nodes, the first
 * child). `node` itself when its rendered continuation already ends.
 */
export function renderedTip(
  node: ChessNode,
  pathChoices?: PathChoices,
  folded: Set<string> = new Set(),
): ChessNode {
  let cur = node;
  let next = renderedChild(cur, pathChoices, folded);
  while (next) {
    cur = next;
    next = renderedChild(cur, pathChoices, folded);
  }
  return cur;
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
 * Next fork strictly below `node` along the rendered path — the visible
 * continuation that follows the per-fork choices and, at folded nodes,
 * the first child (folding collapses the extra children, so the walk
 * never enters a hidden subtree). The current node itself is never
 * returned.
 */
export function findForkBelow(
  node: ChessNode,
  pathChoices?: PathChoices,
  folded: Set<string> = new Set(),
): ChessNode | null {
  let cur = renderedChild(node, pathChoices, folded);
  while (cur) {
    if (cur.children.length > 1) return cur;
    cur = renderedChild(cur, pathChoices, folded);
  }
  return null;
}

/**
 * First unfolded fork on the rendered path at or below `node` — the
 * target of branch switching: the current node when it is itself an
 * unfolded fork, otherwise the first unfolded fork further down the
 * rendered continuation. Folded forks are skipped (their alternative
 * branches are hidden, so there is nothing to switch). Returns the
 * fork plus the index of the branch the path currently takes there.
 */
export function firstForkOnPath(
  node: ChessNode,
  pathChoices?: PathChoices,
  folded: Set<string> = new Set(),
): { fork: ChessNode; branchIndex: number } | null {
  let cur: ChessNode | null = node;
  while (cur) {
    if (cur.children.length > 1 && !(folded.size > 0 && folded.has(cur.id))) {
      return { fork: cur, branchIndex: pathBranchIndex(cur, pathChoices) };
    }
    cur = renderedChild(cur, pathChoices, folded);
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

/**
 * All rendered variations below `node` (the node itself included), in
 * DFS child-index order: each entry is the list of child indices the
 * path takes at every node from `node` down to a line tip. Branches
 * hidden by folding are skipped (a folded node contributes only its
 * first child's subtree).
 */
export function enumerateVariations(
  node: ChessNode,
  folded: Set<string> = new Set(),
): number[][] {
  const variations: number[][] = [];
  const walk = (cur: ChessNode, prefix: number[]): void => {
    if (cur.children.length === 0) {
      variations.push(prefix);
      return;
    }
    const children =
      folded.size > 0 && folded.has(cur.id)
        ? cur.children.slice(0, 1)
        : cur.children;
    children.forEach((child, i) => walk(child, [...prefix, i]));
  };
  walk(node, []);
  return variations;
}

/**
 * All nodes at `depth` below `root`, in DFS pre-order (children in
 * index order), skipping branches hidden by folding: a folded node
 * keeps only its first child rendered, so the walk does not descend
 * into its extra children. Depth is counted in plies from the root
 * (root = 0).
 */
export function nodesAtDepth(
  root: ChessNode,
  depth: number,
  folded: Set<string>,
): ChessNode[] {
  const hits: ChessNode[] = [];
  const walk = (node: ChessNode, d: number): void => {
    if (d === depth) {
      hits.push(node);
      return;
    }
    const children =
      folded.size > 0 && folded.has(node.id)
        ? node.children.slice(0, 1)
        : node.children;
    for (const child of children) walk(child, d + 1);
  };
  walk(root, 0);
  return hits;
}

/**
 * Same-depth visible nodes ordered for Alt+Left/Right cycling: by the
 * last computed layout x when every node has one (visual left→right),
 * otherwise the DFS pre-order above.
 */
export function samePlyNodes(
  root: ChessNode,
  depth: number,
  folded: Set<string>,
): ChessNode[] {
  const nodes = nodesAtDepth(root, depth, folded);
  if (nodes.every((n) => typeof n.x === "number" && Number.isFinite(n.x))) {
    return [...nodes].sort((a, b) => a.x! - b.x!);
  }
  return nodes;
}

/**
 * The currently rendered variation below `node` (clamped child indices
 * following the per-fork choices, and the first child at folded nodes),
 * in the same shape as the entries of `enumerateVariations`.
 */
export function currentVariation(
  node: ChessNode,
  pathChoices?: PathChoices,
  folded: Set<string> = new Set(),
): number[] {
  const indices: number[] = [];
  let cur: ChessNode | null = node;
  while (cur && cur.children.length > 0) {
    const idx: number =
      folded.size > 0 && folded.has(cur.id)
        ? 0
        : pathBranchIndex(cur, pathChoices);
    indices.push(idx);
    cur = cur.children[idx];
  }
  return indices;
}

/**
 * All rendered line tips below `root` (visible leaves — nodes whose
 * rendered continuation ends), in DFS pre-order. Branches hidden by
 * folding are skipped (a folded node contributes only its first
 * child's subtree).
 */
export function visibleTips(
  root: ChessNode,
  folded: Set<string> = new Set(),
): ChessNode[] {
  const tips: ChessNode[] = [];
  const walk = (cur: ChessNode): void => {
    if (cur.children.length === 0) {
      tips.push(cur);
      return;
    }
    const children =
      folded.size > 0 && folded.has(cur.id)
        ? cur.children.slice(0, 1)
        : cur.children;
    for (const child of children) walk(child);
  };
  walk(root);
  return tips;
}

/**
 * Rendered line tips ordered for Alt+Shift+Left/Right cycling: by the
 * last computed layout x when every tip has one (visual left→right),
 * otherwise the DFS pre-order above.
 */
export function orderedTips(
  root: ChessNode,
  folded: Set<string> = new Set(),
): ChessNode[] {
  const tips = visibleTips(root, folded);
  if (tips.every((n) => typeof n.x === "number" && Number.isFinite(n.x))) {
    return [...tips].sort((a, b) => a.x! - b.x!);
  }
  return tips;
}

/**
 * The first steps of every visible branch below `root`, in DFS
 * pre-order: the main line's first move (root itself when the tree
 * has none) plus every extra (index ≥ 1) child of each unfolded
 * fork. Branches hidden by folding are skipped.
 */
export function visibleBranchStarts(
  root: ChessNode,
  folded: Set<string> = new Set(),
): ChessNode[] {
  const starts: ChessNode[] = [root.children[0] ?? root];
  const walk = (cur: ChessNode): void => {
    if (cur.children.length === 0) return;
    if (folded.size > 0 && folded.has(cur.id)) {
      walk(cur.children[0]);
      return;
    }
    for (let i = 1; i < cur.children.length; i++) {
      starts.push(cur.children[i]);
    }
    for (const child of cur.children) walk(child);
  };
  walk(root);
  return starts;
}

/**
 * Visible branch starts ordered for Ctrl+Shift+Left/Right cycling: by
 * the last computed layout x when every start has one (visual
 * left→right), otherwise the DFS pre-order above.
 */
export function orderedBranchStarts(
  root: ChessNode,
  folded: Set<string> = new Set(),
): ChessNode[] {
  const starts = visibleBranchStarts(root, folded);
  if (starts.every((n) => typeof n.x === "number" && Number.isFinite(n.x))) {
    return [...starts].sort((a, b) => a.x! - b.x!);
  }
  return starts;
}

/**
 * The nearest ancestor-or-self of `node` that is one of `starts`
 * (matched by id) — the first step of the branch the current line
 * belongs to. `null` when no ancestor is a visible branch start.
 */
export function nearestBranchStart(
  node: ChessNode,
  starts: ChessNode[],
  nodeMap: NodeMap,
): ChessNode | null {
  const ids = new Set(starts.map((s) => s.id));
  let cur: ChessNode | null = node;
  while (cur) {
    if (ids.has(cur.id)) return cur;
    cur = cur.parentID ? (nodeMap.get(cur.parentID) ?? null) : null;
  }
  return null;
}
