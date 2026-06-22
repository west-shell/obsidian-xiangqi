/**
 * 树布局算法 — 基于 Walker 算法（Buchheim 改进）
 *
 * 特点：
 *   - 主干（firstChild 链）直线排列
 *   - 偶数层分支往左，奇数层分支往右（根算第 0 层）
 *   - 用轮廓行走消除重叠
 */

import type { ChessNode, NodeMap } from '../../types';

// ─── 内部节点 ───────────────────────

interface WNode {
  node: ChessNode;
  parent: WNode | null;
  children: WNode[];
  depth: number;

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

// ─── 构建内部树 ────────────────────

function buildWNode(node: ChessNode, parent: WNode | null, foldedNodes: Set<string>): WNode {
  const wn: WNode = {
    node,
    parent,
    children: [],
    depth: parent === null ? 0 : parent.depth + 1,
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
    wn.children.push(buildWNode(child, wn, foldedNodes));
  }
  return wn;
}

// ─── 大小（固定大小，配合 spacingX） ─

const NODE_H = 1;

function nodeBottom(w: WNode): number {
  return w.y + NODE_H;
}

// ─── 核心布局 ───────────────────────

function layoutChildren(w: WNode, y: number, spacingFn: (a: WNode, b: WNode) => number): void {
  w.y = y;

  // 偶数层：把 trunk(firstChild) 移到数组末尾 → 分支往左排
  if (w.depth % 2 === 0 && w.children.length > 1) {
    const first = w.children.shift()!;
    w.children.push(first);
  }

  const kids = w.children;
  let lastLows: LowEntry | null = null;

  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    layoutChildren(kid, w.y + NODE_H, spacingFn);

    const lowY = i === 0 ? nodeBottom(kid.lExt) : nodeBottom(kid.rExt);
    if (i !== 0) separate(w, i, lastLows!, spacingFn);
    lastLows = updateLows(lowY, i, lastLows);
  }

  shiftChange(w);
  positionRoot(w);
}

function separate(w: WNode, i: number, lows: LowEntry, spacingFn: (a: WNode, b: WNode) => number): void {
  const lSib = w.children[i - 1];
  const cur = w.children[i];

  let rContour: WNode | null = lSib;
  let rSumMods = lSib.relX;
  let lContour: WNode | null = cur;
  let lSumMods = cur.relX;
  let isFirst = true;

  while (rContour && lContour) {
    if (nodeBottom(rContour) > lows.lowY) lows = lows.next!;

    const dist =
      rSumMods +
      rContour.prelim -
      (lSumMods + lContour.prelim) +
      0.5 +
      0.5 + // xSize/2 + xSize/2 = 1/2 + 1/2
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

function distributeExtra(w: WNode, curI: number, leftI: number, dist: number): void {
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

function updateLows(lowY: number, index: number, lastLows: LowEntry | null): LowEntry {
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
 * 使用 Walker 算法计算棋谱树的布局。
 *
 * 输出：ChessNode 数组，每个节点有 x（水平位置）、y（深度）。
 * 渲染时用 x * spacingX、y * spacingY 转为像素坐标。
 */
export function calculateTreeLayout(nodeMap: NodeMap, foldedNodes: Set<string>): ChessNode[] {
  const root = nodeMap.get('node-root');
  if (!root) return [];

  // 1) 建树
  const wRoot = buildWNode(root, null, foldedNodes);

  // 2) 布局
  layoutChildren(wRoot, 0, () => 0.3);

  // 3) 解析 x
  resolveX(wRoot);

  // 4) 把结果写回 ChessNode
  const result: ChessNode[] = [];
  function collect(wn: WNode): void {
    wn.node.x = Math.round(wn.x * 10) / 10;
    wn.node.y = wn.depth;
    result.push(wn.node);
    for (const child of wn.children) {
      collect(child);
    }
  }
  collect(wRoot);

  return result;
}
