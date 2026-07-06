import fs from 'node:fs';

const CELL = 50;
const PAD = CELL * 0.5;
const COLS = 9;
const ROWS = 10;
const W = (COLS - 1) * CELL + PAD * 2;
const H = (ROWS - 1) * CELL + PAD * 2;
const MARGIN = CELL * 0.1;

function buildSvg(lineColor) {
  const lines = [];
  const L = lineColor;

  lines.push(`<rect x="${PAD - MARGIN}" y="${PAD - MARGIN}" width="${(COLS - 1) * CELL + 2 * MARGIN}" height="${(ROWS - 1) * CELL + 2 * MARGIN}" fill="none" stroke="${L}" stroke-width="3"/>`);
  lines.push(`<rect x="${PAD}" y="${PAD}" width="${(COLS - 1) * CELL}" height="${(ROWS - 1) * CELL}" fill="none" stroke="${L}" stroke-width="1"/>`);

  for (let y = 0; y < ROWS; y++) {
    const yy = PAD + y * CELL;
    lines.push(`<line x1="${PAD}" y1="${yy}" x2="${PAD + (COLS - 1) * CELL}" y2="${yy}" stroke="${L}" stroke-width="1"/>`);
  }
  for (let x = 0; x < COLS; x++) {
    const xx = PAD + x * CELL;
    lines.push(`<line x1="${xx}" y1="${PAD}" x2="${xx}" y2="${PAD + 4 * CELL}" stroke="${L}" stroke-width="1"/>`);
  }
  for (let x = 0; x < COLS; x++) {
    const xx = PAD + x * CELL;
    lines.push(`<line x1="${xx}" y1="${PAD + 5 * CELL}" x2="${xx}" y2="${PAD + 9 * CELL}" stroke="${L}" stroke-width="1"/>`);
  }

  lines.push(`<line x1="${PAD + 3 * CELL}" y1="${PAD}" x2="${PAD + 5 * CELL}" y2="${PAD + 2 * CELL}" stroke="${L}" stroke-width="1"/>`);
  lines.push(`<line x1="${PAD + 5 * CELL}" y1="${PAD}" x2="${PAD + 3 * CELL}" y2="${PAD + 2 * CELL}" stroke="${L}" stroke-width="1"/>`);
  lines.push(`<line x1="${PAD + 3 * CELL}" y1="${PAD + 7 * CELL}" x2="${PAD + 5 * CELL}" y2="${PAD + 9 * CELL}" stroke="${L}" stroke-width="1"/>`);
  lines.push(`<line x1="${PAD + 5 * CELL}" y1="${PAD + 7 * CELL}" x2="${PAD + 3 * CELL}" y2="${PAD + 9 * CELL}" stroke="${L}" stroke-width="1"/>`);

  const riverY = PAD + 4.5 * CELL;
  lines.push(`<text x="${PAD + 1.5 * CELL}" y="${riverY}" font-size="${CELL * 0.6}" fill="${L}" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">楚 河</text>`);
  lines.push(`<text x="${PAD + 6.5 * CELL}" y="${riverY}" font-size="${CELL * 0.6}" fill="${L}" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">漢 界</text>`);

  const starPositions = [[1,2],[7,2],[1,7],[7,7],[2,3],[4,3],[6,3],[2,6],[4,6],[6,6]];
  for (const [sx, sy] of starPositions) {
    const cx = PAD + sx * CELL, cy = PAD + sy * CELL, d = CELL * 0.15, d2 = CELL * 0.08;
    lines.push(`<path d="M ${cx - d2},${cy - d - d2} v ${d} h ${-d} M ${cx + d2},${cy - d - d2} v ${d} h ${d} M ${cx + d2},${cy + d + d2} v ${-d} h ${d} M ${cx - d2},${cy + d + d2} v ${-d} h ${-d}" stroke="${L}" stroke-width="1" fill="none"/>`);
  }

  const edgeStars = [[0,3],[0,6],[8,3],[8,6]];
  for (const [ex, ey] of edgeStars) {
    const cx = PAD + ex * CELL, cy = PAD + ey * CELL, d = CELL * 0.15, d2 = CELL * 0.08;
    if (ex === 0) {
      lines.push(`<path d="M ${cx + d2},${cy - d - d2} v ${d} h ${d} M ${cx + d2},${cy + d + d2} v ${-d} h ${d}" stroke="${L}" stroke-width="1" fill="none"/>`);
    } else {
      lines.push(`<path d="M ${cx - d2},${cy - d - d2} v ${d} h ${-d} M ${cx - d2},${cy + d + d2} v ${-d} h ${-d}" stroke="${L}" stroke-width="1" fill="none"/>`);
    }
  }

  const inner = lines.join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n  ${inner}\n</svg>`;
}

const svgDark = buildSvg('#555');
const svgLight = buildSvg('#ccc');
const b64Dark = Buffer.from(svgDark, 'utf-8').toString('base64');
const b64Light = Buffer.from(svgLight, 'utf-8').toString('base64');

const output = `export const GRID_DARK_B64 = '${b64Dark}';
export const GRID_LIGHT_B64 = '${b64Light}';
`;

fs.writeFileSync('src/grid-b64.ts', output, 'utf-8');
console.log(`Generated src/grid-b64.ts (dark: ${b64Dark.length} chars, light: ${b64Light.length} chars)`);
