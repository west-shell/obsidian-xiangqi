<script lang="ts">
  import { setIcon } from "obsidian";
  import type { Piece } from "../../chess";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    fen: string;
    eventBus: EventBus;
    selectedPiece: Piece | null;
  }
  let { fen, eventBus, selectedPiece }: Props = $props();

  const PIECE_DEFS: {
    key: string;
    color: "white" | "black";
    icon: string;
    maxCount: number;
  }[] = [
    { key: "k", color: "black", icon: "chess_king", maxCount: 1 },
    { key: "q", color: "black", icon: "chess_queen", maxCount: 1 },
    { key: "r", color: "black", icon: "chess_rook", maxCount: 2 },
    { key: "b", color: "black", icon: "chess_bishop", maxCount: 2 },
    { key: "n", color: "black", icon: "chess_knight", maxCount: 2 },
    { key: "p", color: "black", icon: "chess_pawn", maxCount: 8 },
    { key: "K", color: "white", icon: "chess_king", maxCount: 1 },
    { key: "Q", color: "white", icon: "chess_queen", maxCount: 1 },
    { key: "R", color: "white", icon: "chess_rook", maxCount: 2 },
    { key: "B", color: "white", icon: "chess_bishop", maxCount: 2 },
    { key: "N", color: "white", icon: "chess_knight", maxCount: 2 },
    { key: "P", color: "white", icon: "chess_pawn", maxCount: 8 },
  ];

  const PIECES: {
    key: string;
    piece: Piece;
    color: "white" | "black";
    icon: string;
    maxCount: number;
  }[] = PIECE_DEFS.map((def) => ({
    ...def,
    piece: {
      type: def.key.toLowerCase() as Piece["type"],
      color:
        def.key === def.key.toUpperCase() ? ("w" as const) : ("b" as const),
    },
  }));

  let pieceCount = $derived(
    fen
      .split(" ")[0]
      .split("")
      .reduce((acc: Record<string, number>, c) => {
        if (/[1-8]/.test(c)) return acc;
        if (/[a-zA-Z]/.test(c)) {
          acc[c] = (acc[c] || 0) + 1;
        }
        return acc;
      }, {}),
  );

  let count = $derived(
    (() => {
      const whitePromoBudget = 8 - (pieceCount["P"] || 0);
      const blackPromoBudget = 8 - (pieceCount["p"] || 0);
      const whiteOverflow = ["Q", "R", "B", "N"].reduce(
        (s, k) =>
          s +
          Math.max(
            0,
            (pieceCount[k] || 0) - PIECES.find((p) => p.key === k)!.maxCount,
          ),
        0,
      );
      const blackOverflow = ["q", "r", "b", "n"].reduce(
        (s, k) =>
          s +
          Math.max(
            0,
            (pieceCount[k] || 0) - PIECES.find((p) => p.key === k)!.maxCount,
          ),
        0,
      );

      return Object.fromEntries(
        PIECES.map(({ key, maxCount }) => {
          const onBoard = pieceCount[key] || 0;
          const isWhite = key === key.toUpperCase();
          const isPawn = key === "P" || key === "p";
          const isKing = key === "K" || key === "k";
          if (isKing) return [key, maxCount - onBoard];
          if (isPawn) {
            const overflow = isWhite ? whiteOverflow : blackOverflow;
            return [key, maxCount - onBoard - overflow];
          }
          const promoBudget = isWhite ? whitePromoBudget : blackPromoBudget;
          const selfOverflow = Math.max(0, onBoard - maxCount);
          const otherOverflow =
            (isWhite ? whiteOverflow : blackOverflow) - selfOverflow;
          return [key, maxCount + promoBudget - onBoard - otherOverflow];
        }),
      );
    })(),
  );

  function useIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }
</script>

<div class="piece-btn-container chess-layout__piecebtns">
  {#each PIECES as { key, color, icon, piece } (key)}
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button
      class="piece-btn {color}"
      class:empty={count[key] === 0}
      class:active={selectedPiece &&
        selectedPiece.type === piece.type &&
        selectedPiece.color === piece.color}
      use:useIcon={icon}
      onclick={() => eventBus.emit("clickPieceBTN", piece)}
    ></button>
  {/each}
</div>

<style>
  .piece-btn-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(6, 1fr);
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
    color: white;
  }

  .piece-btn :global(svg) {
    width: 18px;
    height: 18px;
  }

  .piece-btn.white {
    background-color: var(--chess-piece-white);
    color: black;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .piece-btn.black {
    background-color: var(--chess-piece-black);
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
