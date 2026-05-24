<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Chessground } from "@west-shell/chessground-xq";
  import type { Api } from "@west-shell/chessground-xq/api";

  import type { EventBus } from "../core/event-bus";
  import type { IBoard, IMove, IPosition, ISettings } from "../types";
  import { PIECE_CHARS } from "../types";

  interface Props {
    settings: ISettings;
    board: IBoard;
    lastMove?: IMove | null;
    markedPos?: IPosition | null;
    currentTurn: string;
    eventBus: EventBus;
    rotated: boolean;
    variations?: IMove[];
  }

  let {
    settings,
    board,
    lastMove = null,
    markedPos = null,
    currentTurn,
    eventBus,
    rotated,
    variations = [],
  }: Props = $props();

  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  onMount(async () => {
    // Build the configuration from props
    const finalConfig = {};

    // Initialize the board
    api = Chessground(boardElement, finalConfig);
  });

  onDestroy(() => {
    if (api) {
      api.destroy();
    }
  });

  // Update board when props change
  $effect(() => {
    if (api) {
      const updates = {};

      if (Object.keys(updates).length > 0) {
        api.set(updates);
      }
    }
  });
</script>

<div bind:this={boardElement} class="cg-wrap"></div>

<style>
  .cg-wrap {
    width: 540px;
    height: 100%;
    flex-shrink: 0;
    aspect-ratio: 450 / 500;
  }
</style>
