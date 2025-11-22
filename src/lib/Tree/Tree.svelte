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
  const spacingX = 25;
  const spacingY = 15;
  const width = 13;
  const height = 11;
  const lucide_message_square_text = `<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M7 11h10"/><path d="M7 15h6"/><path d="M7 7h8"/>`;
  const lucide_smile = `<path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>`;
  const lucide_thumbs_up = `<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/>`;
  const lucide_thumbs_down = `<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/><path d="M17 14V2"/>`;
  const lucide_handshake = `<circle cx="12" cy="11" r="12"/><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>`;
  const lucide_scale = `<path fill="red" d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>`;
  const lucide_question = `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`;
  const lucide_shield_alert = `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>`;
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
            <path
              d={`
              M ${node.x! * spacingX} ${node.y! * spacingY}
              L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
              L ${child.x! * spacingX} ${child.y! * spacingY - 0.5 * height}
              `}
              stroke="var(--board-line)"
              stroke-linejoin="round"
              stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id) ? 2 : 1}
              opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1 : 0.8}
              filter={currentPath.includes(node.id) && currentPath.includes(child.id)
                ? "grayscale(50%) brightness(0.75)"
                : undefined}
              fill="none"
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
            opacity={currentPath.includes(node.id) ? 1 : 0.8}
            filter={!currentPath.includes(node.id)
              ? "grayscale(100%) brightness(0.75)"
              : node.id === currentNode?.id
                ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                : undefined}
            stroke-width={node.id === currentNode?.id ? 1 : 0.5}
            onclick={() => eventBus.emit("node-click", node.id)}
          >
            <rect
              x={-width / 2}
              y={-height / 2}
              {width}
              {height}
              rx="2.5"
              ry="2.5"
              fill={node.side === "red"
                ? "var(--piece-red)"
                : node.side === "black"
                  ? "var(--piece-black)"
                  : "gray"}
              stroke="var(--board-line)"
            />

            <!-- 评论标记 -->
            <!-- stroke="royalblue" -->
            {#if getRegularComments(node).length > 0}
              <g
                transform="translate({0.35 * width} {-0.65 * height}) scale(0.35)"
                fill="royalblue"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                {@html lucide_message_square_text}
              </g>
            {/if}

            <text dy="3.5" text-anchor="middle" fill="white" font-size="9px">
              {node.data?.type ? PIECE_CHARS[node.data.type] : "始"}
            </text>

            <!-- 各类标注 -->
            {#if evaluation}
              {@const def = ANNOTATION_DEFINITIONS[evaluation]}
              <g
                transform="translate({-0.9 * width} {-0.65 * height}) scale(0.3)"
                fill={def.color}
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                {@html def.icon}
              </g>
            {/if}

            {#if moveQuality}
              {@const def = ANNOTATION_DEFINITIONS[moveQuality]}
              <g
                transform="translate({-0.9 * width} {0 * height}) scale(0.3)"
                fill={def.color}
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                {@html def.icon}
              </g>
            {/if}

            {#if gameEnd}
              {@const def = ANNOTATION_DEFINITIONS[gameEnd]}
              <g
                transform="translate({-0.85 * width} {-0.65 * height}) scale(0.3)"
                fill={def.color}
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                {@html def.icon}
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
