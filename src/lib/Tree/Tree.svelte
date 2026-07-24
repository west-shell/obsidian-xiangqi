<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { EventBus } from "../../core/event-bus";
  import { type ChessNode, type NodeMap, PIECE_CHARS } from "../../types";
  import { onLangChange, t } from "../../i18n";
  import { calculateTreeLayout } from "./layout";
  import { iconPaths, iconSvg } from "../../utils/icon";
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

  let {
    nodeMap,
    eventBus,
    currentNode = $bindable(),
    currentPath,
  }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  let renderedNodes: ChessNode[] = $state([]);
  let foldedNodes = new SvelteSet<string>();

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

  let nodeMode = $state(0);
  let spacingX = $derived(nodeMode === 0 ? 18 : 22);
  const spacingY = 15;
  const nodeHeight = 11;

  const ANNOTATION_DEFINITIONS: Record<
    string,
    { symbol: string; color: string; icon?: string }
  > = {
    "W+": {
      symbol: "白优",
      color: "var(--piece-red)",
      icon: iconPaths("thumbs-up"),
    },
    "B+": {
      symbol: "黑优",
      color: "var(--piece-black)",
      icon: iconPaths("thumbs-down"),
    },
    "=": { symbol: "均势", color: "green", icon: iconPaths("handshake") },
    "?": {
      symbol: "问题",
      color: "var(--text-warning)",
      icon: iconPaths("bookmark"),
    },
    "!": {
      symbol: "妙手",
      color: "var(--color-yellow)",
      icon: iconPaths("star"),
    },
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
      node.comments?.filter(
        (c) => !ALL_ANNOTATION_KEYS.includes(c) && !SHAPES_RE.test(c),
      ) ?? []
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
  let layoutChangeHandler: (() => void) | null = null;
  let handleSliderMouseMove: ((evt: MouseEvent) => void) | null = null;
  let handleSliderMouseUp: (() => void) | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let needsInitialReset = $state(false);

  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    if (layoutChangeHandler) {
      activeDocument.body.removeEventListener(
        "layout-change",
        layoutChangeHandler,
      );
      layoutChangeHandler = null;
    }
    if (handleSliderMouseMove)
      activeDocument.removeEventListener("mousemove", handleSliderMouseMove);
    if (handleSliderMouseUp)
      activeDocument.removeEventListener("mouseup", handleSliderMouseUp);
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
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
    const regularComments = commentsText
      .split("\n")
      .filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    const existingShapes = getAllShapes(currentNode);
    const newComments = [
      ...existingAnnotations,
      ...existingShapes,
      ...regularComments,
    ];
    const oldComments = currentNode.comments ?? [];
    const changed =
      newComments.length !== oldComments.length ||
      newComments.some((c, i) => c !== oldComments[i]);
    if (!changed) return;
    currentNode.comments = newComments;
    eventBus.emit("updateUI", null);
    eventBus.emit("modified", null);
  }

  // ---- 自动调整文本框高度 ----
  function adjustTextareaHeight() {
    if (!textareaEl) return;
    textareaEl.classList.add("auto-height");
    textareaEl.style.setProperty(
      "--textarea-height",
      `${textareaEl.scrollHeight}px`,
    );
    textareaEl.classList.remove("auto-height");
  }

  // ---- 布局计算 ----
  function updateTreeLayout() {
    renderedNodes = calculateTreeLayout(nodeMap, foldedNodes);
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
    updateTreeLayout();
  }

  function resetView() {
    updateTreeLayout();
    if (!svgEl || !zoomBehavior) return;
    if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
    updateZoomExtent();
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
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    )
      return;
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
    const nodeScreenX = node.x * spacingX * scale + translateX;
    const nodeScreenY = node.y * spacingY * scale + translateY;

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
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    let translateX = tx,
      translateY = ty,
      scale = sc;
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
    return idx !== -1 ? `${idx}/${currentPath.length - 1}` : "";
  });

  let evalChartData = $derived.by(() => {
    if (currentPath.length === 0) return [];
    return currentPath.map((id) => {
      const n = nodeMap.get(id);
      if (!n?.eval) return null;
      if (n.eval.scoreType === "mate")
        return n.eval.score >= 0 ? Infinity : -Infinity;
      return n.eval.score;
    });
  });

  let evalChartMax = $derived.by(() => {
    let max = 0;
    for (const v of evalChartData) {
      if (v !== null && Number.isFinite(v) && Math.abs(v) > max)
        max = Math.abs(v);
    }
    return max || 1;
  });

  let evalChartSegments = $derived.by(() => {
    const data = evalChartData;
    const hasAny = data.some((v) => v !== null);
    if (!hasAny || currentPath.length <= 1) return null;
    const w = 20;
    const midX = w / 2;
    const maxAbs = evalChartMax;
    const scaleX = (w - 2) / 2 / maxAbs;
    const edgeR = w - 1;
    const edgeL = 1;
    const segments: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }[] = [];
    const validIndices: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i] === null) continue;
      validIndices.push(i);
    }
    for (let j = 0; j < validIndices.length - 1; j++) {
      const i1 = validIndices[j];
      const i2 = validIndices[j + 1];
      const v1 = data[i1]!;
      const v2 = data[i2]!;
      const x1 =
        v1 === Infinity ? edgeR : v1 === -Infinity ? edgeL : midX + v1 * scaleX;
      const x2 =
        v2 === Infinity ? edgeR : v2 === -Infinity ? edgeL : midX + v2 * scaleX;
      const color =
        v2 === Infinity || (Number.isFinite(v2) && v2 >= 0)
          ? "#4CAF50"
          : "#f44336";
      const color1 =
        v1 === Infinity || (Number.isFinite(v1) && v1 >= 0)
          ? "#4CAF50"
          : "#f44336";
      if (color1 !== color) {
        segments.push({
          x1,
          y1: i1,
          x2: midX,
          y2: i1 + (i2 - i1) * 0.5,
          color: color1,
        });
        segments.push({
          x1: midX,
          y1: i1 + (i2 - i1) * 0.5,
          x2,
          y2: i2,
          color,
        });
      } else {
        segments.push({ x1, y1: i1, x2, y2: i2, color });
      }
    }
    return { w, h: currentPath.length - 1, midX, segments };
  });

  function toggleCurrentFold() {
    if (!currentNode || currentNode.children.length <= 1) return;
    toggleFold(currentNode);
  }

  const MODE_ICONS = ["club", "align-justify"];
  function cycleNodeMode() {
    nodeMode = (nodeMode + 1) % 2;
  }
  let modeIcon = $derived(MODE_ICONS[nodeMode]);

  function getNodeWidth(node: ChessNode): number {
    if (nodeMode === 0) return 13;
    const zh = node.move?.zh ?? "始";
    return Math.max(13, zh.length * 5.5);
  }

  const toolbarBTN = [
    { title: "放大", icon: "plus", event: zoomIn },
    { title: "缩小", icon: "minus", event: zoomOut },
    {
      title: t("tree.fold"),
      icon: "chevrons-right-left",
      event: toggleCurrentFold,
    },
    { title: "重置", icon: "rotate-ccw", event: resetView },
  ];
  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }

  onMount(() => {
    if (!svgEl) return;

    updateTreeLayout();

    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      // .scaleExtent([0.5, 6])
      .on("zoom", (event) => {
        zoomTransform = event.transform;
      });

    handleSliderMouseMove = (evt: MouseEvent) => {
      if (!sliderMouseDown) return;
      navigateFromSliderY(evt.clientY);
    };
    handleSliderMouseUp = () => {
      sliderMouseDown = false;
    };
    activeDocument.addEventListener("mousemove", handleSliderMouseMove);
    activeDocument.addEventListener("mouseup", handleSliderMouseUp);

    layoutChangeHandler = () => {
      if (!svgEl || svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
      if (needsInitialReset) {
        needsInitialReset = false;
        if (intersectionObserver) {
          intersectionObserver.disconnect();
          intersectionObserver = null;
        }
        updateZoomExtent();
        d3.select(svgEl).call(zoomBehavior);
      }
      resetView();
    };
    activeDocument.body.addEventListener("layout-change", layoutChangeHandler);

    tick()
      .then(() => new Promise(requestAnimationFrame))
      .then(() => {
        if (!svgEl) return;
        if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) {
          needsInitialReset = true;
          intersectionObserver = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting && needsInitialReset) {
                  needsInitialReset = false;
                  requestAnimationFrame(() => {
                    updateZoomExtent();
                    d3.select(svgEl!).call(zoomBehavior!);
                    resetView();
                  });
                  intersectionObserver!.disconnect();
                  intersectionObserver = null;
                }
              }
            },
            { threshold: 0.1 },
          );
          intersectionObserver.observe(svgEl);
          return;
        }
        updateZoomExtent();
        d3.select(svgEl).call(zoomBehavior);
        resetView();
        return undefined;
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

    void tick().then(() => {
      if (textareaEl) adjustTextareaHeight();
      panToNodeIfNeeded(node);
      return undefined;
    });
  });

  $effect(() => {
    // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions
    nodeMap.size;
    updateTreeLayout();
  });
</script>

<div class="tree-container">
  <div class="svg-wrapper">
    {#if nodeMap.get(currentNode?.id ?? "")?.eval}
      {@const ce = nodeMap.get(currentNode!.id)!.eval!}
      {@const isZero = ce.scoreType !== "mate" && ce.score === 0}
      {@const isPositive =
        ce.score > 0 || (ce.scoreType === "mate" && ce.score >= 0)}
      {@const evalColor = isPositive
        ? "rgba(76, 175, 80, 0.8)"
        : "rgba(244, 67, 54, 0.8)"}
      {@const labelBg = isZero
        ? "linear-gradient(to bottom, rgba(76, 175, 80, 0.8) 50%, rgba(244, 67, 54, 0.8) 50%)"
        : evalColor}
      {@const fillPercent =
        ce.scoreType === "mate"
          ? 50
          : Math.min(Math.abs(ce.score) / 300, 1) * 50}
      {@const evalText =
        ce.scoreType === "mate"
          ? (ce.score >= 0 ? "+" : "-") + "M"
          : (ce.score > 0 ? "+" : "") + (ce.score / 100).toFixed(1)}
      <div class="eval-sidebar">
        <div class="eval-bar">
          {#if isPositive}
            <div
              class="eval-fill"
              style="height: {fillPercent}%; top: {50 -
                fillPercent}%; background: {evalColor}"
            ></div>
          {:else}
            <div
              class="eval-fill"
              style="height: {fillPercent}%; top: 50%; background: {evalColor}"
            ></div>
          {/if}
          <div class="eval-center-line"></div>
          <span class="eval-label" style="background: {labelBg}"
            >{evalText}</span
          >
        </div>
      </div>
    {/if}
    <svg bind:this={svgEl} width="100%" height="100%" class="tree-svg">
      <g transform={TRANSFORM_SAFE}>
        <!-- 连线 -->
        {#each renderedNodes as node (node.id)}
          {#each node.children as child, idx (child.id)}
            {#if !(foldedNodes.has(node.id) && idx > 0)}
              <path
                d={`
              M ${node.x! * spacingX} ${node.y! * spacingY}
              L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
              L ${child.x! * spacingX} ${child.y! * spacingY}
              `}
                stroke="var(--xq-board-line)"
                stroke-linejoin="round"
                stroke-width={currentPath.includes(node.id) &&
                currentPath.includes(child.id)
                  ? 1.5
                  : 1}
                opacity={currentPath.includes(node.id) &&
                currentPath.includes(child.id)
                  ? 1.5
                  : 0.7}
                filter={currentPath.includes(node.id) &&
                currentPath.includes(child.id)
                  ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                  : "grayscale(50%) brightness(0.75)"}
                fill="none"
              />
            {/if}
          {/each}
        {/each}

        {#each renderedNodes as node (node.id)}
          {#if node.children.length > 1}
            {@const isLeft = (node.y ?? 0) % 2 === 0}
            {@const nw = getNodeWidth(node)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g
              transform="translate({node.x! * spacingX +
                (isLeft ? -nw / 2 : nw / 2)} {node.y! * spacingY}){node.id ===
              currentNode?.id
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
                fill="var(--xq-board-line)"
                stroke="var(--xq-board-line)"
                stroke-width="1.5"
                stroke-linejoin="round"
                opacity={currentPath.includes(node.id) &&
                node.children[0] &&
                !currentPath.includes(node.children[0].id)
                  ? 1.5
                  : 0.7}
                filter={currentPath.includes(node.id) &&
                node.children[0] &&
                !currentPath.includes(node.children[0].id)
                  ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                  : "grayscale(50%) brightness(0.75)"}
              />
            </g>
          {/if}
        {/each}

        <!-- 节点 -->
        {#each renderedNodes as node (node.id)}
          {@const primaryAnnotation = getPrimaryAnnotation(node)}
          {@const nw = getNodeWidth(node)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group"
            transform="translate({node.x! * spacingX} {node.y! *
              spacingY}){node.id === currentNode?.id ? ' scale(1.2)' : ''}"
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
              <rect
                x={-nw / 2}
                y={-nodeHeight / 2}
                width={nw}
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
              <g
                transform="translate(-4, -4) scale(0.333)"
                fill={node.side === "white"
                  ? "var(--piece-red)"
                  : "var(--piece-black)"}
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html def.icon}
              </g>
            {:else}
              <rect
                x={-nw / 2}
                y={-nodeHeight / 2}
                width={nw}
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
              {#if nodeMode === 0}
                <text
                  dy="3.5"
                  text-anchor="middle"
                  fill="white"
                  font-size="9px"
                >
                  {node.move?.piece ? pieceLabel(node.move) : "始"}
                </text>
              {:else}
                <text
                  dominant-baseline="central"
                  text-anchor="middle"
                  fill="white"
                  font-size="5px"
                >
                  {node.move?.zh ?? "始"}
                </text>
              {/if}
            {/if}
            {#if node.eval}
              {@const intensity =
                node.eval.scoreType === "mate"
                  ? 1
                  : Math.min(Math.abs(node.eval.score) / 300, 1)}
              {@const color =
                node.eval.score > 0 ||
                (node.eval.scoreType === "mate" && node.eval.score >= 0)
                  ? `rgba(76, 175, 80, ${0.6 + intensity * 0.4})`
                  : node.eval.score < 0 ||
                      (node.eval.scoreType === "mate" && node.eval.score < 0)
                    ? `rgba(244, 67, 54, ${0.6 + intensity * 0.4})`
                    : `rgba(136, 136, 136, 0.6)`}
              {@const barWidth = 2 + intensity * (nw - 4)}
              <rect
                x={-barWidth / 2}
                y={nodeHeight / 2 - 0.5}
                width={barWidth}
                height="1.5"
                rx="0.5"
                fill={color}
                style="pointer-events: none"
              />
            {/if}
            {#if getRegularComments(node).length > 0}
              <g
                transform="translate({0.3 * nw} {-0.8 * nodeHeight})"
                style="pointer-events: none"
              >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html iconSvg("message-square-text", 8, 1.5, "royalblue")}
              </g>
            {/if}
          </g>
        {/each}
      </g>
    </svg>

    <div class="toolbar">
      {#each toolbarBTN as btn, i (i)}
        <button
          class="toolbar-btn"
          aria-label={btn.title}
          use:useSetIcon={btn.icon}
          onclick={btn.event}
        ></button>
      {/each}
      <button
        class="toolbar-btn"
        aria-label="切换模式"
        use:useSetIcon={modeIcon}
        onclick={cycleNodeMode}
      ></button>
    </div>

    <div
      class="slider"
      class:active={sliderMouseDown}
      class:has-eval={!!evalChartSegments}
    >
      <button
        class="slider-btn slider-to-start"
        aria-label="To start"
        use:useSetIcon={"minus"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "toStart", payload: null })}
      ></button>
      <button
        class="slider-btn slider-prev"
        aria-label="Previous"
        use:useSetIcon={"arrow-up"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "back", payload: null })}
      ></button>
      <div
        role="slider"
        tabindex={-1}
        aria-valuenow={sliderPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        bind:this={sliderInnerEl}
        class="slider-inner"
        onmousedown={handleSliderAreaMouseDown}
      >
        {#if evalChartSegments}
          <svg
            width={evalChartSegments.w}
            height="100%"
            viewBox="0 0 {evalChartSegments.w} {evalChartSegments.h}"
            preserveAspectRatio="none"
            class="eval-chart-bg"
          >
            <line
              x1={evalChartSegments.midX}
              y1="0"
              x2={evalChartSegments.midX}
              y2={evalChartSegments.h}
              stroke="var(--text-faint)"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
            {#each evalChartSegments.segments as seg, i (i)}
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={seg.color}
                stroke-width="1"
                vector-effect="non-scaling-stroke"
              />
            {/each}
          </svg>
        {/if}
        <span class="slider-thumb" style="top: {sliderPercent}%"></span>
        {#if sliderText}
          <span
            role="presentation"
            class="slider-label"
            style="top: {sliderPercent}%"
            onmousedown={handleSliderAreaMouseDown}>{sliderText}</span
          >
        {/if}
      </div>
      <button
        class="slider-btn slider-next"
        aria-label="Next"
        use:useSetIcon={"arrow-down"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "next", payload: null })}
      ></button>
      <button
        class="slider-btn slider-to-end"
        aria-label="To end"
        use:useSetIcon={"minus"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "toEnd", payload: null })}
      ></button>
    </div>
  </div>

  <textarea
    bind:value={commentsText}
    class="auto-height"
    placeholder={t("tree.placeholder")}
    bind:this={textareaEl}
    oninput={handleCommentsInput}
    onblur={handleCommentsBlur}
    rows="1"></textarea>
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

  .eval-sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    z-index: 2;
    pointer-events: none;
  }

  .eval-bar {
    position: relative;
    flex: 1 1 auto;
    width: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
  }

  .eval-fill {
    position: absolute;
    left: 0;
    right: 0;
    border-radius: 2px;
    transition:
      height 0.3s ease,
      top 0.3s ease,
      background 0.3s ease;
  }

  .eval-center-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 0;
  }

  .eval-label {
    position: absolute;
    top: 50%;
    left: calc(100% + 4px);
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
    pointer-events: none;
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

  .slider.has-eval {
    width: 20px;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
  }

  .eval-chart-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
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
    transition:
      color 0.2s,
      background 0.2s;
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
    content: "";
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
