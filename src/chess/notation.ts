import type { Move } from "@weshell/xiangqi.js";

// ========== Move Notation ==========
// Notation modes for the shared move-list settings: Chinese file-rank
// notation (炮二平五) and ICCS coordinates (h2e6).
export const NOTATION_TYPES: readonly {
  value: string;
  labelKey: string;
}[] = [
  { value: "zh", labelKey: "movelist.notation.zh" },
  { value: "iccs", labelKey: "movelist.notation.iccs" },
];
export const DEFAULT_NOTATION_TYPE = "zh";

export function getMoveNotation(move: Move, notationType?: string): string {
  if (notationType === "iccs") {
    return move.iccs ?? move.zh ?? "";
  }
  return move.zh ?? move.iccs ?? "";
}

export function getSaveNotation(move: Move): string {
  return move.iccs ?? move.zh ?? "";
}

// 同音字替换，纠正 TTS 对中文着法的发音（沿用旧版语音播报的替换表）：
// 卒 zú→足、车 jū→局、相 xiàng→象、将 jiàng→酱。
export function applySpeechSubstitutions(text: string): string {
  return text
    .replace(/卒/g, "足")
    .replace(/车/g, "局")
    .replace(/相/g, "象")
    .replace(/将/g, "酱");
}
