<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import type { ChessNode, IBoard, IMove, IPosition, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import { onMount, tick } from "svelte";

  interface Props {
    settings: ISettings;
    board: IBoard;
    markedPos: IPosition;
    currentTurn: string;
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
    currentNode.children.map((child) => child.data).filter((data): data is IMove => data != null), // 过滤掉null值
  );

  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });

  $effect(() => {
    eventBus.on("rotate", () => {
      rotated = !rotated;
    });
  });
</script>

<div class="tree-view {position}">
  <Board
    {settings}
    {board}
    {lastMove}
    {markedPos}
    {currentTurn}
    {eventBus}
    {rotated}
    {variations}
  />
  <Toolbar {eventBus} />
  <Tree {nodeMap} {eventBus} {currentNode} {currentPath} {settings} />
</div>

<style>
  :global(.view-content.pgn-view) {
    overflow: hidden !important;
    padding-top: var(--board-margin-top, 0px);
    padding-bottom: var(--board-margin-bottom, 0px);
  }
  .tree-view {
    display: flex;
    justify-content: center;
    margin: 0 auto; /* 添加此行以使 .tree-view 容器本身居中 */
  }

  .tree-view.right {
    flex-direction: row;
    height: 100%;
    gap: 2px;
  }

  .tree-view.right :global(.tree-container) {
    flex: 1 1 auto;
    min-width: 300px;
  }

  .tree-view.right :global(.svg-wrapper) {
    min-width: 280px;
  }

  .tree-view.bottom {
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .tree-view.bottom :global(.tree-container) {
    flex: 1 1 auto;
    min-width: 400px;
    width: 100%;
  }

  .tree-view.bottom :global(.svg-wrapper) {
    min-width: 380px;
    width: 100%;
  }
</style>
