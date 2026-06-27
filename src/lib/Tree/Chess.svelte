<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import type { ChessNode, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { cg, DrawShape, Move, Square } from "../../chess";
  import { onMount, tick } from "svelte";

  const SHAPES_RE = /^([a-i][0-9])([a-i][0-9])?:([gryb])$/;
  const BRUSH_MAP: Record<string, string> = {
    green: "g",
    red: "r",
    blue: "b",
    yellow: "y",
  };
  const BRUSH_REV: Record<string, string> = {
    g: "green",
    r: "red",
    b: "blue",
    y: "yellow",
  };

  function loadShapes(node: ChessNode): DrawShape[] {
    if (!node.comments) return [];
    const shapes: DrawShape[] = [];
    for (const c of node.comments) {
      const m = c.match(SHAPES_RE);
      if (m) {
        const brush = BRUSH_REV[m[3]];
        shapes.push({
          orig: m[1] as cg.Key,
          dest: m[2] as cg.Key | undefined,
          brush,
        });
      }
    }
    return shapes;
  }

  /** Convert DrawShape[] to comment strings and save to node */
  function saveShapes(node: ChessNode, shapes: DrawShape[]) {
    const shapeComments = shapes.map(
      (s) => s.orig + (s.dest ?? "") + ":" + BRUSH_MAP[s.brush ?? "green"],
    );
    node.comments = [
      ...(node.comments ?? []).filter((c) => !SHAPES_RE.test(c)),
      ...shapeComments,
    ];
  }
  interface Props {
    settings: ISettings;
    fen: string;
    eventBus: EventBus;
    nodeMap: NodeMap;
    currentNode: ChessNode;
    currentPath: string[];
  }

  let { settings, fen, eventBus, nodeMap, currentNode, currentPath }: Props =
    $props();

  let lastMove: [Square, Square] | null = $derived(
    currentNode.move ? [currentNode.move.from, currentNode.move.to] : null,
  );
  let { position } = $derived(settings);
  let rotated = $state(false);
  let variations = $derived(
    currentNode.children
      .map((child) => child.move)
      .filter((m): m is Move => m != null) ?? [],
  );
  let checkColor = $derived(
    currentNode.move &&
      (currentNode.move.isCheck || currentNode.move.isCheckmate)
      ? currentNode.move.color === "w"
        ? "black"
        : "white"
      : null,
  ) as "white" | "black" | null;
  let userShapes = $derived(loadShapes(currentNode));

  let treeViewEl: HTMLDivElement | null = null;
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
    eventBus.on<DrawShape[]>("user-shapes-changed", (shapes) => {
      saveShapes(currentNode, shapes ?? []);
      eventBus.emit("modified", null);
      eventBus.emit("updateUI", null);
    });
  });

  $effect(() => {
    eventBus.on("rotate", () => {
      rotated = !rotated;
    });
  });
</script>

<div
  class="tree-view {position}"
  bind:this={treeViewEl}
  style="--adaptive-board-width:{adaptiveBoardWidth}px"
>
  <Board
    {settings}
    {fen}
    {lastMove}
    {checkColor}
    {eventBus}
    {rotated}
    {variations}
    {userShapes}
  />
  <Toolbar {eventBus} />
  <Tree {nodeMap} {eventBus} {currentNode} {currentPath} />
</div>

<style>
  :global(.tree-codeblock) .tree-view.right {
    height: calc(var(--xq-cell-size, 50px) * 10) !important;
  }
  :global(.tree-codeblock) .tree-view.bottom {
    height: calc(var(--xq-cell-size, 50px) * 20) !important;
  }
  :global(.tree-codeblock) .tree-view {
    margin: 1rem 0;
  }
  :global(.view-content.pgn-view) .tree-view {
    --xq-board-width: var(--adaptive-board-width, 300px);
  }
  :global(.view-content.pgn-view) {
    overflow: hidden !important;
    margin: 0 !important;
    padding-top: var(--xq-board-margin-top, 0px) !important;
    padding-bottom: var(--xq-board-margin-bottom, 0px) !important;
  }
  .tree-view {
    display: flex;
    justify-content: center;
    margin: 0;
    padding: 0;
  }
  .tree-view.right {
    flex-direction: row;
    height: 100%;
  }
  .tree-view.right :global(.tree-container) {
    flex: 1 1 auto;
    min-width: 25%;
    max-width: 50%;
  }
  .tree-view.bottom {
    flex-direction: column;
    align-items: center;
    height: 100%;
  }
  .tree-view.bottom :global(.tree-container) {
    flex: 1 1 auto;
    min-height: 25%;
    width: 100%;
  }
</style>
