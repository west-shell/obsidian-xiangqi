<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import * as d3 from "d3";
  import {
    CLS_PREFIX,
    getNodeDisplay,
    getNodeFill,
    getNodeLabel,
    getNodeTextColor,
    getNodeWidth,
    getTreeSpacingX,
    LAYOUT_CHANGE_EVENT,
    NODE_CHAR_DY,
    TREE_LAYOUT_SPACING,
  } from "../../../chess";
  import type { EventBus } from "../../../core/event-bus";
  import { onLangChange, t } from "../../../i18n";
  import type { ChessNode, ISettings, NodeMap } from "../../../types";
  import { GLYPH_BY_KEY } from "../../../utils/annotation-glyphs";
  import { badgeSvg, iconSvg, resultBadgeKeyOf } from "../../../utils/icon";
  import { evalBarIntensity } from "../../../utils/winningChances";
  import type HoverPreview from "./HoverPreview.svelte";
  import { calculateTreeLayout } from "./layout";
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

  const spacingY = 15;
  const nodeHeight = 11;

  let layoutChangeHandler: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let needsInitialReset = $state(false);
  let destroyed = false;

  onDestroy(() => {
    destroyed = true;
    unsubLang();
    eventBus.off("updateUI", onUiVer);
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
    renderedNodes = calculateTreeLayout(
      nodeMap,
      foldedNodes,
      TREE_LAYOUT_SPACING,
    );
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
  let spacingX = $derived(getTreeSpacingX(nodeMode));
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
    nodeMap.size;
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
        M ${node.x! * spacingX} ${node.y! * spacingY}
        L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
        L ${child.x! * spacingX} ${child.y! * spacingY}
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

    {#each renderedNodes as node (node.id)}
      {#if node.children.length > 1}
        {@const isLeft = (node.y ?? 0) % 2 === 0}
        {@const nw = localGetNodeWidth(node)}
        {@const offPathFold = !(
          currentPath.includes(node.id) &&
          node.children[0] &&
          !currentPath.includes(node.children[0].id)
        )}
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
        transform="translate({node.x! * spacingX} {node.y! *
          spacingY}){isCurrent ? ' scale(1.2)' : ''}"
        opacity={currentPath.includes(node.id) ? 1 : 0.55}
        stroke-width={isCurrent ? 1 : 0.5}
        onclick={() => eventBus.emit("node-click", node.id)}
        onmouseenter={(e) => preview?.showNode(node, e)}
        onmouseleave={() => preview?.hideNode(node)}
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
          {@const color =
            node.eval.score > 0 ||
            (node.eval.scoreType === "mate" && node.eval.score >= 0)
              ? `color-mix(in srgb, var(--eval-plus) ${60 + intensity * 40}%, transparent)`
              : node.eval.score < 0 ||
                  (node.eval.scoreType === "mate" && node.eval.score < 0)
                ? `color-mix(in srgb, var(--eval-minus) ${60 + intensity * 40}%, transparent)`
                : `color-mix(in srgb, var(--text-muted) 60%, transparent)`}
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
