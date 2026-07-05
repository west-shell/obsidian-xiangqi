<script lang="ts">
  import { PIECE_CHARS } from "../../types";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    fen: string;
    eventBus: EventBus;
    position?: string;
    selectedPiece: string | null;
  }
  let { fen, eventBus, position = "", selectedPiece }: Props = $props();

  const MAX_COUNT: Record<string, number> = {
    K: 1,
    A: 2,
    B: 2,
    N: 2,
    R: 2,
    C: 2,
    P: 5,
    k: 1,
    a: 2,
    b: 2,
    n: 2,
    r: 2,
    c: 2,
    p: 5,
  };

  const isRed = (piece: string) => piece === piece.toUpperCase();

  let pieceCount = $derived(
    fen
      .split(" ")[0]
      .split("")
      .reduce((acc: Record<string, number>, c) => {
        if (/[1-9]/.test(c)) return acc;
        if (/[a-zA-Z]/.test(c)) acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {}),
  );

  let count = $derived(
    Object.fromEntries(
      Object.keys(MAX_COUNT).map((p) => [
        p,
        MAX_COUNT[p] - (pieceCount[p] || 0),
      ]),
    ),
  );
</script>

<div class={`piece-btn-container ${position}`}>
  {#each Object.entries(PIECE_CHARS) as [piece, name] (piece)}
    <button
      class={`piece-btn ${position} ${isRed(piece) ? "red-piece" : "black-piece"}`}
      class:empty={count[piece] === 0}
      class:active={selectedPiece === piece}
      onclick={() => eventBus.emit("clickPieceBTN", piece)}
    >
      {name}
    </button>
  {/each}
</div>

<style>
  .piece-btn-container {
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
  }
  .piece-btn-container.right {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: repeat(14, 1fr);
    flex-direction: column;
    width: fit-content;
    align-items: stretch;
    display: flex;
    justify-content: space-between;
  }

  .piece-btn-container.bottom {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(2, 1fr);
    width: calc(var(--xq-cell-size, 50px) * 9);
    height: auto;
    justify-content: left;
  }

  .piece-btn.right {
    flex: 1;
    width: 100%;
    height: calc(var(--xq-cell-size, 50px) * 10 / 14);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: max(8px, calc(var(--xq-cell-size, 50px) * 0.3));
    transition:
      box-shadow 0.15s,
      border-color 0.15s;
  }

  .piece-btn.bottom {
    padding: 0;
    width: calc(var(--xq-cell-size, 50px) * 9 / 7);
    border-radius: 4px;
    cursor: pointer;
    font-size: calc(var(--xq-cell-size, 50px) * 0.3);
    border: 1.5px solid rgba(0, 0, 0, 0.35);
    transition:
      box-shadow 0.15s,
      border-color 0.15s;
  }

  .red-piece {
    background-color: var(--piece-red);
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .black-piece {
    background-color: var(--piece-black);
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .active {
    border-color: #ffd700;
    box-shadow: 0 0 0 2px #ffd700;
    filter: brightness(1.5) saturate(1.4)
      drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
  }

  .empty {
    pointer-events: none;
    opacity: 0.35;
  }
</style>
