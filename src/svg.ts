import { XQRenderChild } from './xiangqi';
import { IOptions } from './parseSource';
import { ISettings, IPiece, PIECE_CHARS } from './types';

// 定义主题配置
export const themes = {
  light: {
    cellSize: 50,
    bgColor: ' #E8C887',
    lineColor: ' #000000',
    textColor: ' #000000',
    red: ' #861818',
    blue: ' #1B38A2',
  },
  dark: {
    cellSize: 50,
    bgColor: ' #2d2d2d',
    lineColor: ' #ffffff',
    textColor: ' #ffffff',
    red: ' #861818',
    blue: ' #1B38A2',
  },
};
export function genBoardSVG(settings: ISettings, options: IOptions): Element {
  const boardString = boardSvgString(settings, options);
  return new DOMParser().parseFromString(boardString, 'image/svg+xml').documentElement;
}
function boardSvgString(settings: ISettings, options: IOptions): string {
  const { theme, cellSize } = settings;
  const { bgColor, lineColor, textColor } = themes[theme];
  const margin = cellSize * 0.1;
  const width = cellSize * 10;
  const height = cellSize * 11;
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" 
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg" class="xq-board">
  <rect id="boardRect" width="${width}" height="${height}" fill="${bgColor}" rx="5" stroke="${lineColor}" stroke-width="${cellSize * 0.1}"/>
  <!-- 网格 -->
  <path d="M ${cellSize - margin},${cellSize - margin} h ${8 * cellSize + 2 * margin} v ${9 * cellSize + 2 * margin} h -${8 * cellSize + 2 * margin} Z" stroke="${lineColor}" stroke-width="${cellSize * 0.08}" fill="none"/>
  <g stroke="${lineColor}" stroke-width="${cellSize * 0.04}" fill="none">
    ${Array(10)
      .fill(0)
      .map(
        (_, i) => `
    <path d="M ${cellSize},${cellSize * (i + 1)} h ${cellSize * 8}"/> `,
      )
      .join('')}
    ${Array(9)
      .fill(0)
      .map(
        (_, i) => `
    <path d="M ${cellSize * (i + 1)},${cellSize} v ${cellSize * 4}"/> `,
      )
      .join('')}
    ${Array(9)
      .fill(0)
      .map(
        (_, i) => `
    <path d="M ${cellSize * (i + 1)},${cellSize * 6} v ${cellSize * 4}"/>`,
      )
      .join('')}
    <line x1="${cellSize}" y1="${cellSize}" x2="${cellSize}" y2="${10 * cellSize}" stroke="${lineColor}" stroke-width="2"/>
    <line x1="${9 * cellSize}" y1="${cellSize}" x2="${9 * cellSize}" y2="${cellSize * 10}" stroke="${lineColor}" stroke-width="2"/>
  </g>
  <!-- 九宫 -->
  <g stroke="${lineColor}" stroke-width="${cellSize * 0.03}" fill="none">
    <path d="M ${cellSize * 4},${cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}"/>
    <path d="M ${cellSize * 4},${8 * cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}"/>
  </g>
    <!-- 河界 -->
  <g transform="translate(${5 * cellSize}, ${5.5 * cellSize})">
  <text x="0" y="0"
    font-size="${cellSize * 0.6}" font-family="FZLiShu II-S06"
    text-anchor="middle" dominant-baseline="middle"
    transform="${options.rotated ? 'rotate(180)' : ''}"
    fill="${textColor}">楚　河　　汉　界</text>
  </g>
  <!-- 炮兵位 -->
  <g stroke="${lineColor}" stroke-width="${cellSize * 0.02}" fill="none">
    ${[
      [2, 3],
      [8, 3],
      [2, 8],
      [8, 8],
      [3, 4],
      [5, 4],
      [7, 4],
      [3, 7],
      [7, 7],
      [5, 7],
    ]
      .map(
        (i) => `
    <path d="M ${i[0] * cellSize},${i[1] * cellSize} m -${3 * margin},-${margin} h ${2 * margin} v -${2 * margin} m ${2 * margin},0 v ${2 * margin} h ${2 * margin} m 0,${2 * margin} h -${2 * margin} v ${2 * margin} m -${2 * margin},0 v -${2 * margin} h -${2 * margin}" />`,
      )
      .join('')}
    ${[
      [1, 4],
      [1, 7],
    ]
      .map(
        (i) => `
    <path d="M ${i[0] * cellSize},${i[1] * cellSize} m ${margin},-${3 * margin} v ${2 * margin} h ${2 * margin} m 0,${2 * margin} h -${2 * margin} v ${2 * margin}"/>`,
      )
      .join('')}
    ${[
      [9, 4],
      [9, 7],
    ]
      .map(
        (i) => `
    <path d="M ${i[0] * cellSize},${i[1] * cellSize} m -${3 * margin},-${margin} h ${2 * margin} v -${2 * margin} m 0,${6 * margin} v -${2 * margin} h -${2 * margin}" />`,
      )
      .join('')}
  </g>
  <g id="xiangqi-pieces"></g>
</svg>`;
}
export function createPieceSvg(piece: IPiece, settings: ISettings, options: IOptions): Element {
  const gString = pieceString(piece, settings, options); // 返回 <g>...</g> 字符串
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${gString}</svg>`;
  const tempSvg = new DOMParser().parseFromString(wrapped, 'image/svg+xml').documentElement;
  const gNode = tempSvg.querySelector('g');
  return gNode as Element;
}
function pieceString(piece: IPiece, settings: ISettings, options: IOptions): string {
  const { type, position } = piece;
  const { x, y } = position;
  const { theme, cellSize } = settings;
  const isRed = type === type.toUpperCase();
  const { red, blue } = themes[theme];
  // const pieceColor = isRed ? '#c00' : '#000';
  const pieceColor = isRed ? `${red}` : `${blue}`;

  return `
  <g class="xiangqi-piece" 
     data-type="${type}"
     transform="translate(${(x + 1) * cellSize}, ${(y + 1) * cellSize})">
    <circle cx="0" cy="0"
            r="${cellSize * 0.4}" 
            fill="${pieceColor}" 
            stroke="#fff"/>
    <text x="0" y="0"
          fill="white" 
          font-size="${cellSize * 0.45}" 
          text-anchor="middle" 
          dy="0.35em"
          transform="${options.rotated ? 'rotate(180)' : ''}">
      ${PIECE_CHARS[type]}
    </text>
  </g>
`;
}

export function updateRectStroke(state: XQRenderChild): void {
  if (!state.boardRect) return;

  const { red, blue } = themes[state.settings.theme];
  const strokeColor = state.currentTurn === 'red' ? `${red}` : `${blue}`;

  // 设置 SVG 边框颜色
  state.boardRect.setAttribute('stroke', strokeColor);
  state.boardRect.setAttribute('stroke-width', '4'); // 设置边框宽度，避免太细看不清楚

  // 获取包裹 `SVG` 的父 `div`
  const boardContainer = state.boardRect.closest('div');  // 获取最外层包裹 `SVG` 的 div

  if (!boardContainer) return; // 如果没有找到父容器，直接返回

  // 设置包裹 `div` 的边框颜色（与 SVG 边框一致）
  boardContainer.style.borderColor = strokeColor;

  // 给包裹 `div` 添加发光效果
  boardContainer.style.boxShadow = `0 0 15px ${strokeColor}`; // 添加光晕效果
}
