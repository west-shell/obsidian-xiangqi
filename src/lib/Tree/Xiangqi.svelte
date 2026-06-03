<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import type { ChessNode, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { DrawShape } from "@west-shell/chessground-xq/draw";
  import type * as cg from "@west-shell/chessground-xq/types";
  import type { Move, Square } from "@west-shell/xiangqi.js";
  import { onMount, tick } from "svelte";

  const SHAPES_PREFIX = "__SHAPES__";
  const BRUSH_MAP: Record<string, string> = { green: "g", red: "r", blue: "b", yellow: "y" };
  const BRUSH_REV: Record<string, string> = { g: "green", r: "red", b: "blue", y: "yellow" };

  function loadShapes(node: ChessNode): DrawShape[] {
    const entry = node.comments?.find((c) => c.startsWith(SHAPES_PREFIX));
    if (!entry) return [];
    try {
      const data = entry.slice(SHAPES_PREFIX.length);
      if (!data) return [];
      return data.split(",").map((s) => {
        const m = s.match(/^([gryb]):([a-i][0-9])([a-i][0-9])?$/);
        if (!m) throw new Error("bad shape");
        const brush = BRUSH_REV[m[1]];
        return { orig: m[2] as cg.Key, dest: m[3] as cg.Key | undefined, brush };
      });
    } catch {
      return [];
    }
  }

  function saveShapes(node: ChessNode, shapes: DrawShape[]) {
    node.comments = (node.comments ?? []).filter((c) => !c.startsWith(SHAPES_PREFIX));
    if (shapes.length > 0) {
      const data = shapes
        .map((s) => `${BRUSH_MAP[s.brush ?? "green"]}:${s.orig}${s.dest ?? ""}`)
        .join(",");
      node.comments.push(SHAPES_PREFIX + data);
    }
  }

  interface Props {
    settings: ISettings;
    fen: string;
    eventBus: EventBus;
    nodeMap: NodeMap;
    currentNode: ChessNode;
    currentPath: string[];
  }

  let {
    settings,
    fen,
    eventBus,
    nodeMap,
    currentNode,
    currentPath,
  }: Props = $props();

  let lastMove: [Square, Square] | null = $derived(
    currentNode.move ? [currentNode.move.from, currentNode.move.to] : null
  );
  let { position } = $derived(settings);
  let rotated = $state(false);
  let variations = $derived(
    currentNode.children
      .map((child) => child.move)
      .filter((m): m is Move => m != null) ?? [],
  );
  let checkColor = $derived(
    currentNode.move && /\+|#/.test(currentNode.move.san)
      ? (currentNode.move.color === 'w' ? 'black' : 'white')
      : null
  );
  let userShapes = $derived(loadShapes(currentNode));

  let treeViewEl: HTMLDivElement;
  let adaptiveBoardWidth = $state(300);

  $effect(() => {
    const el = treeViewEl;
    if (!el) return;
    const pos = position;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (pos === "right") {
        const availWidth = rect.width * 0.6;
        const availHeight = rect.height;
        const byHeight = (availHeight * 9) / 10;
        adaptiveBoardWidth = Math.min(availWidth, byHeight);
      } else {
        const availWidth = rect.width;
        const availHeight = rect.height * 0.65;
        const byHeight = (availHeight * 9) / 10;
        adaptiveBoardWidth = Math.min(availWidth, byHeight);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });

  $effect(() => {
    eventBus.on("user-shapes-changed", (shapes: DrawShape[]) => {
      saveShapes(currentNode, shapes);
      eventBus.emit("updatePGN", null);
      eventBus.emit("updateUI", null);
    });
  });

  $effect(() => {
    eventBus.on("rotate", () => {
      rotated = !rotated;
    });
  });
</script>

<div class="tree-view {position}" bind:this={treeViewEl}>
  <div class="board-area">
    <Board
      {settings} {fen} {lastMove} {checkColor} {eventBus} {rotated} {variations} {userShapes}
      boardWidth={adaptiveBoardWidth}
    />
  </div>
  <Toolbar {eventBus} />
  <Tree {nodeMap} {eventBus} {currentNode} {currentPath} />
</div>

<style>
  :global(.view-content.pgn-view) {
    overflow: hidden !important;
    margin: 0 !important;
    padding-top: var(--board-margin-top, 0px) !important;
    padding-bottom: var(--board-margin-bottom, 0px) !important;
  }
  .tree-view { display: flex; justify-content: center; }
  .tree-view.right { flex-direction: row; height: 100%; gap: 2px; }
  .tree-view.right :global(.tree-container) { flex: 1 1 auto; min-width: 25%; max-width: 50%; }
  .board-area { flex: 0 0 auto; display: flex; align-items: center; }
  .board-area :global(.xq-wrap) { height: auto !important; }
  .tree-view.bottom { flex-direction: column; align-items: center; height: 100%; }
  .tree-view.bottom :global(.tree-container) { flex: 1 1 auto; min-height: 25%; width: 100%; }
</style>
