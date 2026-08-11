<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { EventBus } from "../../core/event-bus";
  import {
    type ChessNode,
    type ISettings,
    type NodeMap,
    PIECE_CHARS,
  } from "../../types";
  import { onLangChange, t } from "../../i18n";
  import { calculateTreeLayout } from "./layout";
  import { iconSvg } from "../../utils/icon";
  import { scrollToBTN } from "../../utils/utils";
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
    settings?: ISettings;
  }

  let {
    nodeMap,
    eventBus,
    currentNode = $bindable(),
    currentPath,
    settings,
  }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  let renderedNodes: ChessNode[] = $state([]);
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
    void listCurrentStep;
    void listMoves;
    (async () => {
      await tick();
      const index = listCurrentStep <= 0 ? 0 : Math.ceil(listCurrentStep / 2);
      const targetEl = listItemRefs[index];
      if (targetEl) {
        scrollToBTN(targetEl, listUlRef);
      }
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

  let nodeMode = $state(0);
  let spacingX = $derived(nodeMode === 0 ? 18 : 22);
  const spacingY = 15;
  const nodeHeight = 11;

  const ANNOTATION_DEFINITIONS: Record<
    string,
    { symbol: string; color: string; icon?: string; bgColor: string }
  > = {
    "W+": {
      symbol: "白优",
      color: "#fff",
      icon: "thumbs-up",
      bgColor: "#22ac38",
    },
    "B+": {
      symbol: "黑优",
      color: "#fff",
      icon: "thumbs-down",
      bgColor: "#df5353",
    },
    "=": {
      symbol: "均势",
      color: "#fff",
      icon: "handshake",
      bgColor: "#82c2ef",
    },
    "?": {
      symbol: "问题",
      color: "#fff",
      icon: "bookmark",
      bgColor: "#e69f00",
    },
    "!": {
      symbol: "妙手",
      color: "#fff",
      icon: "star",
      bgColor: "#22ac38",
    },
    "W#": {
      symbol: "白胜",
      color: "#fff",
      icon: "thumbs-up",
      bgColor: "#bbb",
    },
    "B#": {
      symbol: "黑胜",
      color: "#fff",
      icon: "thumbs-down",
      bgColor: "#333",
    },
    "=#": {
      symbol: "和棋",
      color: "#fff",
      icon: "handshake",
      bgColor: "#6e7781",
    },
  };

  const ALL_ANNOTATION_KEYS = Object.keys(ANNOTATION_DEFINITIONS);

  const GLYPH_PATHS: Record<string, string> = {
    "?!": '<path fill="#fff" d="M37.734 21.947c-3.714 0-7.128.464-10.242 1.393-3.113.928-6.009 2.13-8.685 3.605l4.343 8.766c2.35-1.202 4.644-2.157 6.883-2.867a22.366 22.366 0 0 1 6.799-1.065c2.294 0 4.07.464 5.326 1.393 1.311.874 1.967 2.186 1.967 3.933 0 1.748-.546 3.277-1.639 4.588-1.038 1.257-2.786 2.758-5.244 4.506-2.786 2.021-4.751 3.961-5.898 5.819-1.147 1.857-1.721 4.15-1.721 6.88v2.952h10.568v-2.377c0-1.147.137-2.103.41-2.868.328-.764.93-1.557 1.803-2.376.874-.82 2.104-1.803 3.688-2.95 2.13-1.584 3.906-3.058 5.326-4.424 1.42-1.42 2.485-2.95 3.195-4.59.71-1.638 1.065-3.576 1.065-5.816 0-4.206-1.584-7.675-4.752-10.406-3.114-2.731-7.51-4.096-13.192-4.096zm24.745.819 2.048 39.084h9.75l2.047-39.084zM35.357 68.73c-1.966 0-3.632.52-4.998 1.557-1.365.983-2.047 2.732-2.047 5.244 0 2.404.682 4.152 2.047 5.244 1.366 1.038 3.032 1.557 4.998 1.557 1.912 0 3.55-.519 4.916-1.557 1.366-1.092 2.05-2.84 2.05-5.244 0-2.512-.684-4.26-2.05-5.244-1.365-1.038-3.004-1.557-4.916-1.557zm34.004 0c-1.966 0-3.632.52-4.998 1.557-1.365.983-2.049 2.732-2.049 5.244 0 2.404.684 4.152 2.05 5.244 1.365 1.038 3.03 1.557 4.997 1.557 1.912 0 3.55-.519 4.916-1.557 1.366-1.092 2.047-2.84 2.047-5.244 0-2.512-.681-4.26-2.047-5.244-1.365-1.038-3.004-1.557-4.916-1.557z"/>',
    "?": '<path fill="#fff" d="M40.436 60.851q0-4.66 1.957-7.83 1.958-3.17 6.712-6.619 4.195-2.983 5.967-5.127 1.864-2.237 1.864-5.22 0-2.983-2.237-4.475-2.144-1.585-6.06-1.585-3.915 0-7.737 1.212t-7.83 3.263l-4.941-9.975q4.568-2.517 9.881-4.101 5.314-1.585 11.653-1.585 9.695 0 15.008 4.661 5.407 4.661 5.407 11.839 0 3.822-1.212 6.619-1.212 2.796-3.635 5.22-2.424 2.33-6.06 5.034-2.703 1.958-4.195 3.356-1.491 1.398-2.05 2.703-.467 1.305-.467 3.263v2.703H40.436zm-1.492 18.924q0-4.288 2.33-5.966 2.331-1.771 5.687-1.771 3.263 0 5.594 1.771 2.33 1.678 2.33 5.966 0 4.102-2.33 5.966-2.331 1.772-5.594 1.772-3.356 0-5.686-1.772-2.33-1.864-2.33-5.966z"/>',
    "??": '<path fill="#fff" d="M31.8 22.22c-3.675 0-7.052.46-10.132 1.38-3.08.918-5.945 2.106-8.593 3.565l4.298 8.674c2.323-1.189 4.592-2.136 6.808-2.838a22.138 22.138 0 0 1 6.728-1.053c2.27 0 4.025.46 5.268 1.378 1.297.865 1.946 2.16 1.946 3.89s-.541 3.242-1.622 4.539c-1.027 1.243-2.756 2.73-5.188 4.458-2.756 2-4.7 3.918-5.836 5.755-1.134 1.837-1.702 4.107-1.702 6.808v2.92h10.457v-2.35c0-1.135.135-2.082.406-2.839.324-.756.918-1.54 1.783-2.35.864-.81 2.079-1.784 3.646-2.918 2.107-1.568 3.863-3.026 5.268-4.376 1.405-1.405 2.46-2.92 3.162-4.541.703-1.621 1.054-3.54 1.054-5.755 0-4.161-1.568-7.592-4.702-10.294-3.08-2.702-7.43-4.052-13.05-4.052zm38.664 0c-3.675 0-7.053.46-10.133 1.38-3.08.918-5.944 2.106-8.591 3.565l4.295 8.674c2.324-1.189 4.593-2.136 6.808-2.838a22.138 22.138 0 0 1 6.728-1.053c2.27 0 4.026.46 5.269 1.378 1.297.865 1.946 2.16 1.946 3.89s-.54 3.242-1.62 4.539c-1.027 1.243-2.757 2.73-5.189 4.458-2.756 2-4.7 3.918-5.835 5.755-1.135 1.837-1.703 4.107-1.703 6.808v2.92h10.457v-2.35c0-1.135.134-2.082.404-2.839.324-.756.918-1.54 1.783-2.35.865-.81 2.081-1.784 3.648-2.918 2.108-1.568 3.864-3.026 5.269-4.376 1.405-1.405 2.46-2.92 3.162-4.541.702-1.621 1.053-3.54 1.053-5.755 0-4.161-1.567-7.592-4.702-10.294-3.08-2.702-7.43-4.052-13.05-4.052zM29.449 68.504c-1.945 0-3.593.513-4.944 1.54-1.351.973-2.027 2.703-2.027 5.188 0 2.378.676 4.108 2.027 5.188 1.35 1.027 3 1.54 4.944 1.54 1.892 0 3.512-.513 4.863-1.54 1.35-1.08 2.026-2.81 2.026-5.188 0-2.485-.675-4.215-2.026-5.188-1.351-1.027-2.971-1.54-4.863-1.54zm38.663 0c-1.945 0-3.592.513-4.943 1.54-1.35.973-2.026 2.703-2.026 5.188 0 2.378.675 4.108 2.026 5.188 1.351 1.027 2.998 1.54 4.943 1.54 1.891 0 3.513-.513 4.864-1.54 1.351-1.08 2.027-2.81 2.027-5.188 0-2.485-.676-4.215-2.027-5.188-1.35-1.027-2.973-1.54-4.864-1.54z"/>',
    "!": '<path fill="#fff" d="M54.967 62.349h-9.75l-2.049-39.083h13.847zM43.004 76.032q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244z" vector-effect="non-scaling-stroke"/>',
    "!!": '<path fill="#fff" d="M71.967 62.349h-9.75l-2.049-39.083h13.847zM60.004 76.032q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244zM37.967 62.349h-9.75l-2.049-39.083h13.847zM26.004 76.032q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244z" vector-effect="non-scaling-stroke"/>',
    "!?": '<path fill="#fff" d="M60.823 58.9q0-4.098 1.72-6.883 1.721-2.786 5.9-5.818 3.687-2.622 5.243-4.506 1.64-1.966 1.64-4.588t-1.967-3.933q-1.885-1.393-5.326-1.393t-6.8 1.065q-3.36 1.065-6.883 2.868l-4.343-8.767q4.015-2.212 8.685-3.605 4.67-1.393 10.242-1.393 8.521 0 13.192 4.097 4.752 4.096 4.752 10.405 0 3.36-1.065 5.818-1.066 2.458-3.196 4.588-2.13 2.048-5.326 4.424-2.376 1.72-3.687 2.95-1.31 1.229-1.802 2.376-.41 1.147-.41 2.868v2.376h-10.57zm-1.311 16.632q0-3.77 2.048-5.244 2.049-1.557 4.998-1.557 2.868 0 4.916 1.557 2.049 1.475 2.049 5.244 0 3.605-2.049 5.244-2.048 1.556-4.916 1.556-2.95 0-4.998-1.556-2.048-1.64-2.048-5.244zM36.967 61.849h-9.75l-2.049-39.083h13.847zM25.004 75.532q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244z" vector-effect="non-scaling-stroke"/>',
  };

  function glyphPath(symbol: string): string {
    return GLYPH_PATHS[symbol] ?? "";
  }

  function annotationIconSvg(icon: string, fill: string): string {
    const icons: Record<string, string[]> = {
      "thumbs-up": [
        "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
        "M7 10v12",
      ],
      "thumbs-down": [
        "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",
        "M17 14V2",
      ],
      handshake: [
        "m11 17 2 2a1 1 0 1 0 3-3",
        "m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4",
        "m21 3 1 11h-2",
        "M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3",
        "M3 4h8",
      ],
      bookmark: [
        "M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",
      ],
      star: [
        "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
      ],
      crown: ["M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"],
    };
    const paths = icons[icon];
    if (!paths) return "";
    return paths
      .map(
        (d) => `<path fill="none" stroke="${fill}" stroke-width="2" d="${d}"/>`,
      )
      .join("");
  }

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
  let handleSliderTouchMove: ((evt: TouchEvent) => void) | null = null;
  let handleSliderTouchEnd: (() => void) | null = null;
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
    if (handleSliderTouchMove)
      activeDocument.removeEventListener("touchmove", handleSliderTouchMove);
    if (handleSliderTouchEnd)
      activeDocument.removeEventListener("touchend", handleSliderTouchEnd);
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

  // svelte-ignore state_referenced_locally
  let listVisible = $state(settings?.showMovelist ?? true);
  function toggleListVisible() {
    listVisible = !listVisible;
    tick().then(() => resetView());
  }

  function getNodeWidth(node: ChessNode): number {
    if (nodeMode === 0) return 13;
    const zh = node.move?.zh ?? "始";
    return Math.max(13, zh.length * 5.5);
  }

  let canFold = $derived((currentNode?.children?.length ?? 0) > 1);
  let toolbarBTN = $derived([
    { title: "放大", icon: "plus", event: zoomIn },
    { title: "缩小", icon: "minus", event: zoomOut },
    { title: "重置", icon: "rotate-ccw", event: resetView },
  ]);
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

    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      // .scaleExtent([0.5, 6])
      .on("zoom", (event) => {
        zoomTransform = event.transform;
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

<div class="tree-container xq-layout__tools">
  <div class="tools-row">
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
                stroke={node.id === currentNode?.id
                  ? "var(--interactive-accent)"
                  : "var(--xq-board-line)"}
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
                  {node.move?.zh ?? "开局"}
                </text>
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
              {#if primaryAnnotation}
                {@const def = ANNOTATION_DEFINITIONS[primaryAnnotation]}
                <g
                  transform="translate({-nw / 2 - 3} {nodeHeight / 2 -
                    3}) scale(0.06)"
                  style="pointer-events: none"
                >
                  <circle cx="50" cy="50" r="50" fill={def.bgColor} />
                  <g transform="translate(14,14) scale(3)">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html annotationIconSvg(def.icon ?? "", def.color)}
                  </g>
                </g>
              {/if}
              {#if node.isCheckmate}
                <g
                  transform="translate({-nw / 2 - 3} {-nodeHeight / 2 -
                    3}) scale(0.06)"
                  style="pointer-events: none"
                >
                  <circle cx="50" cy="50" r="50" fill="#df5353" />
                  <g transform="translate(14,14) scale(3)">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html annotationIconSvg("crown", "#fff")}
                  </g>
                </g>
              {/if}
              {#if node.glyph}
                <g
                  transform="translate({nw / 2 - 3} {nodeHeight / 2 -
                    3}) scale(0.06)"
                  style="pointer-events: none"
                >
                  <circle cx="50" cy="50" r="50" fill={node.glyph.color} />
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html glyphPath(node.glyph.symbol)}
                </g>
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
        {#if canFold}
          <button
            class="toolbar-btn"
            aria-label={t("tree.fold")}
            use:useSetIcon={"chevrons-right-left"}
            onclick={toggleCurrentFold}
          ></button>
        {/if}
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
            <span
              role="presentation"
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
            = 开 局 =
          </span>
        </li>
        {#each listMoves as move, i (i)}
          {#if i % 2 === 0}
            <li class="round" bind:this={listItemRefs[i / 2 + 1]}>
              <span class="roundnum">{i / 2 + 1}</span>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span
                class="move red"
                class:active={listCurrentStep === i + 1}
                onclick={() => onClickStep(i + 1)}
              >
                {move.move?.zh ?? "..."}
              </span>
              {#if listMoves[i + 1]}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                  class="move black"
                  class:active={listCurrentStep === i + 2}
                  onclick={() => onClickStep(i + 2)}
                >
                  {listMoves[i + 1].move?.zh ?? "..."}
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
      title={listVisible ? t("tree.hideList") : t("tree.showList")}
      aria-label={listVisible ? t("tree.hideList") : t("tree.showList")}
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
    --xq-board-background: transparent;
    --xq-board-line: var(--text-normal);
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
    --text-color: var(--text-normal);
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
    font-size: var(--xq-font-size, 12px);
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
    border-radius: 0.2em;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0.1em 0.35em;
    margin: 0;
    color: var(--text-normal);
  }

  .move-list span.move.red {
    min-width: 2.5em;
    text-align: left;
  }

  .move-list span.move.black {
    min-width: 2.5em;
    text-align: right;
  }

  .move-list span.move:hover {
    background-color: var(--background-modifier-hover);
    transform: scale(1.02);
  }

  .move-list span.move.active {
    background-color: var(--color-accent);
    color: var(--text-on-accent);
    box-shadow: 0 0.125em 0.375em rgba(0, 0, 0, 0.15);
    font-weight: 500;
    transform: scale(1.02);
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
    bottom: 0.5rem;
    left: 0.5rem;
    display: flex;
    flex-direction: column;
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
    width: 20px;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 3px 0 0 3px;
    margin: 0 0 0 6px;
    touch-action: none;
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
    touch-action: none;
    overflow: visible;
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
    border-radius: 3px;
    padding: 0;
    outline: none;
    overflow-y: auto;
  }
  textarea.auto-height {
    height: auto;
    flex: 1 1 auto;
  }
  .comment-row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 0;
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
    border-radius: 0;
    border-left: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary-alt);
  }
  textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 5px var(--interactive-accent);
  }
</style>
