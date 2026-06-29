<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { EventBus } from "../../core/event-bus";
  import { type ChessNode, type NodeMap, PIECE_CHARS } from "../../types";
  import { t } from "../../i18n";
  import { calculateTreeLayout } from "./layout";
  import { iconPaths } from "../../utils/icon";
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
  let foldedNodes = $state(new Set<string>());

  // ---- D3 Zoom ----
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  const TRANSFORM_SAFE = $derived.by(() => {
    const t = zoomTransform;
    if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.k)) {
      return 'translate(0,0) scale(1)';
    }
    return `translate(${t.x},${t.y}) scale(${t.k})`;
  });

  const spacingX = 22;
  const spacingY = 15;
  const nodeWidth = 13;
  const nodeHeight = 11;

  const ANNOTATION_DEFINITIONS: Record<string, { symbol: string; color: string; icon?: string }> = {
    "W+": { symbol: "白优", color: "var(--piece-red)", icon: iconPaths("thumbs-up") },
    "B+": { symbol: "黑优", color: "var(--piece-black)", icon: iconPaths("thumbs-down") },
    "=": { symbol: "均势", color: "green", icon: iconPaths("handshake") },
    "?": { symbol: "问题", color: "var(--text-warning)", icon: iconPaths("bookmark") },
    "!": { symbol: "妙手", color: "var(--color-yellow)", icon: iconPaths("star") },
    "W#": { symbol: "白胜", color: "red", icon: iconPaths("thumbs-up") },
    "B#": { symbol: "黑胜", color: "black", icon: iconPaths("thumbs-up") },
    "=#": { symbol: "和棋", color: "gray", icon: iconPaths("handshake") },
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

  const SHAPES_RE = /^([a-i][0-9])([a-i][0-9])?:([gryb])$/;

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
    eventBus.emit("modified", null);
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
    renderedNodes = calculateTreeLayout(nodeMap, foldedNodes);
  }

  function toggleFold(node: ChessNode) {
    const cur = foldedNodes.has(node.id);
    if (cur) {
      foldedNodes.delete(node.id);
    } else {
      foldedNodes.add(node.id);
    }
    foldedNodes = new Set(foldedNodes);
    updateTreeLayout();
  }

  function resetView() {
    updateTreeLayout();
    if (!svgEl || !zoomBehavior) return;
    if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
    const padding = 40;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of renderedNodes) {
      if (n.x === undefined || n.y === undefined) continue;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;
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
    const { x: tx, y: ty, k: sc } = zoomTransform;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc)) return;
    const { clientWidth, clientHeight } = svgEl;
    const padding = 50;
    let translateX = tx, translateY = ty, scale = sc;
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
    const { x: tx, y: ty, k: sc } = zoomTransform;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc)) return;
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    let translateX = tx, translateY = ty, scale = sc;
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

  let sliderMouseDown = $state(false);
  let sliderInnerEl: HTMLDivElement | undefined = $state();

  function handleSliderAreaMouseDown(evt: MouseEvent) {
    if (evt.button !== 0) return;
    sliderMouseDown = true;
    navigateFromSliderY(evt.clientY);
  }

  function navigateFromSliderY(clientY: number) {
    if (!sliderInnerEl || currentPath.length <= 1) return;
    const { top, height } = sliderInnerEl.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientY - top) / height));
    const idx = Math.round(percent * (currentPath.length - 1));
    const targetId = currentPath[idx];
    if (targetId && targetId !== currentNode?.id) {
      eventBus.emit("slider-navigate", targetId);
    }
  }

  let sliderPercent = $derived.by(() => {
    if (!currentNode || currentPath.length <= 1) return 0;
    const idx = currentPath.indexOf(currentNode.id);
    if (idx === -1) return 0;
    return (idx / (currentPath.length - 1)) * 100;
  });

  let sliderText = $derived.by(() => {
    if (!currentNode || currentPath.length <= 1) return "";
    const idx = currentPath.indexOf(currentNode.id);
    return idx !== -1 ? `${idx + 1}/${currentPath.length}` : "";
  });

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

    const handleSliderMouseMove = (evt: MouseEvent) => {
      if (!sliderMouseDown) return;
      navigateFromSliderY(evt.clientY);
    };
    const handleSliderMouseUp = () => {
      sliderMouseDown = false;
    };
    document.addEventListener("mousemove", handleSliderMouseMove);
    document.addEventListener("mouseup", handleSliderMouseUp);
    onDestroy(() => {
      document.removeEventListener("mousemove", handleSliderMouseMove);
      document.removeEventListener("mouseup", handleSliderMouseUp);
    });
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
      <g transform={TRANSFORM_SAFE}>
        <!-- 连线 -->
        {#each renderedNodes as node}
          {#each node.children as child, idx}
            {#if !(foldedNodes.has(node.id) && idx > 0)}
            <path
              d={`
              M ${node.x! * spacingX} ${node.y! * spacingY}
              L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
              L ${child.x! * spacingX} ${child.y! * spacingY}
              `}
              stroke="var(--xq-board-line)"
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
            {/if}
          {/each}
        {/each}

        <!-- 节点 -->
        {#each renderedNodes as node (node.id)}
          {@const primaryAnnotation = getPrimaryAnnotation(node)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group"
            transform="translate({node.x! * spacingX} {node.y! * spacingY}){node.id === currentNode?.id ? ' scale(1.35)' : ''}"
            opacity={currentPath.includes(node.id) ? 1 : 0.8}
            filter={!currentPath.includes(node.id)
              ? "grayscale(100%) brightness(0.75)"
              : node.id === currentNode?.id
                ? "drop-shadow(0 0 4px var(--interactive-accent))"
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
                fill={node.side === "white"
                  ? "var(--piece-red)"
                  : node.side === "black"
                    ? "var(--piece-black)"
                    : "green"}
                stroke="var(--xq-board-line)"
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
                {@html iconPaths("message-square-text")}
              </g>
            {/if}

            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            {#if node.children.length > 1}
              {@const isLeft = (node.y ?? 0) % 2 === 0}
              <g transform="translate({isLeft ? -nodeWidth / 2 : nodeWidth / 2}, 0)" style="cursor: pointer" onclick={(e) => { e.stopPropagation(); toggleFold(node); }}>
                <polygon
                  points={foldedNodes.has(node.id)
                    ? (isLeft ? "0,-4 0,4 -3,3 -3,-3" : "0,-4 0,4 3,3 3,-3")
                    : (isLeft ? "0,-4 0,4 -5,0" : "0,-4 0,4 5,0")}
                  fill="var(--xq-board-line)"
                  stroke="var(--xq-board-line)"
                  stroke-width="1"
                  stroke-linejoin="round"
                  opacity={currentPath.includes(node.id) && node.children[0] && !currentPath.includes(node.children[0].id) ? 1.5 : 0.7}
                  filter={currentPath.includes(node.id) && node.children[0] && !currentPath.includes(node.children[0].id)
                    ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                    : "grayscale(50%) brightness(0.75)"}
                />
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

    <div class="slider" class:active={sliderMouseDown}>
      <button class="slider-btn slider-to-start" aria-label="To start" use:useSetIcon={"minus"} onclick={() => eventBus.emit('btn-click', { name: 'toStart', payload: null })}></button>
      <button class="slider-btn slider-prev" aria-label="Previous" use:useSetIcon={"arrow-up"} onclick={() => eventBus.emit('btn-click', { name: 'back', payload: null })}></button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={sliderInnerEl}
        class="slider-inner"
        onmousedown={handleSliderAreaMouseDown}
      >
        <span class="slider-thumb" style="top: {sliderPercent}%"></span>
        {#if sliderText}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span class="slider-label" style="top: {sliderPercent}%" onmousedown={handleSliderAreaMouseDown}>{sliderText}</span>
        {/if}
      </div>
      <button class="slider-btn slider-next" aria-label="Next" use:useSetIcon={"arrow-down"} onclick={() => eventBus.emit('btn-click', { name: 'next', payload: null })}></button>
      <button class="slider-btn slider-to-end" aria-label="To end" use:useSetIcon={"minus"} onclick={() => eventBus.emit('btn-click', { name: 'toEnd', payload: null })}></button>
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
    --xq-board-background: var(--background-primary-alt);
    --xq-board-line: var(--text-normal);
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
    --text-color: var(--text-normal);
  }

  :global(.tree-codeblock .tree-view.right) .tree-container {
    height: calc(var(--xq-cell-size, 50px) * 10);
  }

  :global(.tree-codeblock .tree-view.bottom) .tree-container {
    height: calc(var(--xq-cell-size, 50px) * 6);
  }

  .svg-wrapper {
    flex: 1 1 auto;
    overflow: hidden;
    background-color: var(--xq-board-background);
    position: relative;
    width: 100%;
    height: 100%;
  }

  .toolbar {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
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

  .slider {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 6px;
    background: var(--background-modifier-border);
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 3px;
    margin: 6px;
  }

  .slider-btn {
    width: 16px;
    height: 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    color: var(--text-muted);
    font-size: 0.55em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    transition: color 0.2s, background 0.2s;
  }
  .slider-btn + .slider-btn {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    margin-top: -1px;
  }
  .slider-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
  .slider-btn:active {
    color: var(--text-on-accent);
    background: var(--interactive-accent);
  }

  .slider-inner {
    flex: 1 1 auto;
    width: 100%;
    position: relative;
    cursor: pointer;
  }

  .slider-thumb {
    position: absolute;
    left: -2px;
    right: -2px;
    height: 6px;
    margin-top: -3px;
    background: var(--interactive-accent);
    border-radius: 3px;
    transition: top 0.2s;
  }
  .slider.active .slider-thumb {
    transition: none;
  }

  .slider-label {
    position: absolute;
    right: calc(100% + 8px);
    height: 18px;
    margin-top: -9px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 0.6em;
    line-height: 18px;
    text-align: center;
    padding: 0 4px;
    border-radius: 3px;
    white-space: nowrap;
    cursor: pointer;
    transition: top 0.2s;
  }
  .slider.active .slider-label {
    transition: none;
  }
  .slider-label::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -4px;
    transform: translateY(-50%);
    border: 4px solid transparent;
    border-left-color: var(--interactive-accent);
    border-right: none;
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
