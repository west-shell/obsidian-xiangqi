<script lang="ts">
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import MoveList from "./MoveList.svelte";
  import type { IBoard, IMove, IOptions, IPosition, ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import { onMount, tick } from "svelte";

  export let settings: ISettings;
  export let board: IBoard;
  export let markedPos: IPosition | null;
  export let currentTurn: string;
  export let currentStep: number;
  export let eventBus: EventBus;
  export let modified: boolean;
  export let PGN: IMove[];
  export let history: IMove[];
  export let options: IOptions;
  $: moves = modified ? history : PGN;
  $: isprotected = options.protected || false;
  $: rotated = options.rotated || false;
  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });
</script>

<div class="XQ-container {settings.position}">
  <Board {settings} {board} {markedPos} {currentTurn} {eventBus} {rotated} />
  <Toolbar {settings} {eventBus} {modified} {PGN} {isprotected} />
  <MoveList {settings} {currentStep} {moves} {eventBus} />
</div>

<style>
  .XQ-container {
    --red: #861818;
    --black: #000080;
    margin: 10px;
  }

  .XQ-container.right {
    display: flex;
    flex-direction: row;
    gap: 2px;
  }

  .XQ-container.bottom {
    display: flex;
    flex-direction: column;
  }
</style>
