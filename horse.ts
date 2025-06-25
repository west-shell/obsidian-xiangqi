function boardSvgString(): string {
    const cellSize: number = 50;
    const bgColor: string = '#2d2d2d';
    const lineColor: string = '#ffffff';
    const textColor: string = '#ffffff';
    const margin = cellSize * 0.1;
    const width = cellSize * 10;
    const height = cellSize * 11;
    return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" 
    xmlns="http://www.w3.org/2000/svg"
    style="user-select: none; cursor: default;">
  <rect width="${width}" height="${height}" fill="${bgColor}" rx="5" stroke="${lineColor}" stroke-width="${cellSize * 0.06}"/>
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
    <line x1="${cellSize}" y1="${cellSize}" x2="${cellSize * 9}" y2="${cellSize}" stroke="${lineColor}" stroke-width="2"/>
    <line x1="${9 * cellSize}" y1="${cellSize}" x2="${9 * cellSize}" y2="${cellSize * 10}" stroke="${lineColor}" stroke-width="2"/>
  </g>
  <!-- 九宫 -->
  <g stroke="${lineColor}" stroke-width="${cellSize * 0.03}" fill="none">
    <path d="M ${cellSize * 4},${cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}"/>
    <path d="M ${cellSize * 4},${8 * cellSize} l ${cellSize * 2} ${cellSize * 2} m 0,${-2 * cellSize} l ${-2 * cellSize} ${2 * cellSize}"/>
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
  <g id="xiangqi-pieces">
 ${Array.from({ length: 9 }, (_, col) =>
     Array.from(
         { length: 10 },
         (_, row) => `
    <g class="xiangqi-piece" 
    transform="translate(${(col + 1) * cellSize}, ${(row + 1) * cellSize})">
    <circle cx="0" cy="0"
            r="${cellSize * 0.3}" 
            stroke="#fff"/>
    <text x="0" y="0"
          fill="white" 
          font-size="${cellSize * 0.45}" 
          text-anchor="middle" 
          dy="0.35em">
      ${minHorseSteps(2, 10, col + 1, row + 1)}
    </text>
  </g> `,
     ),
 )
     .flat()
     .join('\n')}
      <g class="xiangqi-piece" 
     transform="translate(${2 * cellSize}, ${10 * cellSize})">
    <circle cx="0" cy="0"
            r="${cellSize * 0.4}" 
            fill="red" 
            stroke="#fff"/>
    <text x="0" y="0"
          fill="white" 
          font-size="${cellSize * 0.45}" 
          text-anchor="middle" 
          dy="0.35em">
      马
    </text>
  </g>
  </g>
</svg>`;
}
console.log(boardSvgString());

function minHorseSteps(x1: number, y1: number, x2: number, y2: number): number {
    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);
    if (dx === 0 && dy === 0) return 0;
    // 对称性处理：确保 dx >= dy
    if (dx < dy) [dx, dy] = [dy, dx];
    // 已知最优解规律
    if (dx === 1 && dy === 0) return 3;
    if (dx === 2 && dy === 2) return 4;
    // 通用公式
    const steps = Math.max(Math.ceil(dx / 2), Math.ceil((dx + dy) / 3));
    return steps + ((dx + dy + steps) % 2);
}
