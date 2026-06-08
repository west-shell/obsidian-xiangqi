<script lang="ts">
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import MoveList from "./MoveList.svelte";
  import type { ISettings, IOptions } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { Move, Square } from "@west-shell/xiangqi.js";
  import { onMount, tick } from "svelte";

  interface Props {
    settings: ISettings;
    fen: string;
    checkColor?: "white" | "black" | null | undefined;
    selectedSquare: Square | null;
    currentStep: number;
    eventBus: EventBus;
    modified: boolean;
    PGN: Move[];
    history: Move[];
    lastMove: [Square, Square] | null;
    options: IOptions;
  }

  let {
    settings,
    fen,
    checkColor,
    selectedSquare,
    currentStep,
    eventBus,
    modified,
    PGN,
    history,
    lastMove,
    options,
  }: Props = $props();

  let moves = $derived(modified ? history : PGN);
  let isprotected = $derived(options.protected || false);
  let rotated = $derived(options.rotated || false);

  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });
</script>

<div class="XQ-container {settings.position}">
  <Board {settings} {fen} {lastMove} {checkColor} {selectedSquare} {eventBus} {rotated} />
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
