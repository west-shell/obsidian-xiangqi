<script lang="ts">
  import type { EventBus } from "../core/event-bus";
  import type { IBoard, IMove, IPosition, ISettings } from "../types";
  import { PIECE_CHARS } from "../types";

  export let settings: ISettings;
  export let board: IBoard;
  export let lastMove: IMove | null = null;
  export let markedPos: IPosition | null = null;
  export let currentTurn: string;
  export let eventBus: EventBus;
  export let rotated: boolean;

  let cellSize: number, margin: number, width: number, height: number;

  let renderedBoard: IBoard;
  let renderedMarkedPos: IPosition | null;

  $: ({ cellSize, showLastMove, showTurnBorder } = settings);
  $: margin = cellSize * 0.1;
  $: width = cellSize * 10;
  $: height = cellSize * 11;

  function rotatePos(pos: IPosition): IPosition {
    return { x: 8 - pos.x, y: 9 - pos.y };
  }

  function rotateBoard(board: IBoard): IBoard {
    const newBoard: IBoard = Array.from({ length: 9 }, () => Array(10).fill(null));
    for (let x = 0; x < 9; x++) {
      for (let y = 0; y < 10; y++) {
        newBoard[x][y] = board[8 - x][9 - y];
      }
    }
    return newBoard;
  }

  $: renderedBoard = rotated ? rotateBoard(board) : board;
  $: renderedMarkedPos = rotated && markedPos ? rotatePos(markedPos) : markedPos;
  $: renderedLastMove =
    rotated && lastMove ? { from: rotatePos(lastMove.from), to: rotatePos(lastMove.to) } : lastMove;

  function handleClick(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const boardRect = svg.getBoundingClientRect();
    const mouseX = e.clientX - boardRect.left;
    const mouseY = e.clientY - boardRect.top;
    let gridX = Math.round(mouseX / cellSize) - 1;
    let gridY = Math.round(mouseY / cellSize) - 1;

    if (gridX >= 0 && gridX < 9 && gridY >= 0 && gridY < 10) {
      const pos = rotated ? rotatePos({ x: gridX, y: gridY }) : { x: gridX, y: gridY };
      eventBus.emit("click", pos);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="board-container">
  <svg
    {width}
    {height}
    viewBox={`0 0 ${width} ${height}`}
    xmlns="http://www.w3.org/2000/svg"
    class="xq-board"
    on:click={handleClick}
  >
    <!-- 背景 -->
    <rect
      {width}
      {height}
      fill="var(--board-background)"
      rx="5"
      stroke={showTurnBorder
        ? currentTurn === "red"
          ? "var(--piece-red)"
          : "var(--piece-black)"
        : "var(--background-modifier-border)"}
      stroke-width={cellSize * 0.2}
    />

    <!-- 外框 -->
    <path
      d={`M ${cellSize - margin},${cellSize - margin} h ${8 * cellSize + 2 * margin} v ${9 * cellSize + 2 * margin} h -${8 * cellSize + 2 * margin} Z`}
      stroke="var(--board-line)"
      stroke-width={cellSize * 0.08}
      fill="none"
    />

    <!-- 横线 -->
    {#each Array(10).fill(0) as _, i}
      <path
        d={`M ${cellSize},${cellSize * (i + 1)} h ${cellSize * 8}`}
        stroke="var(--board-line)"
        stroke-width={cellSize * 0.04}
        fill="none"
      />
    {/each}

    <!-- 上/下竖线 -->
    {#each Array(9).fill(0) as _, i}
      <path
        d={`M ${cellSize * (i + 1)},${cellSize} v ${cellSize * 4}`}
        stroke="var(--board-line)"
        stroke-width={cellSize * 0.04}
        fill="none"
      />
      <path
        d={`M ${cellSize * (i + 1)},${cellSize * 6} v ${cellSize * 4}`}
        stroke="var(--board-line)"
        stroke-width={cellSize * 0.04}
        fill="none"
      />
    {/each}

    <!-- 左右边线 -->
    <line
      x1={cellSize}
      y1={cellSize}
      x2={cellSize}
      y2={10 * cellSize}
      stroke="var(--board-line)"
      stroke-width={cellSize * 0.04}
    />
    <line
      x1={cellSize * 9}
      y1={cellSize}
      x2={cellSize * 9}
      y2={10 * cellSize}
      stroke="var(--board-line)"
      stroke-width={cellSize * 0.04}
    />

    <!-- 楚河汉界 -->
    <text
      x={width / 2}
      y={height / 2}
      font-size={cellSize * 0.6}
      font-family="FZLiShu II-S06"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="var(--board-line)"
    >
      <tspan dy="0.15em">楚　河　　汉　界</tspan>
    </text>

    <!-- 九宫 -->
    <g stroke="var(--board-line)" stroke-width={cellSize * 0.03} fill="none">
      <path
        d={`M ${cellSize * 4},${cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}`}
      />
      <path
        d={`M ${cellSize * 4},${8 * cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}`}
      />
    </g>

    <!-- 炮兵位 -->
    <g stroke="var(--board-line)" stroke-width={cellSize * 0.02} fill="none">
      {#each [[2, 3], [8, 3], [2, 8], [8, 8], [3, 4], [5, 4], [7, 4], [3, 7], [7, 7], [5, 7]] as i}
        <path
          d={`M ${i[0] * cellSize},${i[1] * cellSize} m -${3 * margin},-${margin} h ${2 * margin} v -${2 * margin} m ${2 * margin},0 v ${2 * margin} h ${2 * margin} m 0,${2 * margin} h -${2 * margin} v ${2 * margin} m -${2 * margin},0 v -${2 * margin} h -${2 * margin}`}
        />
      {/each}
      {#each [[1, 4], [1, 7]] as i}
        <path
          d={`M ${i[0] * cellSize},${i[1] * cellSize} m ${margin},-${3 * margin} v ${2 * margin} h ${2 * margin} m 0,${2 * margin} h -${2 * margin} v ${2 * margin}`}
        />
      {/each}
      {#each [[9, 4], [9, 7]] as i}
        <path
          d={`M ${i[0] * cellSize},${i[1] * cellSize} m -${3 * margin},-${margin} h ${2 * margin} v -${2 * margin} m 0,${6 * margin} v -${2 * margin} h -${2 * margin}`}
        />
      {/each}
    </g>

    <!-- 棋子 -->
    <g id="xiangqi-pieces">
      {#each renderedBoard as row, x}
        {#each row as piece, y}
          {#if piece}
            <g transform="translate({(x + 1) * cellSize}, {(y + 1) * cellSize})">
              <circle
                r={cellSize * 0.4}
                fill={piece === piece.toUpperCase() ? "var(--piece-red)" : "var(--piece-black)"}
                stroke="var(--board-line)"
                stroke-width={cellSize * 0.04}
              />
              <text
                x="0"
                y="0"
                fill="white"
                font-size={cellSize * 0.45}
                text-anchor="middle"
                dy="0.35em"
              >
                {PIECE_CHARS[piece as keyof typeof PIECE_CHARS]}
              </text>
            </g>
          {/if}
        {/each}
      {/each}
    </g>

    <!-- 标记 -->
    {#if renderedMarkedPos}
      <g
        transform={`translate(${(renderedMarkedPos.x + 1) * cellSize}, ${(renderedMarkedPos.y + 1) * cellSize})`}
      >
        <path
          d={`M ${-0.4 * cellSize},${-0.4 * cellSize + margin} v ${-margin} h ${margin}
              M ${0.4 * cellSize - margin},${-0.4 * cellSize} h ${margin} v ${margin}
              M ${0.4 * cellSize},${0.4 * cellSize - margin} v ${margin} h ${-margin}
              M ${-0.4 * cellSize + margin},${0.4 * cellSize} h ${-margin} v ${-margin}`}
          stroke="var(--color-yellow)"
          stroke-width={cellSize * 0.05}
          fill="var(--color-yellow)"
        />
      </g>
    {/if}
    <!-- 上次走子标记 -->
    {#if showLastMove && renderedLastMove && !renderedMarkedPos}
      <g
        transform={`translate(${(renderedLastMove.from.x + 1) * cellSize}, ${(renderedLastMove.from.y + 1) * cellSize})`}
      >
        <rect
          x={-cellSize * 0.2}
          y={-cellSize * 0.2}
          width={cellSize * 0.4}
          height={cellSize * 0.4}
          fill="yellow"
          opacity="0.8"
        />
      </g>
      <g
        transform={`translate(${(renderedLastMove.to.x + 1) * cellSize}, ${(renderedLastMove.to.y + 1) * cellSize})`}
      >
        <path
          d={`M ${-0.4 * cellSize},${-0.4 * cellSize + margin} v ${-margin} h ${margin}
              M ${0.4 * cellSize - margin},${-0.4 * cellSize} h ${margin} v ${margin}
              M ${0.4 * cellSize},${0.4 * cellSize - margin} v ${margin} h ${-margin}
              M ${-0.4 * cellSize + margin},${0.4 * cellSize} h ${-margin} v ${-margin}`}
          stroke="var(--color-yellow)"
          stroke-width={cellSize * 0.05}
          fill="var(--color-yellow)"
        />
      </g>
    {/if}
  </svg>
</div>

<style>
  .board-container {
    --board-background: var(--xq-board-background, var(--background-primary-alt));
    --board-line: var(--xq-board-line, var(--text-normal));
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-poece-black, var(--color-blue));
    --mark-color: var(--xq-mark-color, var(--color-yellow));
    --text-color: var(--xq-text-color, var(--text-normal));
  }
  .xq-board {
    user-select: none;
  }
</style>
