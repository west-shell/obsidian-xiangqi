<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    type Api,
    BOARD_ASPECT_RATIO,
    Chessground,
    CLS_PREFIX,
    type Config,
    GRID_SVG,
    type Square,
    WRAP_CLASS,
  } from "../../chess";

  interface Props {
    fen: string;
    lastMove?: [Square, Square] | null;
    orientation?: "white" | "black";
  }

  let { fen, lastMove = null, orientation = "white" }: Props = $props();

  let boardElement!: HTMLDivElement;
  let api: Api | null = null;

  // Xiangqi boards need the grid lines injected into cg-board (GRID_SVG is
  // null for chess); re-inject after each fen change because chessground
  // rewrites the board element content.
  function injectGridSVG(): void {
    if (!GRID_SVG) return;
    const inner = boardElement.querySelector("cg-board, xq-board");
    if (!inner || inner.querySelector("svg.xq-grid")) return;
    inner.insertAdjacentHTML("afterbegin", GRID_SVG);
  }

  onMount(() => {
    const config: Config = {
      fen,
      orientation,
      viewOnly: true,
      coordinates: false,
      highlight: { lastMove: true },
      drawable: { enabled: false, visible: false },
      ...(lastMove ? { lastMove } : {}),
    };
    api = Chessground(boardElement, config);
    injectGridSVG();
  });

  onDestroy(() => {
    api?.destroy();
    api = null;
  });

  $effect(() => {
    if (!api) return;
    api.set({
      fen,
      orientation,
      lastMove: lastMove ?? undefined,
    });
    injectGridSVG();
  });
</script>

<div
  bind:this={boardElement}
  class="{WRAP_CLASS} {CLS_PREFIX}-preview-board"
  style="--board-ratio: {BOARD_ASPECT_RATIO}"
></div>
