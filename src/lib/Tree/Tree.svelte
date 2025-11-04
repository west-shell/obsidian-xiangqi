<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { EventBus } from "../../core/event-bus";
  import { PIECE_CHARS, type ChessNode, type NodeMap } from "../../types";
  import { createInteractionHandlers } from "./interact";
  import { calculateTreeLayout } from "./layout";

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
  }

  let { nodeMap, eventBus, currentNode = $bindable(), currentPath }: Props = $props();

  // ---- 状态 ----
  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  let renderedNodes: ChessNode[] = $state([]);
  let handleEvent: ((e: Event) => void) | undefined = $state();

  // ---- 平移与缩放 ----
  let translateX = $state(0);
  let translateY = $state(0);
  let scale = $state(1);

  // ---- 常量 ----
  const spacingX = 30;
  const spacingY = 16;
  const width = 20;
  const height = 0.7 * spacingY;

  const ANNOTATION_DEFINITIONS: Record<string, { symbol: string; color: string }> = {
    "R+": { symbol: "优", color: "red" },
    "B+": { symbol: "优", color: "black" },
    "=": { symbol: "均", color: "green" },
    "?": { symbol: "?", color: "orange" },
    "!": { symbol: "!", color: "blue" },
    "R#": { symbol: "胜", color: "red" },
    "B#": { symbol: "胜", color: "black" },
  };

  const ANNOTATION_TYPES = {
    evaluation: ["R+", "B+", "="],
    moveQuality: ["?", "!"],
    gameEnd: ["R#", "B#", "=#"],
  };

  const ALL_ANNOTATION_KEYS = Object.keys(ANNOTATION_DEFINITIONS);

  // ---- 工具函数 ----
  function getAnnotation(node: ChessNode, type: keyof typeof ANNOTATION_TYPES): string | undefined {
    if (!node.comments) return undefined;
    return node.comments.find((c) => ANNOTATION_TYPES[type].includes(c));
  }

  function getAllAnnotations(node: ChessNode): string[] {
    return node.comments?.filter((c) => ALL_ANNOTATION_KEYS.includes(c)) ?? [];
  }

  function getRegularComments(node: ChessNode): string[] {
    return node.comments?.filter((c) => !ALL_ANNOTATION_KEYS.includes(c)) ?? [];
  }

  function saveComments() {
    if (!currentNode) return;
    const regularComments = commentsText.split("\n").filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    currentNode.comments = [...existingAnnotations, ...regularComments];
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
    if (!svgEl) return;

    const handlers = createInteractionHandlers(svgEl, {
      getState: () => ({ x: translateX, y: translateY, scale }),
      setState: ({ x, y, scale: s }) => {
        translateX = x;
        translateY = y;
        scale = s;
      },
      minZoom: 0.5,
      maxZoom: 4,
      zoomSpeed: 0.2,
    });

    handleEvent = handlers.handleEvent;
  }

  // ---- 自动居中 ----
  function centerAndFit() {
    if (!svgEl || renderedNodes.length === 0) return;

    const { clientWidth, clientHeight } = svgEl;
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

    const scaleX = (clientWidth - padding * 2) / treeWidth;
    const scaleY = (clientHeight - padding * 2) / treeHeight;
    scale = Math.max(0.75, Math.min(scaleX, scaleY, 2));

    const treeCenterX = minX * spacingX + treeWidth / 2;
    const treeTopY = minY * spacingY;
    translateX = clientWidth / 2 - treeCenterX * scale;
    translateY = padding - treeTopY * scale;
  }

  function panToNodeIfNeeded(node: ChessNode) {
    if (!node || !svgEl || node.x === undefined || node.y === undefined) return;
    const { clientWidth, clientHeight } = svgEl;
    const padding = 50;

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
  }

  // ---- 生命周期 ----
  onMount(() => {
    if (nodeMap.size > 0) {
      updateTreeLayout();
      tick().then(centerAndFit);
    }
  });

  // ---- 响应式更新 ----
  $effect(() => {
    if (!currentNode) {
      commentsText = "";
      return;
    }

    const node = currentNode;
    commentsText = getRegularComments(node).join("\n");

    tick().then(() => {
      if (textareaEl) adjustTextareaHeight();
      panToNodeIfNeeded(node);
    });
  });

  $effect(() => {
    nodeMap.size;
    updateTreeLayout();
  });
</script>

<!-- ---- 结构 ---- -->
<div class="container">
  <div class="svg-wrapper">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      bind:this={svgEl}
      width="100%"
      height="100%"
      class="tree-svg"
      onmousedown={handleEvent}
      onmousemove={handleEvent}
      onmouseup={handleEvent}
      onmouseleave={handleEvent}
      onwheel={handleEvent}
      ontouchstart={handleEvent}
      ontouchmove={handleEvent}
      ontouchend={handleEvent}
    >
      <g transform="translate({translateX} {translateY}) scale({scale})">
        {#each renderedNodes as node}
          {#each node.children as child}
            <line
              x1={node.x! * spacingX}
              y1={node.y! * spacingY}
              x2={(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX}
              y2={node.y! * spacingY}
              stroke="var(--board-line)"
              stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id) ? 2 : 1}
              opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1 : 0.7}
            />
            <line
              x1={(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX}
              y1={node.y! * spacingY}
              x2={child.x! * spacingX}
              y2={child.y! * spacingY - 0.5 * height}
              stroke="var(--board-line)"
              stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id) ? 2 : 1}
              opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1 : 0.7}
            />
          {/each}
        {/each}

        {#each renderedNodes as node (node.id)}
          {@const evaluation = getAnnotation(node, "evaluation")}
          {@const moveQuality = getAnnotation(node, "moveQuality")}
          {@const gameEnd = getAnnotation(node, "gameEnd")}

          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g
            class="node-group"
            transform="translate({node.x! * spacingX} {node.y! * spacingY})"
            onclick={() => eventBus.emit("node-click", node.id)}
          >
            <rect
              x="-10"
              y="-6"
              {width}
              {height}
              rx="3"
              ry="3"
              fill={node.side === "red"
                ? "var(--piece-red)"
                : node.side === "black"
                  ? "var(--piece-black)"
                  : "gray"}
              stroke="var(--board-line)"
              stroke-width={node.id === currentNode?.id ? 1.5 : 0.5}
            />
            <text dy="3.5" text-anchor="middle" fill="white" font-size="9px">
              {node.data?.type ? PIECE_CHARS[node.data.type] : "开局"}
            </text>

            <!-- 评论标记 -->
            {#if getRegularComments(node).length > 0}
              <circle cx="10" cy="-7" r="3" fill="royalblue" />
            {/if}

            <!-- 各类标注 -->
            {#if evaluation}
              {@const def = ANNOTATION_DEFINITIONS[evaluation]}
              <g transform="translate(-13, -7)">
                <rect width="7" height="7" rx="1.5" fill={def.color} />
                <text
                  x="3.5"
                  y="3.5"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-size="5px"
                  fill="white"
                  font-weight="bold"
                >
                  {def.symbol}
                </text>
              </g>
            {/if}

            {#if moveQuality}
              {@const def = ANNOTATION_DEFINITIONS[moveQuality]}
              <g transform="translate(-13, 1)">
                <rect width="7" height="7" rx="1.5" fill={def.color} />
                <text
                  x="3.5"
                  y="3.5"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-size="5px"
                  fill="white"
                  font-weight="bold"
                >
                  {def.symbol}
                </text>
              </g>
            {/if}

            {#if gameEnd}
              {@const def = ANNOTATION_DEFINITIONS[gameEnd]}
              <g transform="translate(6.5, 3.5)">
                <rect width="7" height="7" rx="1.5" fill={def.color} />
                <text
                  x="3.5"
                  y="3.5"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-size="5px"
                  fill="white"
                  font-weight="bold"
                >
                  {def.symbol}
                </text>
              </g>
            {/if}
          </g>
        {/each}
      </g>
    </svg>
  </div>

  <textarea
    bind:value={commentsText}
    class="auto-height"
    placeholder="添加注释"
    bind:this={textareaEl}
    oninput={adjustTextareaHeight}
    onblur={saveComments}
    rows="1"
  ></textarea>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100vh;
    /* min-height: 30vh; */
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
    min-height: 0;
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
