<script lang="ts">
  import { onMount, tick } from "svelte";
  import { PIECE_CHARS, type ChessNode, type NodeMap } from "../../types";
  import { themes } from "../themes";
  import { createInteractionHandlers } from "./interact";
  import { calculateTreeLayout } from "./layout";

  export let theme: keyof typeof themes;
  export let nodeMap: NodeMap;
  export let eventBus: { emit: (event: string, payload: any) => void };
  export let currentNode: ChessNode | null;
  export let currentPath: string[];

  let commentsText = "";

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
    gameEnd: ["R#", "B#"],
  };

  const ALL_ANNOTATION_KEYS = Object.keys(ANNOTATION_DEFINITIONS);

  function getAnnotation(node: ChessNode, type: keyof typeof ANNOTATION_TYPES): string | undefined {
    if (!node.comments) return undefined;
    const keys = ANNOTATION_TYPES[type];
    return node.comments.find((c) => keys.includes(c));
  }

  function getAllAnnotations(node: ChessNode): string[] {
    if (!node.comments) return [];
    return node.comments.filter((c) => ALL_ANNOTATION_KEYS.includes(c));
  }

  function getRegularComments(node: ChessNode): string[] {
    if (!node.comments) return [];
    return node.comments.filter((c) => !ALL_ANNOTATION_KEYS.includes(c));
  }

  $: if (currentNode) {
    const node = currentNode;
    commentsText = getRegularComments(node).join("\n");
    tick().then(() => panToNodeIfNeeded(node));
  } else {
    commentsText = "";
  }

  function saveComments() {
    if (!currentNode) return;
    const regularComments = commentsText.split("\n").filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    currentNode.comments = [...existingAnnotations, ...regularComments];
    eventBus.emit("updateUI", null);
    eventBus.emit("updatePGN", null);
  }

  $: currentNode;

  $: ({ bgColor, red, black, lineColor, textColor } = themes[theme]);
  const spacingX = 30;
  const spacingY = 17;

  let renderedNodes: ChessNode[] = [];

  let svgEl: SVGSVGElement;

  let translateX = 0;
  let translateY = 0;
  let scale = 1;

  let handleEvent: (e: Event) => void;

  function updateTreeLayout() {
    renderedNodes = calculateTreeLayout(nodeMap);

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

  $: nodeMap.size, updateTreeLayout();

  onMount(() => {
    if (nodeMap.size > 0) {
      updateTreeLayout();
      tick().then(centerAndFit);
    }
  });

  /** 自动调整 textarea 高度 */
  function adjustTextareaHeight(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = "auto"; // 先重置
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + "px";
  }

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
    const padding = 50; // pixels

    const nodeScreenX = node.x * spacingX * scale + translateX;
    const nodeScreenY = node.y * spacingY * scale + translateY;

    let dx = 0;
    let dy = 0;

    if (nodeScreenX < padding) {
      dx = padding - nodeScreenX;
    } else if (nodeScreenX > clientWidth - padding) {
      dx = clientWidth - padding - nodeScreenX;
    }

    if (nodeScreenY < padding) {
      dy = padding - nodeScreenY;
    } else if (nodeScreenY > clientHeight - padding) {
      dy = clientHeight - padding - nodeScreenY;
    }

    if (dx !== 0 || dy !== 0) {
      translateX += dx;
      translateY += dy;
    }
  }
</script>

<div
  class="container"
  style="--theme-text-color:{textColor}; --tree-bg:{bgColor}; --line-color:{lineColor}; --red-color:{red}; --black-color:{black};"
>
  <div class="svg-wrapper">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      bind:this={svgEl}
      width="100%"
      height="100%"
      class="tree-svg"
      on:mousedown={handleEvent}
      on:mousemove={handleEvent}
      on:mouseup={handleEvent}
      on:mouseleave={handleEvent}
      on:wheel={handleEvent}
      on:touchstart={handleEvent}
      on:touchmove={handleEvent}
      on:touchend={handleEvent}
    >
      <g transform="translate({translateX} {translateY}) scale({scale})">
        {#each renderedNodes as node}
          {#each node.children as child}
            {#if Math.abs(node.x! - child.x!) > 1}
              <line
                x1={node.x! * spacingX}
                y1={node.y! * spacingY}
                x2={(child.x! - Math.sign(child.x! - node.x!)) * spacingX}
                y2={node.y! * spacingY}
                stroke="var(--line-color)"
                stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id)
                  ? 2
                  : 0.7}
                opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1 : 0.7}
              />
              <line
                x1={(child.x! - Math.sign(child.x! - node.x!)) * spacingX}
                y1={node.y! * spacingY}
                x2={child.x! * spacingX}
                y2={child.y! * spacingY}
                stroke="var(--line-color)"
                stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id)
                  ? 2
                  : 0.7}
                opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1 : 0.7}
              />
            {:else}
              <line
                x1={node.x! * spacingX}
                y1={node.y! * spacingY}
                x2={child.x! * spacingX}
                y2={child.y! * spacingY}
                stroke="var(--line-color)"
                stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id)
                  ? 2
                  : 0.7}
                opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1 : 0.7}
              />
            {/if}
          {/each}
        {/each}

        {#each renderedNodes as node}
          {@const evaluation = getAnnotation(node, "evaluation")}
          {@const moveQuality = getAnnotation(node, "moveQuality")}
          {@const gameEnd = getAnnotation(node, "gameEnd")}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g
            class="node-group"
            transform="translate({node.x! * spacingX} {node.y! * spacingY})"
            on:click={() => eventBus.emit("node-click", node.id)}
            on:dblclick={() => eventBus.emit("node-dblclick", node.id)}
          >
            <defs>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="#00000044" />
              </filter>
            </defs>
            <rect
              x="-10"
              y="-6"
              width="20"
              height="12"
              rx="3"
              ry="3"
              fill={node.side === "red"
                ? "var(--red-color)"
                : node.side === "black"
                  ? "var(--black-color)"
                  : "gray"}
              stroke="var(--line-color)"
              stroke-width={node === currentNode ? 1.5 : 0.5}
              class:current-node-shadow={node === currentNode}
            />
            <text dy="3.5" text-anchor="middle" fill="#FFFFFF" font-size="9px">
              {node.data && node.data.type ? PIECE_CHARS[node.data.type] : "开局"}
            </text>
            <!-- Top-right: Has comments -->
            {#if getRegularComments(node).join("").length > 0}
              <circle cx="10" cy="-7" r="3" fill="royalblue" />
            {/if}

            <!-- Top-left: Evaluation -->
            {#if evaluation}
              {@const def = ANNOTATION_DEFINITIONS[evaluation]}
              <g transform="translate(-13, -7)">
                <rect x="0" y="0" width="7" height="7" rx="1.5" fill={def.color}></rect>
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

            <!-- Bottom-left: Move Quality -->
            {#if moveQuality}
              {@const def = ANNOTATION_DEFINITIONS[moveQuality]}
              <g transform="translate(-13, 1)">
                <rect x="0" y="0" width="7" height="7" rx="1.5" fill={def.color}></rect>
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

            <!-- Bottom-right: Game End -->
            {#if gameEnd}
              {@const def = ANNOTATION_DEFINITIONS[gameEnd]}
              <g transform="translate(6.5, 3.5)">
                <rect x="0" y="0" width="7" height="7" rx="1.5" fill={def.color}></rect>
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

  {#if currentNode}
    <div class="comment-editor">
      <textarea
        bind:value={commentsText}
        placeholder="添加注释"
        on:input={adjustTextareaHeight}
        on:blur={saveComments}
        rows="1"
      ></textarea>
    </div>
  {/if}
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100vh;
    overflow: hidden;
    --tree-bg: var(--background-primary);
    --theme-text-color: var(--text-normal);
  }

  .svg-wrapper {
    flex: 1 1 auto;
    overflow: hidden;
    background-color: var(--background-primary);
    min-height: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .tree-svg {
    user-select: none;
    touch-action: none;
    display: block;
    background-color: var(--tree-bg);
  }

  .node-group {
    cursor: pointer;
  }

  .current-node-shadow {
    filter: url(#shadow);
  }

  .comment-editor {
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    padding: 2px 0px;
    height: auto;
    max-height: 80px;
    overflow-y: auto;
  }

  .comment-editor textarea {
    width: 100%;
    height: auto;
    max-height: 80px;
    resize: none;
    font-family: var(--font-family);
    font-size: var(--font-size-normal);
    color: var(--theme-text-color);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    box-sizing: border-box;
    padding: 0px;
    outline: none;
    overflow-y: auto;
  }

  .comment-editor textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 5px var(--interactive-accent);
  }
</style>
