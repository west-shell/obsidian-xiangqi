<script lang="ts">
  import { CLS_PREFIX, type Piece, PIECE_CHARS } from "../../chess";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    fen: string;
    eventBus: EventBus;
    selectedPiece: Piece | null;
  }
  let { fen, eventBus, selectedPiece }: Props = $props();

  const keys = PIECE_CHARS ? Object.keys(PIECE_CHARS) : [];
  const PIECE_KEYS = [
    ...keys.filter((k) => k === k.toLowerCase()),
    ...keys.filter((k) => k !== k.toLowerCase()),
  ];

  function handleClick(key: string) {
    const isUpper = key === key.toUpperCase();
    const piece: Piece = {
      type: key.toLowerCase() as Piece["type"],
      color: isUpper ? "w" : "b",
    };
    eventBus.emit("clickPieceBTN", piece);
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

<div class="{CLS_PREFIX}-layout__palette">
  {#each PIECE_KEYS as key (key)}
    <button
      class={`${CLS_PREFIX}-palette__btn ${CLS_PREFIX}-palette__btn--${key === key.toUpperCase() ? "white" : "black"} ${isSelected(key) ? `${CLS_PREFIX}-palette__btn--active` : ""} ${getCount(key) <= 0 ? `${CLS_PREFIX}-palette__btn--empty` : ""}`}
      onclick={() => handleClick(key)}
    >
      {PIECE_CHARS![key]}
    </button>
  {/each}
</div>
