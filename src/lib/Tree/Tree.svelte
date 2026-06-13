<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { EventBus } from "../../core/event-bus";
  import { type ChessNode, type NodeMap, PIECE_CHARS } from "../../types";
  import { t } from "../../i18n";
  import { calculateTreeLayout } from "./layout";
  import { setIcon } from "obsidian";
  import * as d3 from "d3";
  import type { Move } from "../../chess";

  function pieceLabel(move: Move): string {
    const raw = move.piece;
    const char = move.color === "w" ? raw.toUpperCase() : raw;
    return (PIECE_CHARS as Record<string, string>)[char] || raw;
  }

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
  }

  let { nodeMap, eventBus, currentNode = $bindable(), currentPath }: Props = $props();

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  let renderedNodes: ChessNode[] = $state([]);

  // ---- D3 Zoom ----
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;

  const spacingX = 22;
  const spacingY = 15;
  const nodeWidth = 13;
  const nodeHeight = 11;
  const lucide_message_square_text = `<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M7 11h10"/><path d="M7 15h6"/><path d="M7 7h8"/>`;
  // const lucide_smile = `<path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>`;
  const lucide_thumbs_up = `<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/>`;
  const lucide_thumbs_down = `<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/><path d="M17 14V2"/>`;
  const lucide_handshake = `<path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"/>`;
  const lucide_bookmark = `<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>`;
  const lucide_star = `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>`;

  const ANNOTATION_DEFINITIONS: Record<string, { symbol: string; color: string; icon?: string }> = {
    "R+": { symbol: "红优", color: "var(--piece-red)", icon: lucide_thumbs_up },
    "B+": { symbol: "黑优", color: "var(--piece-black)", icon: lucide_thumbs_down },
    "=": { symbol: "均势", color: "green", icon: lucide_handshake },
    "?": { symbol: "问题", color: "var(--text-warning)", icon: lucide_bookmark },
    "!": { symbol: "妙手", color: "var(--color-yellow)", icon: lucide_star },
    "R#": { symbol: "红胜", color: "red", icon: lucide_thumbs_up },
    "B#": { symbol: "黑胜", color: "black", icon: lucide_thumbs_up },
    "=#": { symbol: "和棋", color: "gray", icon: lucide_handshake },
  };

  const ALL_ANNOTATION_KEYS = Object.keys(ANNOTATION_DEFINITIONS);

  // ---- 工具函数 ----
  function getPrimaryAnnotation(node: ChessNode): string | undefined {
    if (!node.comments) return undefined;
    return node.comments.find((c) => ALL_ANNOTATION_KEYS.includes(c));
  }

  function getAllAnnotations(node: ChessNode): string[] {
    return node.comments?.filter((c) => ALL_ANNOTATION_KEYS.includes(c)) ?? [];
  }

  const SHAPES_RE = /^{([a-i][0-9])([a-i][0-9])?:([gryb])}$/;

  function getRegularComments(node: ChessNode): string[] {
    return (
      node.comments?.filter((c) => !ALL_ANNOTATION_KEYS.includes(c) && !SHAPES_RE.test(c)) ?? []
    );
  }

  function getAllShapes(node: ChessNode): string[] {
    return node.comments?.filter((c) => SHAPES_RE.test(c)) ?? [];
  }

  // ---- 自动保存逻辑 ----
  let saveTimeout: number | undefined;

  function handleCommentsInput() {
    adjustTextareaHeight();

    // 防抖：输入暂停 700ms 自动保存
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      saveComments();
      saveTimeout = undefined;
    }, 700);
  }
  // 组件卸载时清理定时器
  let layoutChangeHandler: (() => void) | null = null;
  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    if (layoutChangeHandler) {
      document.body.removeEventListener('layout-change', layoutChangeHandler);
      layoutChangeHandler = null;
    }
  });

  // 离开时立即保存
  function handleCommentsBlur() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    saveComments();
  }

  function saveComments() {
    if (!currentNode) return;
    const regularComments = commentsText.split("\n").filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    const existingShapes = getAllShapes(currentNode);
    currentNode.comments = [...existingAnnotations, ...existingShapes, ...regularComments];
    eventBus.emit("updateUI", null);
    eventBus.emit("updatePGN", null);
  }

  // ---- 自动调整文本框高度 ----
  function adjustTextareaHeight() {
    if (!textareaEl) return;
    textareaEl.classList.add("auto-height");
    textareaEl.style.setProperty("--textarea-height", `${textareaEl.scrollHeight}px`);
    textareaEl.classList.remove("auto-height");
  }

  // ---- 布局计算 ----
  function updateTreeLayout() {
    renderedNodes = calculateTreeLayout(nodeMap);
  }

  function resetView() {
    updateTreeLayout();
    if (!svgEl || !zoomBehavior) return;
    const padding = 40;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of renderedNodes) {
      minX = Math.min(minX, n.x!);
      maxX = Math.max(maxX, n.x!);
      minY = Math.min(minY, n.y!);
      maxY = Math.max(maxY, n.y!);
    }
    const treeWidth = (maxX - minX) * spacingX;
    const treeHeight = (maxY - minY) * spacingY;
    const { clientWidth, clientHeight } = svgEl;
    const scaleX = (clientWidth - padding * 2) / treeWidth;
    const scaleY = (clientHeight - padding * 2) / treeHeight;
    const k = Math.max(0.75, Math.min(scaleX, scaleY, 2));
    const tx = clientWidth / 2 - (minX * spacingX + treeWidth / 2) * k;
    const ty = clientHeight / 2 - (minY * spacingY + treeHeight / 2) * k;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function panToNodeIfNeeded(node: ChessNode) {
    if (!node || !svgEl || node.x === undefined || node.y === undefined) return;
    const { clientWidth, clientHeight } = svgEl;
    const padding = 50;
    let { x: translateX, y: translateY, k: scale } = zoomTransform;
    const nodeScreenX = node.x * spacingX * scale + translateX;
    const nodeScreenY = node.y * spacingY * scale + translateY;

    let dx = 0,
      dy = 0;
    if (nodeScreenX < padding) dx = padding - nodeScreenX;
    else if (nodeScreenX > clientWidth - padding) dx = clientWidth - padding - nodeScreenX;

    if (nodeScreenY < padding) dy = padding - nodeScreenY;
    else if (nodeScreenY > clientHeight - padding) dy = clientHeight - padding - nodeScreenY;

    if (dx || dy) {
      translateX += dx;
      translateY += dy;
    }
    const t = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function zoomAtCenter(factor: number) {
    if (!svgEl) return;

    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    let { x: translateX, y: translateY, k: scale } = zoomTransform;
    const prev = scale;
    const next = prev * factor;
    // 计算当前屏幕中心对应的世界坐标（未缩放坐标系）
    const worldX = (cx - translateX) / prev;
    const worldY = (cy - translateY) / prev;
    // 应用新缩放并调整 translate 保持屏幕中心不变
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

  const zoomBTN = [
    { title: "放大", icon: "plus", event: zoomIn },
    { title: "缩小", icon: "minus", event: zoomOut },
    { title: "重置", icon: "rotate-ccw", event: resetView },
  ];
  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }

  onMount(async () => {
    if (!svgEl) return;

    updateTreeLayout();

    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      // .scaleExtent([0.5, 6])
      .on("zoom", (event) => {
        zoomTransform = event.transform;
      });

    d3.select(svgEl).call(zoomBehavior);

    await tick();
    await new Promise(requestAnimationFrame);

    resetView();

    layoutChangeHandler = () => resetView();
    document.body.addEventListener('layout-change', layoutChangeHandler);
  });

  // ---- 响应式更新 ----
  $effect(() => {
    if (!currentNode) {
      commentsText = "";
      return;
    }

    const node = currentNode;
    commentsText = getRegularComments(node).join("\n");

    // oxlint-disable-next-line promise/always-return
    tick().then(() => {
      if (textareaEl) adjustTextareaHeight();
      panToNodeIfNeeded(node);
    });
  });

  $effect(() => {
    // oxlint-disable-next-line no-unused-expressions
    nodeMap.size;
    updateTreeLayout();
  });
</script>

<div class="tree-container">
  <div class="svg-wrapper">
    <svg bind:this={svgEl} width="100%" height="100%" class="tree-svg">
      <g transform={zoomTransform.toString()}>
        <!-- 连线 -->
        {#each renderedNodes as node}
          {#each node.children as child}
            <path
              d={`
              M ${node.x! * spacingX} ${node.y! * spacingY}
              L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
              L ${child.x! * spacingX} ${child.y! * spacingY}
              `}
              stroke="var(--board-line)"
              stroke-linejoin="round"
              stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id)
                ? 1.5
                : 1}
              opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1.5 : 0.7}
              filter={currentPath.includes(node.id) && currentPath.includes(child.id)
                ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                : "grayscale(50%) brightness(0.75)"}
              fill="none"
            />
          {/each}
        {/each}

        <!-- 节点 -->
        {#each renderedNodes as node (node.id)}
          {@const primaryAnnotation = getPrimaryAnnotation(node)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group"
            transform="translate({node.x! * spacingX} {node.y! * spacingY})"
            opacity={currentPath.includes(node.id) ? 1 : 0.8}
            filter={!currentPath.includes(node.id)
              ? "grayscale(100%) brightness(0.75)"
              : node.id === currentNode?.id
                ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                : undefined}
            stroke-width={node.id === currentNode?.id ? 1 : 0.5}
            onclick={() => eventBus.emit("node-click", node.id)}
          >
            {#if primaryAnnotation}
              {@const def = ANNOTATION_DEFINITIONS[primaryAnnotation]}
              <g
                transform="translate(-7.2 -7.2) scale(0.6)"
                fill={def.color}
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                {@html def.icon}
              </g>
            {:else}
              <rect
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                rx="2.5"
                ry="2.5"
                fill={node.side === "red"
                  ? "var(--piece-red)"
                  : node.side === "black"
                    ? "var(--piece-black)"
                    : "green"}
                stroke="var(--board-line)"
              />
              <text dy="3.5" text-anchor="middle" fill="white" font-size="9px">
                {node.move?.piece ? pieceLabel(node.move) : "始"}
              </text>
            {/if}

            <!-- 评论标记 -->
            {#if getRegularComments(node).length > 0}
              <g
                transform="translate({0.35 * nodeWidth} {-0.7 * nodeHeight}) scale(0.35)"
                fill="royalblue"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                {@html lucide_message_square_text}
              </g>
            {/if}
          </g>
        {/each}
      </g>
    </svg>

    <div class="toolbar">
      {#each zoomBTN as { title, icon, event }}
        <button class="toolbar-btn" aria-label={title} use:useSetIcon={icon} onclick={event}
        ></button>
      {/each}
    </div>
  </div>

  <textarea
    bind:value={commentsText}
    class="auto-height"
    placeholder={t("tree.placeholder")}
    bind:this={textareaEl}
    oninput={handleCommentsInput}
    onblur={handleCommentsBlur}
    rows="1"
  ></textarea>
</div>

<style>
  .tree-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    --board-background: var(--background-primary-alt);
    --board-line: var(--text-normal);
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
    --text-color: var(--text-normal);
  }

  .svg-wrapper {
    flex: 1 1 auto;
    overflow: hidden;
    background-color: var(--board-background);
    position: relative;
    width: 100%;
    height: 100%;
  }

  .toolbar {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    gap: 0;
    margin: 0;
    padding: 0px;
  }

  .toolbar .toolbar-btn {
    /* font-size: large; */
    /* all: unset; */
    width: 30px;
    height: 30px;
    padding: 0;
    margin: 0;
  }

  .tree-svg {
    user-select: none;
    touch-action: none;
    display: block;
  }

  .node-group {
    cursor: pointer;
  }

  textarea {
    width: 100%;
    height: var(--textarea-height, 20px);
    max-height: 80px;
    resize: none;
    font-family: var(--font-family);
    font-size: var(--font-size-normal);
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    padding: 0;
    outline: none;
    overflow-y: auto;
  }
  textarea.auto-height {
    height: auto;
  }
  textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 5px var(--interactive-accent);
  }
</style>
