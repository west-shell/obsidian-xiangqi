<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import * as d3 from "d3";
  import {
    CLS_PREFIX,
    getNodeDisplay,
    getNodeFill,
    getNodeLabel,
    getNodeTextColor,
    getNodeWidth,
    LAYOUT_CHANGE_EVENT,
    NODE_CHAR_DY,
  } from "../../../chess";
  import type { EventBus } from "../../../core/event-bus";
  import { onLangChange, t } from "../../../i18n";
  import type {
    ChessNode,
    GhostLines,
    ISettings,
    NodeMap,
  } from "../../../types";
  import { GLYPH_BY_KEY } from "../../../utils/annotation-glyphs";
  import { badgeSvg, iconSvg, resultBadgeKeyOf } from "../../../utils/icon";
  import {
    evalBarColor,
    evalBarIntensity,
  } from "../../../utils/winningChances";
  import type HoverPreview from "./HoverPreview.svelte";
  import { calculateTreeLayout, PINNED_COMMENT_PREFIX } from "./layout";
  import { useSetIcon } from "./set-icon";

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
    settings?: ISettings;
    preview?: HoverPreview | null;
  }

  let {
    nodeMap,
    eventBus,
    currentNode,
    currentPath,
    settings,
    preview,
  }: Props = $props();

  let _uiVer = $state(0);
  const onUiVer = () => {
    _uiVer++;
  };
  let svgEl: SVGSVGElement | undefined = $state();
  let renderedNodes: ChessNode[] = $state([]);
  let renderedGhostNodes: ChessNode[] = $state([]);

  // ---- Engine PV ghost lines (live-only preview, see EngineModule) ----
  let ghostLines: GhostLines | null = $state(null);
  interface GhostInfo {
    rank: number;
    score: number;
    scoreType: "cp" | "mate";
    isHead: boolean;
  }
  let ghostInfoById = $derived.by(() => {
    const map = new SvelteMap<string, GhostInfo>();
    if (ghostLines) {
      for (const line of ghostLines.lines) {
        let g = line.head;
        let isHead = true;
        while (g) {
          map.set(g.id, {
            rank: line.rank,
            score: line.score,
            scoreType: line.scoreType,
            isHead,
          });
          isHead = false;
          g = g.children[0] ?? null;
        }
      }
    }
    return map;
  });
  // Parent node (ghost or real attachment) of every rendered ghost.
  let ghostParentById = $derived.by(() => {
    const map = new SvelteMap<string, ChessNode>();
    if (ghostLines) {
      for (const line of ghostLines.lines) {
        const attach = nodeMap.get(line.attachId);
        let prev: ChessNode | null = attach ?? null;
        let g = line.head;
        while (g) {
          if (prev) map.set(g.id, prev);
          prev = g;
          g = g.children[0] ?? null;
        }
      }
    }
    return map;
  });
  // Ring color for real nodes matched by a PV line, keyed by node id.
  let matchedColorById = $derived.by(() => {
    const map = new SvelteMap<string, string>();
    if (ghostLines) {
      for (const line of ghostLines.lines) {
        const color = ghostScoreColor(line.score, line.scoreType);
        for (const id of line.matchedIds) {
          if (!map.has(id)) map.set(id, color);
        }
      }
    }
    return map;
  });

  function ghostScoreColor(score: number, scoreType: string): string {
    if (score > 0 || (scoreType === "mate" && score >= 0)) {
      return "var(--eval-plus)";
    }
    if (score < 0 || (scoreType === "mate" && score < 0)) {
      return "var(--eval-minus)";
    }
    return "var(--text-muted)";
  }

  function ghostScoreText(score: number, scoreType: string): string {
    if (scoreType === "mate") {
      return `#${score >= 0 ? "+" : "-"}${Math.abs(score)}`;
    }
    return `${score > 0 ? "+" : ""}${(score / 100).toFixed(2)}`;
  }

  function onGhostLines(data?: GhostLines | null) {
    ghostLines = data ?? null;
    updateTreeLayout();
  }

  let sortedRenderedNodes = $derived.by(() => {
    if (!currentNode) return renderedNodes;
    const cur = currentNode.id;
    const rest: ChessNode[] = [];
    let curNode: ChessNode | undefined;
    for (const n of renderedNodes) {
      if (n.id === cur) curNode = n;
      else rest.push(n);
    }
    if (curNode) rest.push(curNode);
    return rest;
  });
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap
  let foldedNodes = $state(new SvelteSet<string>());

  // ---- Pinned comments (comment box pin button → block on the canvas) ----
  // Nodes whose comment is pinned as a card on the canvas. Session state:
  // pins vanish when the view closes, mirroring foldedNodes behavior.
  // (SvelteSet is reactive on its own — no $state wrap needed.)
  let pinnedCommentIds = new SvelteSet<string>();
  function togglePinComment(id: string): void {
    if (pinnedCommentIds.has(id)) pinnedCommentIds.delete(id);
    else pinnedCommentIds.add(id);
  }
  // Drop pins whose node left the tree (variation deleted / game switched).
  $effect(() => {
    // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions
    nodeMap.size;
    for (const id of [...pinnedCommentIds]) {
      if (!nodeMap.has(id)) pinnedCommentIds.delete(id);
    }
  });
  // The comment box's pin button toggles this state over the event bus
  // (sibling component).
  function onPinComment(id: unknown): void {
    if (typeof id === "string") togglePinComment(id);
  }
  // Comment edits mutate node.comments in place — nodeMap.size and pin
  // count don't change, so the layout effect never fires. Re-layout on
  // "modified" to refresh pinned comment blocks (text + measured size)
  // and whatever shifts the new size causes.
  function onModified(): void {
    updateTreeLayout();
  }
  // Broadcast pin state so the comment box button icon stays in sync.
  $effect(() => {
    eventBus.emit("pinned-comments-changed", new Set(pinnedCommentIds));
  });

  // ---- Pinned comment blocks (real-size layout participants) ----
  // Virtual "pincomment:" nodes produced by the layout, rendered as SVG
  // boxes + text in the same visual language as move labels: comment text
  // is word-wrapped (canvas-measured, same measurement as move widths),
  // the box sizes to the wrapped lines, and the layout reserves exactly
  // that box. Each block hangs in the children row beside the move
  // labels (top edge aligned with theirs, extending downward when
  // taller); its connector starts at the owner node like a regular
  // edge and ends at the box top.
  let pinnedCommentNodes: ChessNode[] = $state([]);
  const COMMENT_FONT_SIZE = "9px";
  const COMMENT_LINE_HEIGHT = 11;
  const COMMENT_PAD_X = 4;
  const COMMENT_PAD_Y = 3;
  // Max content width (px) before wrapping; the box width follows the
  // longest wrapped line.
  const COMMENT_MAX_CONTENT_WIDTH = 180;

  // Greedy wrap of one paragraph; breaks at the last space when possible,
  // otherwise hard-breaks by character (CJK has no spaces).
  function wrapCommentLine(para: string): string[] {
    if (para === "") return [""];
    const lines: string[] = [];
    let line = "";
    let lastSpace = -1;
    for (let i = 0; i < para.length; i++) {
      line += para[i];
      if (para[i] === " ") lastSpace = line.length - 1;
      if (
        line.length > 1 &&
        measureTextWidth(line, COMMENT_FONT_SIZE) > COMMENT_MAX_CONTENT_WIDTH
      ) {
        if (lastSpace > 0) {
          lines.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1);
        } else {
          lines.push(line.slice(0, -1));
          line = line.slice(-1);
        }
        lastSpace = -1;
      }
    }
    lines.push(line);
    return lines;
  }

  function commentLines(owner: ChessNode): string[] {
    const lines: string[] = [];
    for (const para of (owner.comments ?? []).join("\n").split("\n")) {
      lines.push(...wrapCommentLine(para));
    }
    return lines;
  }

  function commentBlockSize(lines: string[]): {
    width: number;
    height: number;
  } {
    let maxW = 0;
    for (const line of lines) {
      maxW = Math.max(maxW, measureTextWidth(line, COMMENT_FONT_SIZE));
    }
    return {
      width: Math.ceil(maxW) + COMMENT_PAD_X * 2,
      height: lines.length * COMMENT_LINE_HEIGHT + COMMENT_PAD_Y * 2,
    };
  }

  // Mirror the fold state to the host so keyboard actions (Alt+Left/Right
  // same-ply cycling) can skip folded branches.
  $effect(() => {
    eventBus.emit("folded-changed", new Set(foldedNodes));
  });

  // ---- D3 Zoom ----
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  const TRANSFORM_SAFE = $derived.by(() => {
    const t = zoomTransform;
    if (
      !t ||
      !Number.isFinite(t.x) ||
      !Number.isFinite(t.y) ||
      !Number.isFinite(t.k)
    ) {
      return "translate(0,0) scale(1)";
    }
    return `translate(${t.x},${t.y}) scale(${t.k})`;
  });

  const nodeHeight = 11;
  // 真实尺寸布局（exp/real-size-layout）：兄弟水平间隙、行间垂直间隙（px）。
  // 节点宽高由 sizeFn 实测（文本模式逐节点测量），布局输出直接是像素坐标。
  const NODE_GAP_X = 6;
  const ROW_GAP_Y = 4;
  // 边线肘部回退量（px），衔接父行到子行的折线拐点。
  const EDGE_ELBOW = 6;

  let layoutChangeHandler: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let needsInitialReset = $state(false);
  let destroyed = false;

  onDestroy(() => {
    destroyed = true;
    unsubLang();
    eventBus.off("updateUI", onUiVer);
    eventBus.off("tree-ghost-lines", onGhostLines);
    eventBus.off("tree-pin-comment", onPinComment);
    eventBus.off("modified", onModified);
    if (layoutChangeHandler) {
      activeDocument.body.removeEventListener(
        LAYOUT_CHANGE_EVENT,
        layoutChangeHandler,
      );
      layoutChangeHandler = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  });

  function updateTreeLayout() {
    const res = calculateTreeLayout(
      nodeMap,
      foldedNodes,
      ghostLines?.lines ?? [],
      {
        sizeFn: (node) => {
          // 置顶评论块：按换行文本测量尺寸（最长行宽 × 行数）。
          if (node.id.startsWith(PINNED_COMMENT_PREFIX)) {
            const owner = nodeMap.get(
              node.id.slice(PINNED_COMMENT_PREFIX.length),
            );
            if (owner) {
              // Wrap once and STASH the lines on the virtual node: the
              // block rendering reads them from the node (a fresh object
              // every layout run) instead of the owner. Comment edits
              // mutate the owner in place, so an owner-derived render
              // chain short-circuits on Svelte's === checks and would
              // keep showing the stale text.
              const lines = commentLines(owner);
              node.comments = lines;
              return commentBlockSize(lines);
            }
          }
          return {
            width: localGetNodeWidth(node),
            height: nodeHeight,
          };
        },
        gapX: NODE_GAP_X,
        gapY: ROW_GAP_Y,
        pinnedCommentIds: [...pinnedCommentIds],
      },
    );
    renderedNodes = res.nodes;
    renderedGhostNodes = res.ghostNodes;
    pinnedCommentNodes = res.pinnedCommentNodes;
  }

  function updateZoomExtent() {
    if (!svgEl || !zoomBehavior) return;
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    if (w > 0 && h > 0) {
      zoomBehavior.extent([
        [0, 0],
        [w, h],
      ]);
    }
  }

  function toggleFold(node: ChessNode) {
    const cur = foldedNodes.has(node.id);
    if (cur) {
      foldedNodes.delete(node.id);
    } else {
      foldedNodes.add(node.id);
    }
    foldedNodes = new SvelteSet(foldedNodes);
    updateTreeLayout();
  }

  export function resetView() {
    updateTreeLayout();
    if (!svgEl || !zoomBehavior) return;
    if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
    updateZoomExtent();
    const padding = 40;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of [...renderedNodes, ...renderedGhostNodes]) {
      if (n.x === undefined || n.y === undefined) continue;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    // 评论块可达 180px 宽，按半宽/半高计入边界，避免被裁。
    for (const cn of pinnedCommentNodes) {
      const owner = nodeMap.get(cn.id.slice(PINNED_COMMENT_PREFIX.length));
      if (!owner || cn.x === undefined || cn.y === undefined) continue;
      const size = commentBlockSize(cn.comments ?? commentLines(owner));
      minX = Math.min(minX, cn.x - size.width / 2);
      maxX = Math.max(maxX, cn.x + size.width / 2);
      minY = Math.min(minY, cn.y - size.height / 2);
      maxY = Math.max(maxY, cn.y + size.height / 2);
    }
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    )
      return;
    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;
    const { clientWidth, clientHeight } = svgEl;
    const scaleX = (clientWidth - padding * 2) / treeWidth;
    const scaleY = (clientHeight - padding * 2) / treeHeight;
    const k = Math.max(0.75, Math.min(scaleX, scaleY, 2));
    const tx = clientWidth / 2 - (minX + treeWidth / 2) * k;
    const ty = clientHeight / 2 - (minY + treeHeight / 2) * k;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function panToNodeIfNeeded(node: ChessNode) {
    if (!node || !svgEl || !zoomBehavior) return;
    if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
    if (node.x === undefined || node.y === undefined) return;
    updateZoomExtent();
    const { x: tx, y: ty, k: sc } = zoomTransform;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc))
      return;
    const { clientWidth, clientHeight } = svgEl;
    const padding = 50;
    let translateX = tx,
      translateY = ty,
      scale = sc;
    const nodeScreenX = node.x * scale + translateX;
    const nodeScreenY = node.y * scale + translateY;

    let dx = 0,
      dy = 0;
    if (nodeScreenX < padding) dx = padding - nodeScreenX;
    else if (nodeScreenX > clientWidth - padding)
      dx = clientWidth - padding - nodeScreenX;
    if (nodeScreenY < padding) dy = padding - nodeScreenY;
    else if (nodeScreenY > clientHeight - padding)
      dy = clientHeight - padding - nodeScreenY;

    if (dx || dy) {
      translateX += dx;
      translateY += dy;
    }
    const t = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function zoomAtCenter(factor: number) {
    if (!svgEl || !zoomBehavior) return;
    if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
    updateZoomExtent();
    const { x: tx, y: ty, k: sc } = zoomTransform;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc))
      return;
    const w = svgEl.clientWidth,
      h = svgEl.clientHeight;
    const cx = w / 2,
      cy = h / 2;
    let translateX = tx,
      translateY = ty,
      scale = sc;
    const prev = scale;
    const next = prev * factor;
    const worldX = (cx - translateX) / prev;
    const worldY = (cy - translateY) / prev;
    scale = next;
    translateX = cx - worldX * scale;
    translateY = cy - worldY * scale;
    const t = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    d3.select(svgEl).transition().duration(200).call(zoomBehavior.transform, t);
  }

  const ZOOM_STEP = 1.15;
  function zoomIn() {
    zoomAtCenter(ZOOM_STEP);
  }
  function zoomOut() {
    zoomAtCenter(1 / ZOOM_STEP);
  }

  let nodeMode = $state(0);
  const MODE_ICONS = ["club", "align-justify"];
  function cycleNodeMode() {
    nodeMode = (nodeMode + 1) % 2;
  }

  function toggleCurrentFold() {
    if (!currentNode || currentNode.children.length <= 1) return;
    toggleFold(currentNode);
  }

  let canFold = $derived((currentNode?.children?.length ?? 0) > 1);
  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);
  let zoomBTN = $derived([
    { title: t("tree.zoomIn", _lv), icon: "plus", event: zoomIn },
    { title: t("tree.zoomOut", _lv), icon: "minus", event: zoomOut },
    { title: t("tree.resetView", _lv), icon: "rotate-ccw", event: resetView },
  ]);
  let nodeModeTitle = $derived(t("tree.nodeMode", _lv));

  function nodeLabel(node: ChessNode): string {
    return getNodeLabel(node.move, nodeMode, settings?.notationType);
  }
  // node.result / isCheckmate are plain fields mutated outside Svelte
  // signals (tag editing rewrites node.result in place); keyed-each items
  // keep the same reference, so reading _uiVer here ties the badge to
  // `updateUI` bumps and makes it re-render after such mutations.
  function resultBadgeKey(node: ChessNode): string {
    void _uiVer;
    return resultBadgeKeyOf(node.result, node.isCheckmate);
  }
  function nodeFontSize(): string {
    if (nodeMode === 1) return "6px";
    return "9px";
  }
  let _measureCanvas: HTMLCanvasElement | undefined;
  function measureTextWidth(text: string, fontSize: string): number {
    if (!_measureCanvas) _measureCanvas = document.createElement("canvas");
    const ctx = _measureCanvas.getContext("2d")!;
    ctx.font = `${fontSize} sans-serif`;
    return ctx.measureText(text).width;
  }
  function localGetNodeWidth(node: ChessNode): number {
    if (nodeMode === 0) return 13;
    return getNodeWidth(
      node.move,
      nodeMode,
      measureTextWidth,
      settings?.notationType,
    );
  }
  let modeIcon = $derived(MODE_ICONS[nodeMode]);

  onMount(() => {
    eventBus.on("updateUI", onUiVer);
    eventBus.on("tree-ghost-lines", onGhostLines);
    eventBus.on("tree-pin-comment", onPinComment);
    eventBus.on("modified", onModified);
    if (!svgEl) return;
    updateTreeLayout();
    zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      const t = event.transform;
      if (
        t &&
        Number.isFinite(t.x) &&
        Number.isFinite(t.y) &&
        Number.isFinite(t.k)
      ) {
        zoomTransform = t;
      }
    });

    layoutChangeHandler = () => {
      if (!svgEl || svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
      if (needsInitialReset) {
        needsInitialReset = false;
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
        updateZoomExtent();
        d3.select(svgEl).call(zoomBehavior);
      }
      resetView();
    };
    activeDocument.body.addEventListener(
      LAYOUT_CHANGE_EVENT,
      layoutChangeHandler,
    );

    tick()
      .then(() => new Promise(requestAnimationFrame))
      .then(() => {
        if (destroyed || !svgEl) return;
        if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) {
          needsInitialReset = true;
          resizeObserver = new ResizeObserver(() => {
            if (destroyed || !needsInitialReset || !svgEl) return;
            if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
            requestAnimationFrame(() => {
              if (destroyed || !svgEl) return;
              if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
              needsInitialReset = false;
              if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
              }
              updateZoomExtent();
              d3.select(svgEl).call(zoomBehavior!);
              resetView();
            });
          });
          resizeObserver.observe(svgEl);
          return;
        }
        updateZoomExtent();
        d3.select(svgEl).call(zoomBehavior);
        resetView();
        return undefined;
      });
  });

  $effect(() => {
    const node = currentNode;
    if (!node) return;
    tick().then(() => {
      if (destroyed) return;
      panToNodeIfNeeded(node);
      return undefined;
    });
  });

  $effect(() => {
    // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions
    (nodeMap.size, nodeMode, pinnedCommentIds.size); // nodeMode 改宽度；pin/取消 pin 增删评论块需重排
    updateTreeLayout();
  });
</script>

{#if nodeMap.get(currentNode?.id ?? "")?.eval}
  {@const ce = nodeMap.get(currentNode!.id)!.eval!}
  {@const isZero = ce.scoreType !== "mate" && ce.score === 0}
  {@const isPositive =
    ce.score > 0 || (ce.scoreType === "mate" && ce.score >= 0)}
  {@const evalColor = isPositive ? "var(--eval-plus)" : "var(--eval-minus)"}
  {@const labelBg = isZero
    ? "linear-gradient(to bottom, var(--eval-plus) 50%, var(--eval-minus) 50%)"
    : evalColor}
  {@const fillPercent = evalBarIntensity(ce) * 50}
  {@const evalText =
    ce.scoreType === "mate"
      ? "#" + (ce.score >= 0 ? "+" : "-") + Math.abs(ce.score)
      : (ce.score > 0 ? "+" : "") + (ce.score / 100).toFixed(2)}
  <div class="{CLS_PREFIX}-eval">
    <div class="{CLS_PREFIX}-eval__bar">
      {#if isPositive}
        <div
          class="{CLS_PREFIX}-eval__fill"
          style="height: {fillPercent}%; top: {50 -
            fillPercent}%; background: {evalColor}"
        ></div>
      {:else}
        <div
          class="{CLS_PREFIX}-eval__fill"
          style="height: {fillPercent}%; top: 50%; background: {evalColor}"
        ></div>
      {/if}
      <div class="{CLS_PREFIX}-eval__center"></div>
      <span class="{CLS_PREFIX}-eval__label" style="background: {labelBg}"
        >{evalText}</span
      >
    </div>
  </div>
{/if}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
  bind:this={svgEl}
  width="100%"
  height="100%"
  class="{CLS_PREFIX}-panel__svg"
  onmouseleave={() => preview?.hideAll()}
>
  <g transform={TRANSFORM_SAFE}>
    {#each renderedNodes as node (node.id)}
      {#each node.children as child, idx (node.id + "-" + idx)}
        {#if !(foldedNodes.has(node.id) && idx > 0)}
          {@const onPath =
            currentPath.includes(node.id) && currentPath.includes(child.id)}
          <path
            d={`
        M ${node.x!} ${node.y!}
        L ${child.x! - EDGE_ELBOW * Math.sign(child.x! - node.x!)} ${node.y!}
        L ${child.x!} ${child.y!}
        `}
            stroke="var(--tree-line)"
            stroke-linejoin="round"
            stroke-width={onPath ? 1.5 : 1}
            opacity={onPath ? 1 : 0.4}
            fill="none"
          />
        {/if}
      {/each}
    {/each}

    {#each renderedGhostNodes as g (g.id)}
      {@const gInfo = ghostInfoById.get(g.id)}
      {@const gParent = ghostParentById.get(g.id)}
      {#if gInfo && gParent && g.x !== undefined && g.y !== undefined && gParent.x !== undefined && gParent.y !== undefined}
        <path
          d={`
        M ${gParent.x} ${gParent.y}
        L ${g.x - EDGE_ELBOW * Math.sign(g.x - gParent.x)} ${gParent.y}
        L ${g.x} ${g.y}
        `}
          stroke="var(--tree-line)"
          stroke-linejoin="round"
          stroke-width="1"
          stroke-dasharray="2 1.2"
          opacity={gInfo.rank === 0 ? 0.9 : 0.45}
          fill="none"
          style="pointer-events: none"
        />
      {/if}
    {/each}

    {#each pinnedCommentNodes as cn (cn.id)}
      {@const realId = cn.id.slice(PINNED_COMMENT_PREFIX.length)}
      {@const owner = nodeMap.get(realId)}
      {#if owner && owner.x !== undefined && owner.y !== undefined && cn.x !== undefined && cn.y !== undefined}
        {@const size = commentBlockSize(cn.comments ?? [])}
        <!-- 侧挂评论块的连线：与招法边同款，从所属节点中心沿本行走
             水平段再斜接到块顶边——不从子行顶边走，避免看起来像从
             下方的子节点发出。 -->
        <path
          d={`
        M ${owner.x} ${owner.y}
        L ${cn.x - EDGE_ELBOW * Math.sign(cn.x - owner.x)} ${owner.y}
        L ${cn.x} ${cn.y - size.height / 2}
        `}
          stroke="var(--tree-line)"
          stroke-linejoin="round"
          stroke-width="1"
          stroke-dasharray="2 1.2"
          opacity="0.5"
          fill="none"
          style="pointer-events: none"
        />
      {/if}
    {/each}

    {#each renderedNodes as node (node.id)}
      {#if node.children.length > 1}
        {@const isLeft = (node.depth ?? 0) % 2 === 0}
        {@const nw = localGetNodeWidth(node)}
        {@const offPathFold = !(
          currentPath.includes(node.id) &&
          node.children[0] &&
          !currentPath.includes(node.children[0].id)
        )}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          transform="translate({node.x! +
            (isLeft ? -nw / 2 : nw / 2)} {node.y!}){node.id === currentNode?.id
            ? ' scale(1.2)'
            : ''}"
          style="cursor: pointer"
          onclick={(e) => {
            e.stopPropagation();
            toggleFold(node);
          }}
        >
          <polygon
            points={foldedNodes.has(node.id)
              ? isLeft
                ? "0,-4 0,4 -3,3 -3,-3"
                : "0,-4 0,4 3,3 3,-3"
              : isLeft
                ? "0,-4 0,4 -5,0"
                : "0,-4 0,4 5,0"}
            fill="var(--tree-line)"
            stroke="var(--tree-line)"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity={offPathFold ? 0.5 : 1}
          />
        </g>
      {/if}
    {/each}

    {#each sortedRenderedNodes as node (node.id)}
      {@const nw = localGetNodeWidth(node)}
      {@const primaryAnnotation = node.annotations?.[0]}
      {@const isCurrent = node.id === currentNode?.id}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        class="{CLS_PREFIX}-panel__node"
        transform="translate({node.x!} {node.y!}){isCurrent
          ? ' scale(1.2)'
          : ''}"
        opacity={currentPath.includes(node.id) ? 1 : 0.55}
        stroke-width={isCurrent ? 1 : 0.5}
        onclick={() => eventBus.emit("node-click", node.id)}
        onmouseenter={(e) => {
          preview?.showNode(node, e);
        }}
        onmouseleave={() => {
          preview?.hideNode(node);
        }}
      >
        <rect
          x={-nw / 2}
          y={-nodeHeight / 2}
          width={nw}
          height={nodeHeight}
          rx="2.5"
          ry="2.5"
          fill={isCurrent ? "var(--color-accent)" : getNodeFill(node.color)}
          stroke={isCurrent
            ? "var(--background-modifier-border-focus)"
            : "var(--tree-line)"}
        />
        {#if matchedColorById.get(node.id)}
          <rect
            x={-nw / 2 - 1.5}
            y={-nodeHeight / 2 - 1.5}
            width={nw + 3}
            height={nodeHeight + 3}
            rx="4"
            ry="4"
            fill="none"
            stroke={matchedColorById.get(node.id)}
            stroke-width="1"
            opacity="0.8"
            style="pointer-events: none"
          />
        {/if}
        {#if nodeMode === 0 && !node.move}
          <g
            transform="translate(-4, -4)"
            color={isCurrent ? "var(--text-on-accent)" : "#fff"}
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html iconSvg("house", 8, 1.5)}
          </g>
        {:else if nodeMode === 0 && node.move}
          {@const display = getNodeDisplay(node.move)}
          {#if display && display.type === "icon"}
            <g
              transform="translate(-4, -4)"
              color={isCurrent
                ? "var(--text-on-accent)"
                : getNodeTextColor(node.color)}
            >
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html iconSvg(display.value, 8, 1.5)}
            </g>
          {:else if display && display.type === "char"}
            <text
              dominant-baseline="central"
              text-anchor="middle"
              fill={isCurrent ? "var(--text-on-accent)" : "white"}
              font-size="9px"
              dy={NODE_CHAR_DY}>{display.value}</text
            >
          {:else}
            <text
              dominant-baseline="central"
              text-anchor="middle"
              fill={isCurrent
                ? "var(--text-on-accent)"
                : getNodeTextColor(node.color)}
              font-size={nodeFontSize()}>{nodeLabel(node)}</text
            >
          {/if}
        {:else}
          <text
            dominant-baseline="central"
            text-anchor="middle"
            fill={isCurrent
              ? "var(--text-on-accent)"
              : getNodeTextColor(node.color)}
            font-size={nodeFontSize()}>{nodeLabel(node)}</text
          >
        {/if}
        {#if node.eval}
          {@const intensity = evalBarIntensity(node.eval)}
          {@const barWidth = 2 + intensity * (nw - 4)}
          <rect
            x={-barWidth / 2}
            y={nodeHeight / 2 - 0.5}
            width={barWidth}
            height="1.5"
            rx="0.5"
            fill={evalBarColor(node.eval)}
            style="pointer-events: none"
          />
        {/if}
        {#if primaryAnnotation}
          <!-- Position annotations (均势/白优/黑优/不明) share the
               result badge's top-left corner; custom marks stay on the
               left edge so the two never occupy the same spot. -->
          <g
            transform="translate({-nw / 2} {GLYPH_BY_KEY[primaryAnnotation]
              ?.category === 'position'
              ? -3.5
              : nodeHeight / 2})"
            style="pointer-events: none"
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html badgeSvg(primaryAnnotation)}
          </g>
        {/if}
        {#if resultBadgeKey(node)}
          <g
            transform="translate({-nw / 2} {-3.5})"
            style="pointer-events: none"
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html badgeSvg(resultBadgeKey(node))}
          </g>
        {/if}
        {#if node.glyph}
          <g
            transform="translate({nw / 2} {nodeHeight / 2})"
            style="pointer-events: none"
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html badgeSvg(`glyph_${node.glyph.symbol}`)}
          </g>
        {/if}
        {#if (node.comments ?? []).length > 0}
          <g
            transform="translate({nw / 2 - 3.5} {-7})"
            style="pointer-events: none"
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html iconSvg("message_square_text", 7, 1.5, "var(--color-blue)")}
          </g>
        {/if}
      </g>
    {/each}

    {#each pinnedCommentNodes as cn (cn.id)}
      {@const realId = cn.id.slice(PINNED_COMMENT_PREFIX.length)}
      {@const owner = nodeMap.get(realId)}
      {#if owner && cn.x !== undefined && cn.y !== undefined}
        <!-- lines/size read from the stashed node fields (fresh every
             layout run) — NOT from the owner, whose in-place comment
             mutations Svelte's derived === checks would ignore. -->
        {@const lines = cn.comments ?? []}
        {@const size = commentBlockSize(lines)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="{CLS_PREFIX}-panel__node"
          transform="translate({cn.x} {cn.y})"
          onclick={() => eventBus.emit("node-click", realId)}
          onmouseenter={(e) => preview?.showNode(owner, e, "block")}
          onmouseleave={() => preview?.hideNode(owner)}
        >
          <rect
            x={-size.width / 2}
            y={-size.height / 2}
            width={size.width}
            height={size.height}
            rx="2.5"
            ry="2.5"
            fill="var(--background-primary)"
            stroke="var(--tree-line)"
          />
          <text
            y={-size.height / 2 + COMMENT_PAD_Y + COMMENT_LINE_HEIGHT / 2}
            text-anchor="middle"
            dominant-baseline="central"
            font-size={COMMENT_FONT_SIZE}
            fill="var(--text-normal)"
            style="pointer-events: none"
          >
            {#each lines as line, li (li)}
              <tspan x="0" dy={li === 0 ? 0 : COMMENT_LINE_HEIGHT}>{line}</tspan
              >
            {/each}
          </text>
        </g>
      {/if}
    {/each}

    {#each renderedGhostNodes as g (g.id)}
      {@const gInfo = ghostInfoById.get(g.id)}
      {@const gw = localGetNodeWidth(g)}
      {#if gInfo && g.x !== undefined && g.y !== undefined}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="{CLS_PREFIX}-panel__node"
          transform="translate({g.x} {g.y})"
          opacity={gInfo.rank === 0 ? 1 : 0.6}
          style="cursor: pointer"
          onclick={() => eventBus.emit("tree-ghost-materialize", g.id)}
          onmouseenter={(e) => preview?.showNode(g, e)}
          onmouseleave={() => preview?.hideNode(g)}
        >
          <rect
            x={-gw / 2}
            y={-nodeHeight / 2}
            width={gw}
            height={nodeHeight}
            rx="2.5"
            ry="2.5"
            fill={getNodeFill(g.color)}
            fill-opacity="0.4"
            stroke="var(--tree-line)"
            stroke-width="0.8"
            stroke-dasharray="2 1.2"
          />
          {#if nodeMode === 0 && !g.move}
            <g transform="translate(-4, -4)" color="#fff">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html iconSvg("house", 8, 1.5)}
            </g>
          {:else if nodeMode === 0 && g.move}
            {@const gDisplay = getNodeDisplay(g.move)}
            {#if gDisplay && gDisplay.type === "icon"}
              <g
                transform="translate(-4, -4)"
                color={getNodeTextColor(g.color)}
              >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html iconSvg(gDisplay.value, 8, 1.5)}
              </g>
            {:else if gDisplay && gDisplay.type === "char"}
              <text
                dominant-baseline="central"
                text-anchor="middle"
                fill="white"
                font-size="9px"
                dy={NODE_CHAR_DY}>{gDisplay.value}</text
              >
            {:else}
              <text
                dominant-baseline="central"
                text-anchor="middle"
                fill={getNodeTextColor(g.color)}
                font-size={nodeFontSize()}>{nodeLabel(g)}</text
              >
            {/if}
          {:else}
            <text
              dominant-baseline="central"
              text-anchor="middle"
              fill={getNodeTextColor(g.color)}
              font-size={nodeFontSize()}>{nodeLabel(g)}</text
            >
          {/if}
          {#if gInfo.isHead}
            <text
              y={-nodeHeight / 2 - 2.5}
              text-anchor="middle"
              font-size="6.5px"
              fill={ghostScoreColor(gInfo.score, gInfo.scoreType)}
              style="pointer-events: none"
            >
              {ghostScoreText(gInfo.score, gInfo.scoreType)}
            </text>
          {/if}
        </g>
      {/if}
    {/each}
  </g>
</svg>

<div class="{CLS_PREFIX}-panel__toolbar {CLS_PREFIX}-btn-group">
  {#if canFold}
    <button
      class="{CLS_PREFIX}-btn"
      aria-label={t("tree.fold", _lv)}
      use:useSetIcon={"chevrons-right-left"}
      onclick={toggleCurrentFold}
    ></button>
  {/if}
  {#each zoomBTN as { title, icon, event } (event)}
    <button
      class="{CLS_PREFIX}-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={event}
    ></button>
  {/each}
  <button
    class="{CLS_PREFIX}-btn"
    aria-label={nodeModeTitle}
    use:useSetIcon={modeIcon}
    onclick={cycleNodeMode}
  ></button>
</div>
