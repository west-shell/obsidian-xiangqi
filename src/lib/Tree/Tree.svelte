<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { EventBus } from "../../core/event-bus";
  import {
    type ChessNode,
    type GameSlot,
    type ISettings,
    type NodeMap,
  } from "../../types";
  import {
    getMoveListSideClass,
    getMoveNotation,
    getNodeDisplay,
    getNodeFill,
    getNodeLabel,
    getNodeTextColor,
    getNodeWidth,
    getStartLabel,
    LAYOUT_CHANGE_EVENT,
    NODE_CHAR_DY,
    PRIMARY_PLAYER_KEY,
    TREE_LAYOUT_SPACING,
    TREE_SPACING_X,
  } from "../../chess";
  import { Menu, setIcon } from "obsidian";
  import { onLangChange, t } from "../../i18n";
  import { calculateTreeLayout } from "./layout";
  import { badgeSvg, iconSvg } from "../../utils/icon";
  import { scrollToBTN } from "../../utils/utils";
  import * as d3 from "d3";

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
    settings?: ISettings;
    games?: GameSlot[];
    currentGameIndex?: number;
    isBlockMode?: boolean;
  }

  let {
    nodeMap,
    eventBus,
    currentNode = $bindable(),
    currentPath,
    settings,
    games = [],
    currentGameIndex = 0,
    isBlockMode = false,
  }: Props = $props();

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();
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

  // ---- List mode ----
  let listMoves = $derived(
    currentPath
      .map((id) => nodeMap.get(id)!)
      .filter((n): n is ChessNode => n != null && n.move !== null),
  );
  let listCurrentStep = $derived(currentPath.indexOf(currentNode?.id ?? ""));
  let listItemRefs: HTMLLIElement[] = [];
  let listUlRef: HTMLUListElement | null = $state(null);

  $effect(() => {
    const step = listCurrentStep;
    void listMoves;
    (async () => {
      await tick();
      if (destroyed) return;
      const index = step <= 0 ? 0 : Math.ceil(step / 2);
      const targetEl = listItemRefs[index];
      if (targetEl) {
        scrollToBTN(targetEl, listUlRef);
      }
    })();
  });

  let gameIndexChanged = $state(false);
  $effect(() => {
    void currentGameIndex;
    if (!gameIndexChanged) {
      gameIndexChanged = true;
      return;
    }
    (async () => {
      await tick();
      if (destroyed) return;
      resetView();
    })();
  });

  function onClickStep(step: number) {
    const nodeId = step === 0 ? currentPath[0] : currentPath[step];
    if (nodeId) eventBus.emit("slider-navigate", nodeId);
  }

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

  const spacingX = TREE_SPACING_X;
  const spacingY = 15;
  const nodeHeight = 11;

  // ---- 自动保存逻辑 ----
  let saveTimeout: number | undefined;

  function handleCommentsInput() {
    adjustTextareaHeight();

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      saveComments();
      saveTimeout = undefined;
    }, 700);
  }

  let layoutChangeHandler: (() => void) | null = null;
  let handleSliderMouseMove: ((evt: MouseEvent) => void) | null = null;
  let handleSliderMouseUp: (() => void) | null = null;
  let handleSliderTouchMove: ((evt: TouchEvent) => void) | null = null;
  let handleSliderTouchEnd: (() => void) | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let needsInitialReset = $state(false);
  let destroyed = false;

  onDestroy(() => {
    destroyed = true;
    unsubLang();
    eventBus.off("updateUI", onUiVer);
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    if (layoutChangeHandler) {
      activeDocument.body.removeEventListener(
        LAYOUT_CHANGE_EVENT,
        layoutChangeHandler,
      );
      layoutChangeHandler = null;
    }
    if (handleSliderMouseMove)
      activeDocument.removeEventListener("mousemove", handleSliderMouseMove);
    if (handleSliderMouseUp)
      activeDocument.removeEventListener("mouseup", handleSliderMouseUp);
    if (handleSliderTouchMove)
      activeDocument.removeEventListener("touchmove", handleSliderTouchMove);
    if (handleSliderTouchEnd)
      activeDocument.removeEventListener("touchend", handleSliderTouchEnd);
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
  });

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
    const oldComments = currentNode.comments ?? [];
    const changed =
      regularComments.length !== oldComments.length ||
      regularComments.some((c, i) => c !== oldComments[i]);
    currentNode.comments = regularComments;
    eventBus.emit("updateUI");
    if (changed) eventBus.emit("modified");
  }

  function adjustTextareaHeight() {
    if (!textareaEl) return;
    textareaEl.classList.add("auto-height");
    textareaEl.style.setProperty(
      "--textarea-height",
      `${textareaEl.scrollHeight}px`,
    );
    textareaEl.classList.remove("auto-height");
  }

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

  let sliderDragging = $state(false);
  let sliderInnerEl: HTMLDivElement | undefined = $state();

  function handleSliderAreaMouseDown(evt: MouseEvent) {
    if (evt.button !== 0) return;
    sliderDragging = true;
    navigateFromSliderY(evt.clientY);
  }

  function handleSliderLabelTouchStart(evt: TouchEvent) {
    evt.preventDefault();
    sliderDragging = true;
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
      const s = n.eval.score;
      return Number.isFinite(s) ? s : null;
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
    if (!Number.isFinite(maxAbs) || maxAbs === 0) return null;
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
          ? "var(--chess-eval-plus)"
          : "var(--chess-eval-minus)";
      const color1 =
        v1 === Infinity || (Number.isFinite(v1) && v1 >= 0)
          ? "var(--chess-eval-plus)"
          : "var(--chess-eval-minus)";
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

  let nodeMode = $state(0);
  const MODE_ICONS = ["club", "align-justify"];
  function cycleNodeMode() {
    nodeMode = (nodeMode + 1) % 2;
  }

  // svelte-ignore state_referenced_locally
  let listVisible = $state(settings?.showMovelist ?? true);
  function toggleListVisible() {
    listVisible = !listVisible;
    void tick().then(() => {
      if (destroyed) return undefined;
      resetView();
      return undefined;
    });
  }

  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);

  let _uiVer = $state(0);
  const onUiVer = () => {
    _uiVer++;
  };
  onMount(() => {
    eventBus.on("updateUI", onUiVer);
  });

  let showGameNav = $derived(games && games.length > 1 && !isBlockMode);
  let hasHeaders = $derived.by(() => {
    void _uiVer;
    if (!games || games.length === 0) return false;
    const slot = games[currentGameIndex ?? 0];
    return slot ? slot.headers.size > 0 : false;
  });
  let showGameInfo = $derived(
    games != null && games.length > 0 && (hasHeaders || !isBlockMode),
  );
  let gameLabel = $derived(
    showGameNav
      ? t("game.label", _lv)
          .replace("{current}", String((currentGameIndex ?? 0) + 1))
          .replace("{total}", String(games!.length))
      : "",
  );
  let gameTitle = $derived.by(() => {
    void _uiVer;
    if (!showGameInfo) return "";
    const slot = games![currentGameIndex ?? 0];
    if (!slot) return "";
    const h = slot.headers;
    const white = h.get(PRIMARY_PLAYER_KEY) || "?";
    const black = h.get("Black") || "?";
    const event = h.get("Event") || "";
    const date = h.get("Date") || "";
    const resultRaw = h.get("Result") || "";
    const result = formatResult(resultRaw, _lv);
    return `${white} ${result} ${black}${event ? ", " + event : ""}${date ? " " + date : ""}`;
  });

  function formatResult(raw: string, v: number): string {
    if (!raw || raw === "*") return "-";
    if (raw === "1-0") return t("game.win", v);
    if (raw === "0-1") return t("game.loss", v);
    if (raw === "1/2-1/2") return t("game.draw", v);
    return raw;
  }

  function prevGame() {
    const idx = (currentGameIndex ?? 0) - 1;
    if (idx >= 0) eventBus.emit("switch-game", idx);
  }
  function nextGame() {
    const idx = (currentGameIndex ?? 0) + 1;
    if (games && idx < games.length) eventBus.emit("switch-game", idx);
  }
  function handleGameMenu(evt: MouseEvent) {
    if (!games) return;
    const menu = new Menu();
    games.forEach((slot, i) => {
      const h = slot.headers;
      const white = h.get(PRIMARY_PLAYER_KEY) || "?";
      const black = h.get("Black") || "?";
      const event = h.get("Event") || "";
      const date = h.get("Date") || "";
      const resultRaw = h.get("Result") || "";
      const result = formatResult(resultRaw, _lv);
      const label = `${i + 1}. ${white} ${result} ${black}${event ? ", " + event : ""}${date ? " " + date : ""}`;
      menu.addItem((mi) => {
        mi.setTitle(label)
          .setChecked(i === (currentGameIndex ?? 0))
          .onClick(() => eventBus.emit("switch-game", i));
      });
    });
    menu.addSeparator();
    if (!isBlockMode) {
      menu.addItem((mi) => {
        mi.setTitle(t("game.new", _lv))
          .setIcon("plus")
          .onClick(() => eventBus.emit("create-game"));
      });
    }
    const idx = currentGameIndex ?? 0;
    if (!isBlockMode && games.length > 1) {
      menu.addItem((mi) => {
        mi.setTitle(t("game.moveUp", _lv))
          .setIcon("arrow-up")
          .setDisabled(idx <= 0)
          .onClick(() => eventBus.emit("move-game", -1));
      });
      menu.addItem((mi) => {
        mi.setTitle(t("game.moveDown", _lv))
          .setIcon("arrow-down")
          .setDisabled(idx >= games.length - 1)
          .onClick(() => eventBus.emit("move-game", 1));
      });
      menu.addItem((mi) => {
        mi.setTitle(t("game.delete", _lv))
          .setIcon("trash")
          .onClick(() => eventBus.emit("delete-game"));
      });
    }
    menu.showAtMouseEvent(evt);
  }

  function toggleCurrentFold() {
    if (!currentNode || currentNode.children.length <= 1) return;
    toggleFold(currentNode);
  }

  let canFold = $derived((currentNode?.children?.length ?? 0) > 1);
  let zoomBTN = $derived([
    { title: t("tree.zoomIn", _lv), icon: "plus", event: zoomIn },
    { title: t("tree.zoomOut", _lv), icon: "minus", event: zoomOut },
    { title: t("tree.resetView", _lv), icon: "rotate-ccw", event: resetView },
  ]);
  let nodeModeTitle = $derived(t("tree.nodeMode", _lv));

  function nodeLabel(node: ChessNode): string {
    return getNodeLabel(node.move, nodeMode);
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
    return getNodeWidth(node.move, nodeMode, measureTextWidth);
  }
  let modeIcon = $derived(MODE_ICONS[nodeMode]);
  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
    return {
      update(newIcon: string) {
        setIcon(el, newIcon);
      },
    };
  }

  onMount(() => {
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

    handleSliderMouseMove = (evt: MouseEvent) => {
      if (!sliderDragging) return;
      navigateFromSliderY(evt.clientY);
    };
    handleSliderMouseUp = () => {
      sliderDragging = false;
    };
    activeDocument.addEventListener("mousemove", handleSliderMouseMove);
    activeDocument.addEventListener("mouseup", handleSliderMouseUp);

    handleSliderTouchMove = (evt: TouchEvent) => {
      if (!sliderDragging) return;
      evt.preventDefault();
      navigateFromSliderY(evt.touches[0].clientY);
    };
    handleSliderTouchEnd = () => {
      sliderDragging = false;
    };
    activeDocument.addEventListener("touchmove", handleSliderTouchMove, {
      passive: false,
    });
    activeDocument.addEventListener("touchend", handleSliderTouchEnd);

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
    activeDocument.body.addEventListener(
      "chess-layout-change",
      layoutChangeHandler,
    );

    tick()
      .then(() => new Promise(requestAnimationFrame))
      .then(() => {
        if (destroyed || !svgEl) return;
        if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) {
          needsInitialReset = true;
          intersectionObserver = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting && needsInitialReset) {
                  needsInitialReset = false;
                  requestAnimationFrame(() => {
                    if (destroyed) return;
                    updateZoomExtent();
                    d3.select(svgEl!).call(zoomBehavior!);
                    resetView();
                    if (textareaEl) adjustTextareaHeight();
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

  $effect(() => {
    if (!currentNode) {
      commentsText = "";
      return;
    }
    const node = currentNode;
    commentsText = (node.comments ?? []).join("\n");
    tick().then(() => {
      if (destroyed) return;
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

<div class="tree-container chess-layout__tools">
  {#if showGameInfo}
    <div class="game-nav-bar">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="game-nav-info"
        role={isBlockMode ? undefined : "button"}
        tabindex={isBlockMode ? undefined : 0}
        onclick={isBlockMode ? undefined : handleGameMenu}
        onkeydown={isBlockMode
          ? undefined
          : (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ")
                handleGameMenu(e as unknown as MouseEvent);
            }}
      >
        <span class="game-nav-title">{gameTitle}</span>
        {#if showGameNav}
          <span class="game-nav-index">{gameLabel}</span>
        {/if}
      </div>
      {#if showGameNav}
        <div class="game-nav-arrows">
          <button
            class="toolbar-btn game-nav-arrow"
            aria-label={t("game.prev", _lv)}
            disabled={currentGameIndex <= 0}
            use:useSetIcon={"chevron-left"}
            onclick={prevGame}
          ></button>
          <button
            class="toolbar-btn game-nav-arrow"
            aria-label={t("game.next", _lv)}
            disabled={!games || currentGameIndex >= games.length - 1}
            use:useSetIcon={"chevron-right"}
            onclick={nextGame}
          ></button>
        </div>
      {/if}
      {#if !isBlockMode}
        <button
          class="toolbar-btn game-nav-arrow game-nav-menu-btn"
          aria-label={t("game.select", _lv)}
          use:useSetIcon={"list"}
          onclick={handleGameMenu}
        ></button>
      {/if}
    </div>
  {/if}
  <div class="tools-row">
    <div class="svg-wrapper">
      {#if nodeMap.get(currentNode?.id ?? "")?.eval}
        {@const ce = nodeMap.get(currentNode!.id)!.eval!}
        {@const isZero = ce.scoreType !== "mate" && ce.score === 0}
        {@const isPositive =
          ce.score > 0 || (ce.scoreType === "mate" && ce.score >= 0)}
        {@const evalColor = isPositive
          ? "var(--chess-eval-plus)"
          : "var(--chess-eval-minus)"}
        {@const labelBg = isZero
          ? "linear-gradient(to bottom, var(--chess-eval-plus) 50%, var(--chess-eval-minus) 50%)"
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
          {#each renderedNodes as node (node.id)}
            {#each node.children as child, idx (node.id + "-" + idx)}
              {#if !(foldedNodes.has(node.id) && idx > 0)}
                {@const onPath =
                  currentPath.includes(node.id) &&
                  currentPath.includes(child.id)}
                <path
                  d={`
              M ${node.x! * spacingX} ${node.y! * spacingY}
              L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
              L ${child.x! * spacingX} ${child.y! * spacingY}
              `}
                  stroke="var(--chess-board-line)"
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
                  fill="var(--chess-board-line)"
                  stroke="var(--chess-board-line)"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                  opacity={offPathFold ? 0.5 : 1}
                />
              </g>
            {/if}
          {/each}

          {#each sortedRenderedNodes as node (node.id)}
            {@const nw = localGetNodeWidth(node)}
            {@const primaryAnnotation = node.annotation}
            {@const isCurrent = node.id === currentNode?.id}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g
              class="node-group"
              transform="translate({node.x! * spacingX} {node.y! *
                spacingY}){isCurrent ? ' scale(1.2)' : ''}"
              opacity={currentPath.includes(node.id) ? 1 : 0.55}
              filter={isCurrent
                ? "drop-shadow(0 0 4px var(--color-accent))"
                : undefined}
              stroke-width={isCurrent ? 1 : 0.5}
              onclick={() => eventBus.emit("node-click", node.id)}
            >
              <rect
                x={-nw / 2}
                y={-nodeHeight / 2}
                width={nw}
                height={nodeHeight}
                rx="2.5"
                ry="2.5"
                fill={isCurrent
                  ? "var(--color-accent)"
                  : getNodeFill(node.color)}
                stroke={isCurrent
                  ? getNodeFill(node.color)
                  : "var(--chess-board-line)"}
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
                {@const intensity =
                  node.eval.scoreType === "mate"
                    ? 1
                    : Math.min(Math.abs(node.eval.score) / 300, 1)}
                {@const color =
                  node.eval.score > 0 ||
                  (node.eval.scoreType === "mate" && node.eval.score >= 0)
                    ? `color-mix(in srgb, var(--chess-eval-plus) ${60 + intensity * 40}%, transparent)`
                    : node.eval.score < 0 ||
                        (node.eval.scoreType === "mate" && node.eval.score < 0)
                      ? `color-mix(in srgb, var(--chess-eval-minus) ${60 + intensity * 40}%, transparent)`
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
                <g
                  transform="translate({-nw / 2} {nodeHeight / 2})"
                  style="pointer-events: none"
                >
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html badgeSvg(primaryAnnotation)}
                </g>
              {/if}
              {#if node.result}
                <g
                  transform="translate({-nw / 2} {-nodeHeight / 2})"
                  style="pointer-events: none"
                >
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html badgeSvg(`result_${node.result}`)}
                </g>
              {:else if node.isCheckmate}
                <g
                  transform="translate({-nw / 2} {-nodeHeight / 2})"
                  style="pointer-events: none"
                >
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html badgeSvg("checkmate")}
                </g>
              {/if}
              {#if node.glyph && settings?.showEngineAnnotations !== false}
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
                  transform="translate({0.3 * nw} {-0.65 * nodeHeight})"
                  style="pointer-events: none"
                >
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html iconSvg(
                    "message_square_text",
                    7,
                    1.5,
                    "var(--color-blue)",
                  )}
                </g>
              {/if}
            </g>
          {/each}
        </g>
      </svg>

      <div class="toolbar toolbar-group">
        {#if canFold}
          <button
            class="toolbar-btn"
            aria-label={t("tree.fold", _lv)}
            use:useSetIcon={"chevrons-right-left"}
            onclick={toggleCurrentFold}
          ></button>
        {/if}
        {#each zoomBTN as { title, icon, event } (event)}
          <button
            class="toolbar-btn"
            aria-label={title}
            use:useSetIcon={icon}
            onclick={event}
          ></button>
        {/each}
        <button
          class="toolbar-btn"
          aria-label={nodeModeTitle}
          use:useSetIcon={modeIcon}
          onclick={cycleNodeMode}
        ></button>
      </div>

      <div
        class="slider"
        class:active={sliderDragging}
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
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="slider-label"
              style="top: {sliderPercent}%"
              onmousedown={handleSliderAreaMouseDown}
              ontouchstart={handleSliderLabelTouchStart}>{sliderText}</span
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
    {#if listVisible}
      <ul class="move-list" bind:this={listUlRef}>
        <li class="start" bind:this={listItemRefs[0]}>
          <span class="roundnum">0</span>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="move start"
            class:active={listCurrentStep === 0}
            onclick={() => onClickStep(0)}
          >
            {getStartLabel()}
          </span>
        </li>
        {#each listMoves as move, i (i)}
          {#if i % 2 === 0}
            <li class="round" bind:this={listItemRefs[i / 2 + 1]}>
              <span class="roundnum">{i / 2 + 1}</span>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span
                class="move {getMoveListSideClass(move.color)}"
                class:active={listCurrentStep === i + 1}
                onclick={() => onClickStep(i + 1)}
              >
                {move.move ? getMoveNotation(move.move) : "..."}
              </span>
              {#if listMoves[i + 1]}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                  class="move {getMoveListSideClass(listMoves[i + 1].color)}"
                  class:active={listCurrentStep === i + 2}
                  onclick={() => onClickStep(i + 2)}
                >
                  {(() => {
                    const m = listMoves[i + 1].move;
                    return m ? getMoveNotation(m) : "...";
                  })()}
                </span>
              {/if}
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  </div>

  <div class="comment-row">
    <textarea
      bind:value={commentsText}
      class="auto-height"
      placeholder={t("tree.placeholder")}
      bind:this={textareaEl}
      oninput={handleCommentsInput}
      onblur={handleCommentsBlur}
      rows="1"></textarea>
    <button
      class="toolbar-btn toggle-list-btn"
      title={listVisible ? t("tree.hideList", _lv) : t("tree.showList", _lv)}
      aria-label={listVisible
        ? t("tree.hideList", _lv)
        : t("tree.showList", _lv)}
      use:useSetIcon={listVisible ? "panel-right-close" : "panel-right-open"}
      onclick={toggleListVisible}
    ></button>
  </div>
</div>

<style>
  .tree-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    --chess-board-background: transparent;
    --chess-board-line: var(--text-normal);
    --piece-red: var(--chess-piece-white, var(--color-red));
    --piece-black: var(--chess-piece-black, var(--color-blue));
    --text-color: var(--text-normal);
    --chess-eval-plus: var(--color-green, #4caf50);
    --chess-eval-minus: var(--color-red, #f44336);
  }

  .tools-row {
    display: flex;
    flex-direction: row;
    flex: 1 1 auto;
    overflow: hidden;
  }

  .move-list {
    width: auto;
    min-width: 0;
    max-width: 200px;
    display: flex;
    flex-direction: column;
    font-size: var(--chess-font-size, 12px);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
    margin: 0;
    color: var(--text-normal);
    background-color: var(--background-primary-alt);
    border-left: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
    list-style: none;
  }

  .move-list li {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    gap: 0.25em;
    padding: 0 0.25em;
    margin: 0;
    border-bottom: none;
    white-space: nowrap;
    width: 100%;
  }

  .move-list .roundnum {
    display: inline-block;
    min-width: 1.2em;
    max-width: 2em;
    text-align: right;
    margin-right: 0.2em;
    color: var(--text-muted);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .move-list span.move {
    display: inline-block;
    line-height: 1.1;
    text-align: center;
    border-radius: var(--radius-s, 4px);
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0.12em 0.4em;
    margin: 0;
    color: var(--text-normal);
  }

  .move-list span.move.white {
    min-width: 2.5em;
    text-align: left;
  }

  .move-list span.move.black {
    min-width: 2.5em;
    text-align: right;
  }

  .move-list span.move:hover {
    background-color: var(--background-modifier-hover);
  }

  .move-list span.move.active {
    background-color: var(--color-accent);
    color: var(--text-on-accent);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    font-weight: 500;
  }

  .svg-wrapper {
    flex: 1 1 auto;
    overflow: hidden;
    background-color: var(--chess-board-background);
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
    bottom: 0.5rem;
    left: 0.5rem;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    background: color-mix(in srgb, var(--background-primary) 72%, transparent);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    box-shadow: var(--shadow-s, 0 1px 2px rgba(0, 0, 0, 0.1));
    pointer-events: none;
  }

  .toolbar .toolbar-btn {
    pointer-events: auto;
  }

  .slider {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 20px;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 3px 0 0 3px;
    margin: 0 0 0 6px;
  }

  .slider:not(.has-eval) {
    background: transparent;
    border-color: transparent;
  }

  .slider:not(.has-eval) .slider-inner {
    width: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    align-self: center;
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
    touch-action: none;
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
    border-radius: var(--radius-s, 4px);
    padding: 4px 8px;
    outline: none;
    overflow-y: auto;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  textarea.auto-height {
    height: auto;
    flex: 1 1 auto;
  }
  .comment-row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 2px;
  }
  .toggle-list-btn {
    width: 28px;
    height: auto;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px var(--interactive-accent);
  }

  .game-nav-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }
  .game-nav-info {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 2px 6px;
    min-width: 0;
  }
  .game-nav-info:hover {
    background: var(--background-modifier-hover);
    border-radius: 4px;
  }
  .game-nav-title {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    line-height: 1.3;
  }
  .game-nav-index {
    font-size: 9px;
    color: var(--text-muted);
    line-height: 1.2;
  }
  .game-nav-arrows {
    display: flex;
    flex-direction: row;
    gap: 2px;
    flex-shrink: 0;
  }
  .game-nav-arrow {
    width: 24px;
    height: 24px;
    padding: 0;
  }
  .game-nav-arrow :global(svg) {
    width: 16px;
    height: 16px;
  }
  .game-nav-menu-btn {
    width: 24px;
    height: 24px;
    padding: 0;
  }
</style>
