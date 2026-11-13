// ========== Tag Canonicalization ==========
// PGN tag keys/values are stored raw (round-trip safe); these adapters
// map localized (Chinese) tag spellings onto the canonical keys the UI
// reads (Red, Black, Event, Result, ...). Used by the shared
// extractHeaders/parser result-carry; chess-tree uses identity versions.

const TAG_KEY_ALIASES: Record<string, string> = {
  红方: "Red",
  黑方: "Black",
  赛事: "Event",
  比赛: "Event",
  日期: "Date",
  时间: "Date",
  结果: "Result",
  地点: "Site",
  轮次: "Round",
};

const TAG_VALUE_ALIASES: Record<string, string> = {
  红胜: "1-0",
  黑胜: "0-1",
  和棋: "1/2-1/2",
  和局: "1/2-1/2",
};

/** Map a raw PGN tag key onto its canonical key (红方 -> Red). */
export function canonicalTagKey(key: string): string {
  return TAG_KEY_ALIASES[key] ?? key;
}

/** Map a raw PGN tag value onto its canonical value (红胜 -> 1-0). */
export function canonicalTagValue(key: string, value: string): string {
  return key === "Result" ? (TAG_VALUE_ALIASES[value] ?? value) : value;
}

/**
 * Tag line(s) seeded into newly created games and PGN files, matching
 * xiangqiai.com exports. Empty for the chess-tree (standard chess)
 * adapter.
 */
export const DEFAULT_GAME_TAGS: string = '[Game "Chinese Chess"]';
