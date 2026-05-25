<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import type { ChessNode, IBoard, IMove, IPosition, ISettings, NodeMap, ITurn } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { DrawShape } from "@west-shell/chessground-xq/draw";
  import { onMount, tick } from "svelte";

  const SHAPES_PREFIX = "__SHAPES__";

  function loadShapes(node: ChessNode): DrawShape[] {
    const entry = node.comments?.find((c) => c.startsWith(SHAPES_PREFIX));
    if (!entry) return [];
    try {
      return JSON.parse(entry.slice(SHAPES_PREFIX.length));
    } catch {
      return [];
    }
  }

  function saveShapes(node: ChessNode, shapes: DrawShape[]) {
    node.comments = (node.comments ?? []).filter((c) => !c.startsWith(SHAPES_PREFIX));
    if (shapes.length > 0) {
      node.comments.push(SHAPES_PREFIX + JSON.stringify(shapes));
    }
  }

  interface Props {
    settings: ISettings;
    board: IBoard;
    markedPos: IPosition;
    currentTurn: ITurn;
    eventBus: EventBus;
    nodeMap: NodeMap;
    currentNode: ChessNode;
    currentPath: string[];
  }

  let {
    settings,
    board,
    markedPos,
    currentTurn,
    eventBus,
    nodeMap,
    currentNode,
    currentPath,
  }: Props = $props();

  let lastMove = $derived(currentNode.data);
  let { position } = $derived(settings);
  let rotated = $state(false);
  let variations = $derived(
    currentNode.children.map((child) => child.data).filter((data): data is IMove => data != null) ??
      [],
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
      {settings}
      {board}
      {lastMove}
      {markedPos}
      {currentTurn}
      {eventBus}
      {rotated}
      {variations}
      {userShapes}
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
  .tree-view {
    display: flex;
    justify-content: center;
  }

  .tree-view.right {
    flex-direction: row;
    height: 100%;
    gap: 2px;
  }

  .tree-view.right :global(.tree-container) {
    flex: 1 1 auto;
    min-width: 25%;
    max-width: 50%;
  }

  .board-area {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .board-area :global(.cg-wrap) {
    height: auto !important;
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
