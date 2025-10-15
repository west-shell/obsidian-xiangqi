<script lang="ts">
  import { PIECE_CHARS, type IBoard } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { ISettings } from "../../types";

  interface Props {
    settings: ISettings;
    board: IBoard;
    eventBus: EventBus;
    position?: string;
    selectedPiece: string;
  }

  let {
    settings,
    board,
    eventBus,
    position = "",
    selectedPiece
  }: Props = $props();

  // 判断是否为红方棋子（大写字母）
  const isRed = (piece: string) => piece === piece.toUpperCase();

  // 每种棋子的标准上限（可按需调整）
  const MAX_COUNT: Record<string, number> = {
    R: 2,
    N: 2,
    B: 2,
    A: 2,
    K: 1,
    C: 2,
    P: 5,
    r: 2,
    n: 2,
    b: 2,
    a: 2,
    k: 1,
    c: 2,
    p: 5,
  };

  // 实时统计当前棋子数量
  let pieceCount = $derived(board.flat().reduce(
    (acc, piece) => {
      if (piece) acc[piece] = (acc[piece] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ));

  let count = $derived(Object.fromEntries(
    Object.keys(MAX_COUNT).map((piece) => [piece, MAX_COUNT[piece] - (pieceCount[piece] || 0)]),
  ));
</script>

<div
  class={`piece-btn-container ${position}`}
  style="--height: {11 * settings.cellSize}px;
    --width: {10 * settings.cellSize}px;"
>
  {#each Object.entries(PIECE_CHARS) as [piece, name]}
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
    height: var(--height);
    width: fit-content;
    align-items: stretch;
    display: flex;
    justify-content: space-between; /* 平均分布 */
  }

  .piece-btn-container.bottom {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(2, 1fr);
    width: var(--width);
    height: auto;
    justify-content: center;
  }

  .piece-btn.right {
    flex: 1; /* 每个按钮平分高度 */
    width: 100%;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .piece-btn.bottom {
    padding: 0;
    border: 0;
    width: calc(var(--width) / 7);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .red-piece {
    background-color: var(--piece-red);
    color: white;
  }

  .black-piece {
    background-color: var(--piece-black);
    color: white;
  }

  .active {
    filter: brightness(1.5) saturate(1.4) drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
  }

  .empty {
    pointer-events: none;
    filter: grayscale(0.4) brightness(0.8);
  }
</style>
