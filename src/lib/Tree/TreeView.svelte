<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import type { ChessNode, IBoard, IPosition, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";

  export let settings: ISettings;
  export let board: IBoard;
  export let markedPos: IPosition;
  export let currentTurn: string;
  export let eventBus: EventBus;
  export let nodeMap: NodeMap;
  export let currentNode: ChessNode;
  export let currentPath: string[];

  $: lastMove = currentNode.data;
</script>

<div class="tree-view">
  <Board {settings} {board} {lastMove} {markedPos} {currentTurn} {eventBus} rotated={false} />
  <Toolbar {eventBus} />
  <Tree theme={settings.theme} {nodeMap} {eventBus} {currentNode} {currentPath} />
</div>

<style>
  .tree-view {
    display: flex;
    flex-direction: row;
    height: 100%;
    gap: 4px;
  }
</style>
