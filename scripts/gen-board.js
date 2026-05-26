/**
 * gen-board.js — 生成中国象棋棋盘 SVG 并输出到 CSS 文件
 *
 * 将棋盘 SVG 硬编码为 base64 data URI，嵌入到 CSS 中，
 * 如同 chessground.cburnett.css 对棋子做的那样。
 *
 * 用法：node scripts/gen-board.js
 */

import fs from 'fs';

const CELL = 50;
const PAD = CELL * 0.5;
const COLS = 9;
const ROWS = 10;
const W = (COLS - 1) * CELL + PAD * 2; // 450
const H = (ROWS - 1) * CELL + PAD * 2; // 500

// 实际颜色值（代替 CSS 变量）
const BG = '#d0b899b4';
const LINE = '#555';
const MARGIN = CELL * 0.1;

function buildSvg() {
  const lines = [];

  // 背景
  lines.push(`<rect width="${W}" height="${H}" fill="${BG}" rx="8"/>`);

  // 外框
  lines.push(
    `<rect x="${PAD - MARGIN}" y="${PAD - MARGIN}" width="${(COLS - 1) * CELL + 2 * MARGIN}" height="${(ROWS - 1) * CELL + 2 * MARGIN}" fill="none" stroke="${LINE}" stroke-width="3"/>`,
  );
  lines.push(
    `<rect x="${PAD}" y="${PAD}" width="${(COLS - 1) * CELL}" height="${(ROWS - 1) * CELL}" fill="none" stroke="${LINE}" stroke-width="1"/>`,
  );

  // 横线
  for (let y = 0; y < ROWS; y++) {
    const yy = PAD + y * CELL;
    lines.push(
      `<line x1="${PAD}" y1="${yy}" x2="${PAD + (COLS - 1) * CELL}" y2="${yy}" stroke="${LINE}" stroke-width="1"/>`,
    );
  }

  // 上半部竖线
  for (let x = 0; x < COLS; x++) {
    const xx = PAD + x * CELL;
    lines.push(
      `<line x1="${xx}" y1="${PAD}" x2="${xx}" y2="${PAD + 4 * CELL}" stroke="${LINE}" stroke-width="1"/>`,
    );
  }

  // 下半部竖线
  for (let x = 0; x < COLS; x++) {
    const xx = PAD + x * CELL;
    lines.push(
      `<line x1="${xx}" y1="${PAD + 5 * CELL}" x2="${xx}" y2="${PAD + 9 * CELL}" stroke="${LINE}" stroke-width="1"/>`,
    );
  }

  // 九宫斜线
  lines.push(
    `<line x1="${PAD + 3 * CELL}" y1="${PAD}" x2="${PAD + 5 * CELL}" y2="${PAD + 2 * CELL}" stroke="${LINE}" stroke-width="1"/>`,
  );
  lines.push(
    `<line x1="${PAD + 5 * CELL}" y1="${PAD}" x2="${PAD + 3 * CELL}" y2="${PAD + 2 * CELL}" stroke="${LINE}" stroke-width="1"/>`,
  );
  lines.push(
    `<line x1="${PAD + 3 * CELL}" y1="${PAD + 7 * CELL}" x2="${PAD + 5 * CELL}" y2="${PAD + 9 * CELL}" stroke="${LINE}" stroke-width="1"/>`,
  );
  lines.push(
    `<line x1="${PAD + 5 * CELL}" y1="${PAD + 7 * CELL}" x2="${PAD + 3 * CELL}" y2="${PAD + 9 * CELL}" stroke="${LINE}" stroke-width="1"/>`,
  );

  // 楚河汉界
  const riverY = PAD + 4.5 * CELL;
  lines.push(
    `<text x="${PAD + 1.5 * CELL}" y="${riverY}" font-size="${CELL * 0.6}" fill="${LINE}" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">楚 河</text>`,
  );
  lines.push(
    `<text x="${PAD + 6.5 * CELL}" y="${riverY}" font-size="${CELL * 0.6}" fill="${LINE}" text-anchor="middle" dominant-baseline="middle" font-family="serif" dy="0.1em">漢 界</text>`,
  );

  // 星标
  const starPositions = [
    [1, 2],
    [7, 2],
    [1, 7],
    [7, 7],
    [2, 3],
    [4, 3],
    [6, 3],
    [2, 6],
    [4, 6],
    [6, 6],
  ];
  for (const [sx, sy] of starPositions) {
    const cx = PAD + sx * CELL;
    const cy = PAD + sy * CELL;
    const d = CELL * 0.15;
    const d2 = CELL * 0.08;
    lines.push(
      `<path d="M ${cx - d2},${cy - d - d2} v ${d} h ${-d} M ${cx + d2},${cy - d - d2} v ${d} h ${d} M ${cx + d2},${cy + d + d2} v ${-d} h ${d} M ${cx - d2},${cy + d + d2} v ${-d} h ${-d}" stroke="${LINE}" stroke-width="1" fill="none"/>`,
    );
  }

  // 边星
  const edgeStars = [
    [0, 3],
    [0, 6],
    [8, 3],
    [8, 6],
  ];
  for (const [ex, ey] of edgeStars) {
    const cx = PAD + ex * CELL;
    const cy = PAD + ey * CELL;
    const d = CELL * 0.15;
    const d2 = CELL * 0.08;
    if (ex === 0) {
      lines.push(
        `<path d="M ${cx + d2},${cy - d - d2} v ${d} h ${d} M ${cx + d2},${cy + d + d2} v ${-d} h ${d}" stroke="${LINE}" stroke-width="1" fill="none"/>`,
      );
    } else {
      lines.push(
        `<path d="M ${cx - d2},${cy - d - d2} v ${d} h ${-d} M ${cx - d2},${cy + d + d2} v ${-d} h ${-d}" stroke="${LINE}" stroke-width="1" fill="none"/>`,
      );
    }
  }

  // 坐标标签（红方视角）
  // const topNums = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  // const botNums = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
  // for (let i = 0; i < 9; i++) {
  //   lines.push(`<text x="${PAD + i * CELL}" y="${PAD * 0.38}" font-size="${CELL * 0.25}" fill="${LINE}" text-anchor="middle" dominant-baseline="middle">${topNums[i]}</text>`);
  //   lines.push(`<text x="${PAD + i * CELL}" y="${H - PAD * 0.38}" font-size="${CELL * 0.25}" fill="${LINE}" text-anchor="middle" dominant-baseline="middle">${botNums[i]}</text>`);
  // }`

  const inner = lines.join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${inner}
</svg>`;
}

// ---- 生成 CSS ----
const svg = buildSvg();
const b64 = Buffer.from(svg, 'utf-8').toString('base64');

const css = `/**
 * chessground.board.css — 中国象棋棋盘背景图
 *
 * 将 SVG 棋盘网格硬编码为 base64 data URI。
 * 仅包含棋盘背景，交互样式见 chessground.base.css。
 *
 * 生成命令：node scripts/gen-board.js
 */

xq-board {
  background-image: url('data:image/svg+xml;base64,${b64}');
  background-size: 100% 100%;
}
`;

fs.writeFileSync('assets/chessground.board.css', css, 'utf-8');
