<script lang="ts">
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import List from "./List.svelte";
  import type { ChessNode, IOptions, ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { Square } from "../../chess";
  import { onMount, tick } from "svelte";

  interface Props {
    settings: ISettings;
    fen: string;
    checkColor?: "white" | "black" | null | undefined;
    selectedSquare: Square | null;
    currentStep: number;
    eventBus: EventBus;
    modified: boolean;
    PGN: ChessNode[];
    history: ChessNode[];
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
  // svelte-ignore state_referenced_locally
  let rotatedState = $state(options.rotated ?? false);
  let { position } = $derived(settings);

  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });

  $effect(() => {
    eventBus.on("rotate", () => {
      rotatedState = !rotatedState;
    });
  });
</script>

<div class="XQ-container {settings.position}">
  <Board {settings} {fen} {lastMove} {checkColor} {selectedSquare} {eventBus} rotated={rotatedState} />
  <Toolbar {settings} {eventBus} {modified} {PGN} {isprotected} />
  {#if settings.showMovelist}
    <List {settings} {currentStep} {moves} {eventBus} />
  {/if}
</div>

<style>
  .XQ-container {
    --red: #861818;
    --black: #000080;
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
