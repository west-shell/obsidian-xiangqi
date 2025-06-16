import { ISettings, IPiece, PIECE_CHARS } from './types';

// 定义主题配置
const themes = {
    light: {
        cellSize: 50,
        bgColor: '#E8C887',
        lineColor: '#000000',
        textColor: '#000000',
    },
    dark: {
        cellSize: 50,
        bgColor: '#2d2d2d',
        lineColor: '#ffffff',
        textColor: '#ffffff',
    },
};
export function generateBoardSvg(settings: ISettings): Element {
    const boardString = boardSvgString(settings);
    return new DOMParser().parseFromString(boardString, 'image/svg+xml').documentElement;
}
function boardSvgString(settings: ISettings): string {
    const { theme, cellSize } = settings;
    const { bgColor, lineColor, textColor } = themes[theme];
    const margin = cellSize * 0.1;
    const width = cellSize * 10
    const height = cellSize * 11
    return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${bgColor}" rx="5" stroke="${lineColor}" stroke-width="${cellSize * 0.06}"/>
  <!-- 网格 -->
  <path d="M ${cellSize - margin},${cellSize - margin} h ${8 * cellSize + 2 * margin} v ${9 * cellSize + 2 * margin} h -${8 * cellSize + 2 * margin} Z" stroke="${lineColor}" stroke-width="${cellSize * 0.08}" fill="none"/>
  <g stroke="${lineColor}" stroke-width="${cellSize * 0.04}" fill="none">
    ${Array(10)
            .fill(0)
            .map(
                (_, i) => `
    <path d="M ${cellSize},${cellSize * (i + 1)} h ${cellSize * 8}"/>
  `,
            )
            .join('')}
      ${Array(9)
            .fill(0)
            .map(
                (_, i) => `
    <path d="M ${cellSize * (i + 1)},${cellSize} v ${cellSize * 4}"/>
  `,
            )
            .join('')}
        ${Array(9)
            .fill(0)
            .map(
                (_, i) => `
    <path d="M ${cellSize * (i + 1)},${cellSize * 6} v ${cellSize * 4}"/>
  `,
            )
            .join('')}
  <line x1="${cellSize}" y1="${cellSize}" x2="${cellSize}" y2="${cellSize * 10}" stroke="${lineColor}" stroke-width="2"/>
  <line x1="${9 * cellSize}" y1="${cellSize}" x2="${9 * cellSize}" y2="${cellSize * 10}" stroke="${lineColor}" stroke-width="2"/>
  </g>
  <!-- 九宫 -->
  <g stroke="${lineColor}" stroke-width="${cellSize * 0.03}">
    <path d="M ${cellSize * 4},${cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}"/>
          stroke="${lineColor}" stroke-width="${cellSize * 0.04}" fill="none"/>
    <path d="M ${cellSize * 4},${8 * cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}"/>
          stroke="${lineColor}" stroke-width="${cellSize * 0.04}" fill="none"/>
  </g>
  <!-- 楚河汉界 -->
  <text x="${5 * cellSize}" y="${5 * cellSize + 7 * margin}" font-size="${cellSize * 0.6}" text-anchor="middle" font-family="SimSun" fill="${textColor}">楚　河　　汉　界</text>

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
            [5, 7],
            [7, 7],
        ]
            .map(
                (i) => `
    <path d="M ${i[0] * cellSize},${i[1] * cellSize} m -${3 * margin},-${margin} h ${2 * margin}v -${2 * margin} m ${2 * margin},0 v ${2 * margin} h ${2 * margin} m 0,${2 * margin} h -${2 * margin} v ${2 * margin} m -${2 * margin},0 v -${2 * margin} h -${2 * margin}" />`,
            )
            .join('')}
       ${[
            [1, 4],
            [1, 7],
        ]
            .map(
                (i) => `
        <path d="M ${i[0] * cellSize},${i[1] * cellSize} m ${margin},-${3 * margin} v ${2 * margin} h ${2 * margin}  m 0,${2 * margin}  h -${2 * margin}  v ${2 * margin} "/>`,
            )
            .join('')}
       ${[
            [9, 4],
            [9, 7],
        ]
            .map(
                (i) => `
        <path d="M ${i[0] * cellSize},${i[1] * cellSize} m -${3 * margin},-${margin}  h ${2 * margin}  v -${2 * margin}  m 0,${6 * margin}  v -${2 * margin} h -${2 * margin}" />`,
            )
            .join('')}
  </g>
  <g id="xiangqi-pieces"></g>
  <g id="toolbar"></g>
  </svg>`;
}
export function createPieceSvg(piece: IPiece, settings: ISettings): Element {
    const gString = pieceString(piece, settings); // 返回 <g>...</g> 字符串
    const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${gString}</svg>`;
    const tempSvg = new DOMParser().parseFromString(wrapped, 'image/svg+xml').documentElement;
    const gNode = tempSvg.querySelector('g');
    return gNode as Element;
}
function pieceString(piece: IPiece, settings: ISettings): string {
    const { type, position } = piece;
    const { x, y } = position;
    const { theme, cellSize } = settings;
    const isRed = type === type.toUpperCase();
    const pieceColor = isRed ? '#c00' : '#000';

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
          dy="0.35em">
      ${PIECE_CHARS[type]}
    </text>
  </g>
`;
}
