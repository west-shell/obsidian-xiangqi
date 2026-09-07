/**
 * 根据背景色的感知亮度自动选择黑/白前景色。
 * YIQ 公式：> 128 视为亮背景，配黑字；否则配白字。
 * @param bg 十六进制颜色（#rgb 或 #rrggbb）
 */
export function contrastColor(bg: string): string {
  let hex = bg.trim().replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return "#fff";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return (299 * r + 587 * g + 114 * b) / 1000 > 128 ? "#000" : "#fff";
}
