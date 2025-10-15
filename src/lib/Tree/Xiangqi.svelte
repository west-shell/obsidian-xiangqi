<script lang="ts">
  import { run } from 'svelte/legacy';

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
    currentPath
  }: Props = $props();

  let lastMove = $derived(currentNode.data);
  run(() => {
    settings.position;
  });
</script>

<div class="tree-view {settings.position}">
  <Board {settings} {board} {lastMove} {markedPos} {currentTurn} {eventBus} rotated={false} />
  <Toolbar {eventBus} />
  <Tree {nodeMap} {eventBus} {currentNode} {currentPath} />
</div>

<style>
  .tree-view {
    display: flex;
    justify-content: center;
    height: 100%;
    /* gap: 2px; */
  }

  .tree-view.right {
    flex-direction: row;
  }
  .tree-view.bottom {
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
</style>
