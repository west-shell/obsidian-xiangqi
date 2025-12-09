<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import type { ChessNode, IBoard, IPosition, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";

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
  let position = $derived(settings.position);
</script>

<div class="tree-view {position}">
  <Board {settings} {board} {lastMove} {markedPos} {currentTurn} {eventBus} rotated={false} />
  <Toolbar {eventBus} />
  <Tree {nodeMap} {eventBus} {currentNode} {currentPath} />
</div>

<style>
  :global(.view-content.pgn-view) {
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0px;
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

  .tree-view.bottom {
    flex-direction: column;
    align-items: center;
    height: 100%;
    max-width: 40vh;
  }
</style>
