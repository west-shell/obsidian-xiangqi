/**
 * 树布局算法 — 基于 Walker 算法（Buchheim 改进）
 *
 * 特点：
 *   - 主干（firstChild 链）直线排列
 *   - 偶数层分支往左，奇数层分支往右（根算第 0 层）
 *   - 用轮廓行走消除重叠
 *   - 实验分支（exp/real-size-layout）：布局直接使用节点的真实像素
 *     尺寸（sizeFn 提供宽高），x = 节点中心像素坐标，y = 节点中心
 *     像素坐标。这样后期把评论块 / 小棋盘 / 插入分支作为任意尺寸
 *     的树元素参与布局时，间距计算天然正确。
 *   - 置顶评论块（pincomment: 虚拟叶子）：每个被 pin 的节点挂一个
 *     参与布局的虚拟子节点，侧挂在子行里招法标签旁边（顶边与其对
 *     齐，块更高时向下延伸）；尺寸由渲染层按换行文本测量后经
 *     sizeFn 提供。
 */

import type { ChessNode, GhostLine, NodeMap } from "../../../types";

// ─── 尺寸契约 ───────────────────────

/** 一个树元素的真实渲染尺寸（px）。 */
export interface NodeSize {
  width: number;
  height: number;
}

/** 按节点取真实尺寸；宽高由渲染层测量（文本测量 / 固定图标宽）。 */
export type NodeSizeFn = (node: ChessNode) => NodeSize;

export interface LayoutOptions {
  /** 兄弟节点盒子之间的水平间隙（px，中心距之外的空隙）。 */
  gapX?: number;
  /** 父节点底边到子节点顶边的垂直间隙（px）。 */
  gapY?: number;
  /** 节点真实尺寸；缺省为 13×11 的紧凑节点。 */
  sizeFn?: NodeSizeFn;
  /**
   * 需要置顶评论块的节点 id 列表。每个节点挂一个 "pincomment:" 虚拟
   * 叶子参与布局（不写回真实树）；块的宽高由渲染层按换行后的文本
   * 测量，经 sizeFn 提供。
   */
  pinnedCommentIds?: string[];
}

/**
 * 置顶评论块虚拟节点的 id 前缀：`PINNED_COMMENT_PREFIX + 真实节点 id`。
 * 渲染层用它反查所属节点（评论内容、实测高度）。
 */
export const PINNED_COMMENT_PREFIX = "pincomment:";

const DEFAULT_NODE_SIZE: NodeSize = { width: 13, height: 11 };
const DEFAULT_GAP_X = 6;
const DEFAULT_GAP_Y = 4;

// ─── 内部节点 ───────────────────────

interface WNode {
  node: ChessNode;
  parent: WNode | null;
  children: WNode[];
  depth: number;

  // 真实尺寸（px）
  width: number;
  height: number;

  x: number;
  y: number;

  relX: number;
  prelim: number;
  shift: number;
  change: number;

  lExt: WNode;
  rExt: WNode;
  lExtRelX: number;
  rExtRelX: number;
  lThr: WNode | null;
  rThr: WNode | null;
}

interface LowEntry {
  lowY: number;
  index: number;
  next: LowEntry | null;
}

// 垂直方向的"一行"步长（px）与当前 gapY：nodeBottom 用它们估计轮廓
// 的纵向延伸。由 calculateTreeLayout 每次调用时设置。
let ROW_STEP = DEFAULT_GAP_Y + DEFAULT_NODE_SIZE.height;
let GAP_Y = DEFAULT_GAP_Y;

// ─── 构建内部树 ────────────────────

function buildWNode(
  node: ChessNode,
  parent: WNode | null,
  foldedNodes: Set<string>,
  ghostByParent: Map<string, ChessNode[]>,
  commentByParent: Map<string, ChessNode>,
  sizeFn: NodeSizeFn,
): WNode {
  const size = sizeFn(node);
  const wn: WNode = {
    node,
    parent,
    children: [],
    depth: parent === null ? 0 : parent.depth + 1,
    width: size.width,
    height: size.height,
    x: 0,
    y: 0,
    relX: 0,
    prelim: 0,
    shift: 0,
    change: 0,
    lExt: null!,
    rExt: null!,
    lExtRelX: 0,
    rExtRelX: 0,
    lThr: null,
    rThr: null,
  };
  wn.lExt = wn;
  wn.rExt = wn;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (i > 0 && foldedNodes.has(node.id)) continue;
    wn.children.push(
      buildWNode(
        child,
        wn,
        foldedNodes,
        ghostByParent,
        commentByParent,
        sizeFn,
      ),
    );
  }
  // Pinned comment block: a virtual leaf appended AFTER real children and
  // BEFORE the fold early-return, so a folded node keeps its pinned
  // comment visible (never mutates the real tree). It hangs in the
  // children row beside the move labels — top edge aligned with theirs,
  // extending downward when taller.
  const commentBlock = commentByParent.get(node.id);
  if (commentBlock) {
    wn.children.push(
      buildWNode(
        commentBlock,
        wn,
        foldedNodes,
        ghostByParent,
        commentByParent,
        sizeFn,
      ),
    );
  }
  // Ghost chains append AFTER real children (never mutate node.children):
  // they occupy the outer slot so real branch positions stay as stable as
  // the algorithm allows. Folding the attachment node hides them, same as
  // real branches.
  if (foldedNodes.has(node.id)) return wn;
  for (const head of ghostByParent.get(node.id) ?? []) {
    wn.children.push(
      buildWNode(head, wn, foldedNodes, ghostByParent, commentByParent, sizeFn),
    );
  }
  return wn;
}

// ─── 纵向延伸（真实尺寸，px） ────────

/** 轮廓的纵向底部估计：非叶节点延伸到子行中心（按最高子元素——侧
 *  挂评论块比招法标签高时正确下探），叶节点再多留一行；高叶子同
 *  样按实测高度下探，避免轮廓低估导致重叠。默认紧凑节点（h=11）
 *  下与旧值完全一致。 */
function nodeBottom(w: WNode): number {
  if (w.children.length === 0) {
    // 默认紧凑节点（h=11）保持原值 2*ROW_STEP，行为不变。
    return w.y + Math.max(2 * ROW_STEP, w.height / 2 + ROW_STEP);
  }
  let childHalf = 0;
  for (const c of w.children) childHalf = Math.max(childHalf, c.height / 2);
  return w.y + w.height / 2 + GAP_Y + childHalf;
}

// ─── 核心布局 ───────────────────────

function layoutChildren(
  w: WNode,
  y: number,
  spacingFn: (a: WNode, b: WNode) => number,
  gapY: number,
): void {
  w.y = y;

  // 偶数层：把 trunk(firstChild) 移到数组末尾 → 分支往左排
  if (w.depth % 2 === 0 && w.children.length > 1) {
    w.children.reverse();
  }

  const kids = w.children;
  let lastLows: LowEntry | null = null;

  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    // 子节点中心 y：父底边 + gapY + 子半高（真实尺寸，px）
    layoutChildren(
      kid,
      w.y + w.height / 2 + gapY + kid.height / 2,
      spacingFn,
      gapY,
    );

    const lowY = i === 0 ? nodeBottom(kid.lExt) : nodeBottom(kid.rExt);
    if (i !== 0) separate(w, i, lastLows!, spacingFn);
    lastLows = updateLows(lowY, i, lastLows);
  }

  shiftChange(w);
  positionRoot(w);
}

function separate(
  w: WNode,
  i: number,
  lows: LowEntry,
  spacingFn: (a: WNode, b: WNode) => number,
): void {
  const lSib = w.children[i - 1];
  const cur = w.children[i];

  let rContour: WNode | null = lSib;
  let rSumMods = lSib.relX;
  let lContour: WNode | null = cur;
  let lSumMods = cur.relX;
  let isFirst = true;

  while (rContour && lContour) {
    if (nodeBottom(rContour) > lows.lowY) lows = lows.next!;

    // 真实尺寸：中心距 = 左轮廓半宽 + 右轮廓半宽 + 间隙
    const dist =
      rSumMods +
      rContour.prelim -
      (lSumMods + lContour.prelim) +
      rContour.width / 2 +
      lContour.width / 2 +
      spacingFn(rContour, lContour);

    if (dist > 0 || (dist < 0 && isFirst)) {
      lSumMods += dist;
      moveSubtree(cur, dist);
      distributeExtra(w, i, lows.index, dist);
    }

    isFirst = false;

    const rBottom = nodeBottom(rContour);
    const lBottom = nodeBottom(lContour);

    if (rBottom <= lBottom) {
      rContour = nextRContour(rContour);
      if (rContour) rSumMods += rContour.relX;
    }
    if (rBottom >= lBottom) {
      lContour = nextLContour(lContour);
      if (lContour) lSumMods += lContour.relX;
    }
  }

  if (!rContour && lContour) setLThr(w, i, lContour, lSumMods);
  else if (rContour && !lContour) setRThr(w, i, rContour, rSumMods);
}

function moveSubtree(subtree: WNode, dist: number): void {
  subtree.relX += dist;
  subtree.lExtRelX += dist;
  subtree.rExtRelX += dist;
}

function distributeExtra(
  w: WNode,
  curI: number,
  leftI: number,
  dist: number,
): void {
  const n = curI - leftI;
  if (n > 1) {
    const delta = dist / n;
    w.children[leftI + 1].shift += delta;
    w.children[curI].shift -= delta;
    w.children[curI].change -= dist - delta;
  }
}

function shiftChange(w: WNode): void {
  const kids = w.children;
  let lastShiftSum = 0,
    lastChangeSum = 0;
  for (const c of kids) {
    const shiftSum = lastShiftSum + c.shift;
    const changeSum = lastChangeSum + shiftSum + c.change;
    c.relX += changeSum;
    lastShiftSum = shiftSum;
    lastChangeSum = changeSum;
  }
}

// 偶数层 → trunk 在右边（lastChild），对齐到 lastChild
// 奇数层 → trunk 在左边（firstChild），对齐到 firstChild
function positionRoot(w: WNode): void {
  if (w.children.length === 0) return;
  const isEven = w.depth % 2 === 0;
  const kAlign = isEven ? w.children[w.children.length - 1] : w.children[0];
  const kf = w.children[w.children.length - 1];

  w.prelim = kAlign.prelim + kAlign.relX;

  w.lExt = isEven ? w.children[0].lExt : kAlign.lExt;
  w.lExtRelX = isEven ? w.children[0].lExtRelX : kAlign.lExtRelX;
  w.rExt = kf.rExt;
  w.rExtRelX = kf.rExtRelX;
}

// ─── 轮廓行走 + 线程 ────────────────

function nextLContour(w: WNode): WNode | null {
  if (w.children.length > 0 && w.children[0] !== w.lThr) return w.children[0];
  return w.lThr;
}

function nextRContour(w: WNode): WNode | null {
  if (w.children.length > 0 && w.children[w.children.length - 1] !== w.rThr)
    return w.children[w.children.length - 1];
  return w.rThr;
}

function setLThr(w: WNode, i: number, lContour: WNode, lSumMods: number): void {
  const f = w.children[0];
  const lExt = f.lExt;
  const cur = w.children[i];
  lExt.lThr = lContour;
  const diff = lSumMods - lContour.relX - f.lExtRelX;
  lExt.relX += diff;
  lExt.prelim -= diff;
  f.lExt = cur.lExt;
  f.lExtRelX = cur.lExtRelX;
}

function setRThr(w: WNode, i: number, rContour: WNode, rSumMods: number): void {
  const cur = w.children[i];
  const rExt = cur.rExt;
  const lSib = w.children[i - 1];
  rExt.rThr = rContour;
  const diff = rSumMods - rContour.relX - cur.rExtRelX;
  rExt.relX += diff;
  rExt.prelim -= diff;
  cur.rExt = lSib.rExt;
  cur.rExtRelX = lSib.rExtRelX;
}

// ─── lows 链表 ─────────────────────

function updateLows(
  lowY: number,
  index: number,
  lastLows: LowEntry | null,
): LowEntry {
  while (lastLows !== null && lowY >= lastLows.lowY) lastLows = lastLows.next;
  return { lowY, index, next: lastLows };
}

// ─── resolveX ───────────────────────

function resolveX(w: WNode, prevSum?: number, parentX?: number): void {
  if (prevSum === undefined) {
    prevSum = -w.relX - w.prelim;
    parentX = 0;
  }
  const pX = parentX!;
  const sum = prevSum + w.relX;
  w.relX = sum + w.prelim - pX;
  w.prelim = 0;
  w.x = pX + w.relX;

  for (const kid of w.children) {
    resolveX(kid, sum, w.x);
  }
}

// ─── 主入口 ─────────────────────────

/**
 * 使用 Walker 算法计算棋谱树的布局（真实尺寸版，实验分支）。
 *
 * 输出：真实节点数组 + 幽灵节点数组 + 置顶评论块虚拟节点数组。每个
 * 节点的 x / y 直接就是像素坐标（节点中心），渲染层不再乘 spacing：
 *   - x：水平中心，兄弟间距 = 真实半宽之和 + gapX
 *   - y：垂直中心，子行 = 父底边 + gapY + 子半高
 * `options.sizeFn` 提供每个树元素的真实尺寸（px），评论块、小棋盘、
 * 插入分支等任意尺寸元素只需给出自己的尺寸即可参与布局。
 * `ghosts` 里的幽灵链附加到 attachId 节点的真实子节点之后参与布局，
 * 但绝不写回真实树（node.children 不变）。`options.pinnedCommentIds`
 * 里的节点各挂一个 "pincomment:" 虚拟叶子（同样不写回真实树）。
 */
export function calculateTreeLayout(
  nodeMap: NodeMap,
  foldedNodes: Set<string>,
  ghosts: GhostLine[] = [],
  options: LayoutOptions = {},
): {
  nodes: ChessNode[];
  ghostNodes: ChessNode[];
  pinnedCommentNodes: ChessNode[];
} {
  const root = nodeMap.get("node-root");
  if (!root) {
    return { nodes: [], ghostNodes: [], pinnedCommentNodes: [] };
  }

  const sizeFn = options.sizeFn ?? (() => DEFAULT_NODE_SIZE);
  const gapX = options.gapX ?? DEFAULT_GAP_X;
  const gapY = options.gapY ?? DEFAULT_GAP_Y;
  // nodeBottom 的纵向延伸估计基准：一行的高度（间隙 + 默认行高）。
  ROW_STEP = gapY + DEFAULT_NODE_SIZE.height;
  GAP_Y = gapY;

  // Ghost chain heads grouped by their real attachment node.
  const ghostByParent = new Map<string, ChessNode[]>();
  const ghostIdSet = new Set<string>();
  for (const line of ghosts) {
    if (!line.head) continue;
    let heads = ghostByParent.get(line.attachId);
    if (!heads) {
      heads = [];
      ghostByParent.set(line.attachId, heads);
    }
    heads.push(line.head);
    let g: ChessNode | null = line.head;
    while (g) {
      ghostIdSet.add(g.id);
      g = g.children[0] ?? null;
    }
  }

  // Pinned comment blocks: one virtual leaf per pinned, commented node.
  // Nodes without comments are skipped (deleting the comment unpins the
  // block visually; the pin set itself is pruned by the rendering layer).
  const commentByParent = new Map<string, ChessNode>();
  const commentIdSet = new Set<string>();
  for (const id of options.pinnedCommentIds ?? []) {
    const owner = nodeMap.get(id);
    if (!owner || (owner.comments ?? []).length === 0) continue;
    const block: ChessNode = {
      id: PINNED_COMMENT_PREFIX + id,
      fen: "",
      move: null,
      color: null,
      children: [],
    };
    commentByParent.set(id, block);
    commentIdSet.add(block.id);
  }

  // 1) 建树
  const wRoot = buildWNode(
    root,
    null,
    foldedNodes,
    ghostByParent,
    commentByParent,
    sizeFn,
  );

  // 2) 布局
  layoutChildren(wRoot, 0, () => gapX, gapY);

  // 3) 解析 x
  resolveX(wRoot);

  // 4) 把结果写回 ChessNode
  const nodes: ChessNode[] = [];
  const ghostNodes: ChessNode[] = [];
  const pinnedCommentNodes: ChessNode[] = [];
  function collect(wn: WNode): void {
    wn.node.x = Math.round(wn.x * 10) / 10;
    wn.node.y = Math.round(wn.y * 10) / 10;
    wn.node.depth = wn.depth;
    if (commentIdSet.has(wn.node.id)) pinnedCommentNodes.push(wn.node);
    else if (ghostIdSet.has(wn.node.id)) ghostNodes.push(wn.node);
    else nodes.push(wn.node);
    for (const child of wn.children) {
      collect(child);
    }
  }
  collect(wRoot);

  return { nodes, ghostNodes, pinnedCommentNodes };
}
