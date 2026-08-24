<script lang="ts">
  import type { Piece } from "../../chess";
  import { createPieceFromChar, PIECE_CHARS } from "../../chess";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    fen: string;
    eventBus: EventBus;
    selectedPiece: Piece | null;
  }
  let { fen, eventBus, selectedPiece }: Props = $props();

  const PIECE_KEYS = PIECE_CHARS ? Object.keys(PIECE_CHARS) : [];

  function handleClick(char: string) {
    const piece = createPieceFromChar(char);
    if (piece) eventBus.emit("clickPieceBTN", piece);
  }

  let pieceCount = $derived(
    fen
      .split(" ")[0]
      .split("")
      .reduce((acc: Record<string, number>, c) => {
        if (/[1-9]/.test(c)) return acc;
        if (/[a-zA-Z]/.test(c)) {
          acc[c] = (acc[c] || 0) + 1;
        }
        return acc;
      }, {}),
  );

  function getCount(key: string): number {
    const max: Record<string, number> = {
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
    return max[key] - (pieceCount[key] || 0);
  }

  function isSelected(key: string): boolean {
    if (!selectedPiece) return false;
    const isUpper = key === key.toUpperCase();
    return (
      selectedPiece.type === key.toLowerCase() &&
      selectedPiece.color === (isUpper ? "w" : "b")
    );
  }
</script>

<div class="piece-btn-container chess-layout__piecebtns">
  {#each PIECE_KEYS as key (key)}
    <button
      class="piece-btn {key === key.toUpperCase() ? 'white' : 'black'}"
      class:empty={getCount(key) <= 0}
      class:active={isSelected(key)}
      onclick={() => handleClick(PIECE_CHARS![key])}
    >
      {PIECE_CHARS![key]}
    </button>
  {/each}
</div>

<style>
  .piece-btn-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(7, 1fr);
    height: 100%;
    width: auto;
    justify-content: left;
  }

  .piece-btn {
    padding: 0;
    margin: 0;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid rgba(0, 0, 0, 0.35);
    transition:
      box-shadow 0.15s,
      border-color 0.15s;
    font-size: 1.1em;
    font-weight: bold;
  }

  .piece-btn.white {
    background-color: var(--chess-piece-red, var(--color-red));
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .piece-btn.black {
    background-color: var(--chess-piece-black, var(--color-blue));
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
