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
    /** Position before the hovered move; when set the board jumps to it and animates the move itself. */
    animateFrom?: string | null;
    lastMove?: [Square, Square] | null;
    orientation?: "white" | "black";
  }

  let {
    fen,
    animateFrom = null,
    lastMove = null,
    orientation = "white",
  }: Props = $props();

  let boardElement!: HTMLDivElement;
  let api: Api | null = null;
  // Last fen applied to the board; skip redundant sets when unchanged.
  let lastFen = "";

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
      orientation,
      lastMove: lastMove ?? undefined,
    });
    if (fen !== lastFen) {
      if (animateFrom && animateFrom !== lastFen) {
        // Jump to the pre-move position first (instant), so chessground
        // then animates the hovered move itself (before -> after).
        api.set({ fen: animateFrom, animation: { enabled: false } });
      }
      api.set({ fen, animation: { enabled: !!animateFrom, duration: 300 } });
      lastFen = fen;
    }
    injectGridSVG();
  });
</script>

<div
  bind:this={boardElement}
  class="{WRAP_CLASS} {CLS_PREFIX}-preview-board"
  style="--board-ratio: {BOARD_ASPECT_RATIO}"
></div>
