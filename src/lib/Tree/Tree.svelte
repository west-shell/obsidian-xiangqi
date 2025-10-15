<script lang="ts">
  import { run } from 'svelte/legacy';

  import { onMount, tick } from "svelte";
  import { PIECE_CHARS, type ChessNode, type NodeMap } from "../../types";
  import { createInteractionHandlers } from "./interact";
  import { calculateTreeLayout } from "./layout";

  interface Props {
    nodeMap: NodeMap;
    eventBus: { emit: (event: string, payload: any) => void };
    currentNode: ChessNode | null;
    currentPath: string[];
  }

  let {
    nodeMap,
    eventBus,
    currentNode = $bindable(),
    currentPath
  }: Props = $props();

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement = $state();

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


  function saveComments() {
    if (!currentNode) return;
    const regularComments = commentsText.split("\n").filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    currentNode.comments = [...existingAnnotations, ...regularComments];
    eventBus.emit("updateUI", null);
    eventBus.emit("updatePGN", null);
  }


  const spacingX = 30;
  const spacingY = 17;

  let renderedNodes: ChessNode[] = $state([]);

  let svgEl: SVGSVGElement = $state();

  let translateX = $state(0);
  let translateY = $state(0);
  let scale = $state(1);

  let handleEvent: (e: Event) => void = $state();

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


  onMount(() => {
    if (nodeMap.size > 0) {
      updateTreeLayout();
      tick().then(centerAndFit);
    }
  });

  /** 自动调整 textarea 高度 */
  function adjustTextareaHeight() {
    const textarea = textareaEl;
    textarea.classList.add("auto-height");
    textarea.style.setProperty("--textarea-height", `${textarea.scrollHeight}px`);
    textarea.classList.remove("auto-height");
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
  run(() => {
    if (currentNode) {
      const node = currentNode;
      commentsText = getRegularComments(node).join("\n");
      tick().then(() => panToNodeIfNeeded(node));
    } else {
      commentsText = "";
    }
  });
  run(() => {
    if (currentNode) {
      const node = currentNode;
      commentsText = getRegularComments(node).join("\n");
      tick().then(() => {
        if (textareaEl) {
          adjustTextareaHeight();
        }
        panToNodeIfNeeded(node);
      });
    } else {
      commentsText = "";
    }
  });
  run(() => {
    if (currentNode) {
      const node = currentNode;
      commentsText = getRegularComments(node).join("\n");
      tick().then(() => panToNodeIfNeeded(node));
    } else {
      commentsText = "";
    }
  });
  run(() => {
    currentNode;
  });
  run(() => {
    nodeMap.size, updateTreeLayout();
  });
</script>

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
            {#if Math.abs(node.x! - child.x!) > 1}
              <line
                x1={node.x! * spacingX}
                y1={node.y! * spacingY}
                x2={(child.x! - Math.sign(child.x! - node.x!)) * spacingX}
                y2={node.y! * spacingY}
                stroke="var(--board-line)"
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
                stroke="var(--board-line)"
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
                stroke="var(--board-line)"
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
            onclick={() => eventBus.emit("node-click", node.id)}
            ondblclick={() => eventBus.emit("node-dblclick", node.id)}
          >
            <rect
              x="-10"
              y="-6"
              width="20"
              height="12"
              rx="3"
              ry="3"
              fill={node.side === "red"
                ? "var(--piece-red)"
                : node.side === "black"
                  ? "var(--piece-black)"
                  : "gray"}
              stroke="var(--board-line)"
              stroke-width={node === currentNode ? 1.5 : 0.5}
            />
            <text dy="3.5" text-anchor="middle" fill="white" font-size="9px">
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
    padding: 0;
    box-sizing: border-box;
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
    box-sizing: border-box;
    padding: 0px;
    outline: none;
    overflow-y: auto;
  }
  /* @css-ignore */
  textarea.auto-height {
    height: auto;
  }

  textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 5px var(--interactive-accent);
  }
</style>
