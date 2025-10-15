<script lang="ts">
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import MoveList from "./MoveList.svelte";
  import type { IBoard, IMove, IOptions, IPosition, ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import { onMount, tick } from "svelte";

  interface Props {
    settings: ISettings;
    board: IBoard;
    markedPos: IPosition | null;
    currentTurn: string;
    currentStep: number;
    eventBus: EventBus;
    modified: boolean;
    PGN: IMove[];
    history: IMove[];
    options: IOptions;
  }

  let {
    settings,
    board,
    markedPos,
    currentTurn,
    currentStep,
    eventBus,
    modified,
    PGN,
    history,
    options
  }: Props = $props();
  let moves = $derived(modified ? history : PGN);
  let lastMove = $derived(moves[currentStep - 1] || null);
  let isprotected = $derived(options.protected || false);
  let rotated = $derived(options.rotated || false);
  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });
</script>

<div class="XQ-container {settings.position}">
  <Board {settings} {board} {lastMove} {markedPos} {currentTurn} {eventBus} {rotated} />
  <Toolbar {settings} {eventBus} {modified} {PGN} {isprotected} />
  {#if settings.showMovelist}
    <MoveList {settings} {currentStep} {moves} {eventBus} />
  {/if}
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
