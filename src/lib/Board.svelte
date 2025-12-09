<script lang="ts">
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
  }

  let {
    settings,
    board,
    lastMove = null,
    markedPos = null,
    currentTurn,
    eventBus,
    rotated,
  }: Props = $props();

  let Bnum = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  let Rnum = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
  let TopNum: string[] = $state([]);
  let BotNum: string[] = $state([]);

  $effect(() => {
    if (rotated) {
      TopNum = Rnum;
      BotNum = Bnum.reverse();
    } else {
      TopNum = Bnum;
      BotNum = [...Rnum].reverse();
    }
  });

  let renderedBoard: IBoard = $derived(rotated ? rotateBoard(board) : board);
  let renderedMarkedPos: IPosition | null = $derived(
    rotated && markedPos ? rotatePos(markedPos) : markedPos,
  );

  let { cellSize, showLastMove, showTurnBorder, showCoordinateLabels } = $derived(settings);
  let margin = $derived(cellSize * 0.1);
  let width = $derived(cellSize * 10);
  let height = $derived(cellSize * 11);

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

  let renderedLastMove = $derived(
    rotated && lastMove ? { from: rotatePos(lastMove.from), to: rotatePos(lastMove.to) } : lastMove,
  );

  function handleClick(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const boardRect = svg.getBoundingClientRect();

    // 获取SVG的实际渲染宽度和高度
    const actualWidth = svg.clientWidth;
    const actualHeight = svg.clientHeight;

    // 计算实际的单元格大小
    const actualCellSize = actualWidth / 10; // 棋盘有10列（1-9，加上边框）

    // 计算鼠标在SVG内部的相对坐标
    const mouseX = e.clientX - boardRect.left;
    const mouseY = e.clientY - boardRect.top - (actualHeight - (actualWidth * 11) / 10) / 2; // 调整Y坐标以适应宽高比

    // 根据实际单元格大小计算网格坐标
    let gridX = Math.round(mouseX / actualCellSize) - 1;
    let gridY = Math.round(mouseY / actualCellSize) - 1;

    if (gridX >= 0 && gridX < 9 && gridY >= 0 && gridY < 10) {
      const pos = rotated ? rotatePos({ x: gridX, y: gridY }) : { x: gridX, y: gridY };
      eventBus.emit("click", pos);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="board-container">
  <svg {width} {height} viewBox={`0 0 ${width} ${height}`} class="xq-board" onclick={handleClick}>
    <!-- 背景 -->
    <rect
      x={cellSize * 0.1}
      y={cellSize * 0.1}
      width={width - cellSize * 0.2}
      height={height - cellSize * 0.2}
      fill="var(--board-background)"
      rx="5"
      stroke={showTurnBorder
        ? currentTurn === "red"
          ? "var(--piece-red)"
          : "var(--piece-black)"
        : "var(--background-modifier-border)"}
      stroke-width={cellSize * 0.1}
    />

    <!-- 外框 -->
    <path
      d={`M ${cellSize - margin},${cellSize - margin} h ${8 * cellSize + 2 * margin} v ${9 * cellSize + 2 * margin} h -${8 * cellSize + 2 * margin} Z`}
      stroke="var(--board-line)"
      stroke-width={cellSize * 0.08}
      fill="none"
    />
    <!-- 内框 -->
    <path
      d={`M ${cellSize},${cellSize} h ${8 * cellSize} v ${9 * cellSize} h -${8 * cellSize} Z`}
      stroke="var(--board-line)"
      stroke-width={cellSize * 0.04}
      fill="none"
    />

    <!-- 横线 -->
    {#each Array(8).fill(0) as _, i}
      <path
        d={`M ${cellSize},${cellSize * (i + 2)} h ${cellSize * 8}`}
        stroke="var(--board-line)"
        stroke-width={cellSize * 0.04}
        fill="none"
      />
    {/each}

    <!-- 上/下竖线 -->
    {#each Array(7).fill(0) as _, i}
      <path
        d={`M ${cellSize * (i + 2)},${cellSize} v ${cellSize * 4}`}
        stroke="var(--board-line)"
        stroke-width={cellSize * 0.04}
        fill="none"
      />
      <path
        d={`M ${cellSize * (i + 2)},${cellSize * 6} v ${cellSize * 4}`}
        stroke="var(--board-line)"
        stroke-width={cellSize * 0.04}
        fill="none"
      />
    {/each}

    <!-- 楚河汉界 -->
    {#each [["楚", 1.9], ["河", 3.1], ["漢", 5.9], ["界", 7.1]] as [char, pos]}
      <text
        x={(+pos + 0.5) * cellSize}
        y={height / 2}
        font-size={cellSize * 0.6}
        text-anchor="middle"
        dominant-baseline="middle"
        fill="var(--board-line)"
      >
        <tspan dy="0.15em">{char}</tspan>
      </text>
    {/each}

    <!-- 九宫 -->
    <g stroke="var(--board-line)" stroke-width={cellSize * 0.02} fill="none">
      <path
        d={`M ${cellSize * 4},${cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}`}
      />
      <path
        d={`M ${cellSize * 4},${8 * cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}`}
      />
    </g>

    <!-- 炮兵位 -->
    <g stroke="var(--board-line)" stroke-width={cellSize * 0.03} fill="none">
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

    <!-- 坐标标签 -->
    {#if showCoordinateLabels}
      <g text-anchor="middle" dominant-baseline="middle" fill="var(--text-color)">
        <g font-size={rotated === true ? cellSize * 0.25 : cellSize * 0.33}>
          {#each TopNum as num, i}
            <text x={(i + 1) * cellSize} y={3.5 * margin}>
              <tspan dy="0.15em">{num}</tspan>
            </text>
          {/each}
        </g>
        <g font-size={rotated === true ? cellSize * 0.33 : cellSize * 0.25}>
          {#each BotNum as num, i}
            <text x={(i + 1) * cellSize} y={height - 3.5 * margin}>
              <tspan dy="0.15em">{num}</tspan>
            </text>
          {/each}</g
        >
      </g>
    {/if}

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
                stroke-width={cellSize * 0.02}
              />
              <text
                x="0"
                y="0"
                fill="white"
                font-size={cellSize * 0.45}
                text-anchor="middle"
                dy="0.41em"
              >
                {PIECE_CHARS[piece as keyof typeof PIECE_CHARS]}
              </text>
            </g>
          {/if}
        {/each}
      {/each}
    </g>

    <!-- 单个位置标记 -->
    {#if renderedMarkedPos}
      <g
        class="marked-position"
        transform={`translate(${(renderedMarkedPos.x + 1) * cellSize}, ${(renderedMarkedPos.y + 1) * cellSize})`}
      >
        <path
          d={`M ${-0.4 * cellSize},${-0.4 * cellSize + margin} v ${-margin} h ${margin}
              M ${0.4 * cellSize - margin},${-0.4 * cellSize} h ${margin} v ${margin}
              M ${0.4 * cellSize},${0.4 * cellSize - margin} v ${margin} h ${-margin}
              M ${-0.4 * cellSize + margin},${0.4 * cellSize} h ${-margin} v ${-margin}`}
          stroke="var(--board-line)"
          stroke-width={cellSize * 0.04}
          fill="none"
        />
      </g>
    {/if}

    <!-- 上次走子标记 -->
    {#if showLastMove && renderedLastMove && !renderedMarkedPos}
      <g class="last-move-marker">
        <!-- 起始位置标记 -->
        <g
          transform={`translate(${(renderedLastMove.from.x + 1) * cellSize}, ${(renderedLastMove.from.y + 1) * cellSize})`}
        >
          <rect
            x={-cellSize * 0.2}
            y={-cellSize * 0.2}
            width={cellSize * 0.4}
            height={cellSize * 0.4}
            fill={currentTurn === "red" ? "var(--piece-black)" : "var(--piece-red)"}
            stroke="var(--board-line)"
            stroke-width={cellSize * 0.02}
            opacity="0.7"
          />
        </g>
        <!-- 结束位置标记 -->
        <g
          transform={`translate(${(renderedLastMove.to.x + 1) * cellSize}, ${(renderedLastMove.to.y + 1) * cellSize})`}
        >
          <path
            d={`M ${-0.4 * cellSize},${-0.4 * cellSize + margin} v ${-margin} h ${margin}
              M ${0.4 * cellSize - margin},${-0.4 * cellSize} h ${margin} v ${margin}
              M ${0.4 * cellSize},${0.4 * cellSize - margin} v ${margin} h ${-margin}
              M ${-0.4 * cellSize + margin},${0.4 * cellSize} h ${-margin} v ${-margin}`}
            stroke="var(--board-line)"
            stroke-width={cellSize * 0.04}
            fill="none"
          />
        </g>
      </g>
    {/if}
  </svg>
</div>

<style>
  .board-container {
    --board-background: var(--xq-board-background, var(--background-primary-alt));
    --board-line: var(--xq-board-line, var(--text-normal));
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
    --text-color: var(--xq-text-color, var(--text-normal));
  }
  .xq-board {
    user-select: none;
    width: auto;
    height: 100%;
  }
</style>
