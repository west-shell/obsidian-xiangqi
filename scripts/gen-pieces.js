const svgTemplate = (
  strokeColor,
  char,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">
  <circle cx="22.5" cy="22.5" r="20" fill="#F5E6C8" stroke="${strokeColor}" stroke-width="2"/>
  <circle cx="22.5" cy="22.5" r="17" fill="none" stroke="${strokeColor}" stroke-width="0.8"/>
  <text x="22.5" y="22.5" text-anchor="middle" dominant-baseline="central" font-size="24" font-weight="bold" fill="${strokeColor}" font-family="SimSun, 'Noto Serif SC', serif">${char}</text>
</svg>`;

const pieces = [
  ['king', 'white', '帥', '#CC0000'],
  ['advisor', 'white', '仕', '#CC0000'],
  ['bishop', 'white', '相', '#CC0000'],
  ['rook', 'white', '俥', '#CC0000'],
  ['knight', 'white', '傌', '#CC0000'],
  ['queen', 'white', '炮', '#CC0000'],
  ['pawn', 'white', '兵', '#CC0000'],
  ['king', 'black', '將', '#1A1A1A'],
  ['advisor', 'black', '士', '#1A1A1A'],
  ['bishop', 'black', '象', '#1A1A1A'],
  ['rook', 'black', '車', '#1A1A1A'],
  ['knight', 'black', '馬', '#1A1A1A'],
  ['queen', 'black', '砲', '#1A1A1A'],
  ['pawn', 'black', '卒', '#1A1A1A'],
];

const lines = ['/** Chinese chess piece SVGs - generated */'];
for (const [role, color, char, stroke] of pieces) {
  const svg = svgTemplate(stroke, char);
  const b64 = Buffer.from(svg, 'utf-8').toString('base64');
  lines.push(`.xq-wrap piece.${role}.${color} {`);
  lines.push(`  background-image: url('data:image/svg+xml;base64,${b64}');`);
  lines.push(`}`);
  lines.push('');
}
process.stdout.write(lines.join('\n'));
