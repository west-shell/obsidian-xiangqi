import { PRIMARY_PLAYER_KEY } from "../chess";
import type { ChessNode, NodeMap } from "../types";

/**
 * Player bars (lichess study style): names / titles / ratings above and
 * below the board, plus per-side remaining clock from lichess `[%clk]`
 * comments. Header names come from the variant adapter so xiangqi reads
 * [Red] where chess reads [White]; [Black] is shared by both variants.
 */

export interface PlayerInfo {
  name?: string;
  title?: string;
  rating?: string;
}

function headerValue(
  headers: Map<string, string>,
  key: string,
): string | undefined {
  const raw = headers.get(key);
  return raw && raw !== "?" ? raw : undefined;
}

/** Player identity from the PGN headers ([White]/[Red], Title, Elo). */
export function getPlayerInfo(
  headers: Map<string, string> | undefined,
  first: boolean,
): PlayerInfo {
  if (!headers) return {};
  const base = first ? PRIMARY_PLAYER_KEY : "Black";
  return {
    name: headerValue(headers, base),
    title: headerValue(headers, `${base}Title`),
    rating: headerValue(headers, `${base}Elo`),
  };
}

/**
 * Initial time in seconds from [TimeControl], undefined when untimed.
 * Accepts "300+0" (sudden death), "40/7200+30" (moves/seconds per period,
 * the last period's base wins) and rejects "-", "?" and correspondence
 * "15d10+5" forms.
 */
export function initialClockSeconds(
  headers: Map<string, string>,
): number | undefined {
  const tc = headers.get("TimeControl");
  if (!tc || tc === "-" || tc === "?") return undefined;
  const base = tc.split("+")[0];
  const secondsStr = base.includes("/") ? base.split("/").pop()! : base;
  if (!/^\d+$/.test(secondsStr)) return undefined;
  const seconds = Number(secondsStr);
  return seconds > 0 ? seconds : undefined;
}

/**
 * Remaining clock ("H:MM:SS") for `color` at `node`: the nearest `[%clk]`
 * of that color walking up the branch. Undefined when the side has no
 * clock comment yet (callers fall back to the initial time).
 */
export function clockForColor(
  node: ChessNode,
  nodeMap: NodeMap,
  color: "white" | "black",
): string | undefined {
  let cur: ChessNode | undefined = node;
  while (cur) {
    if (cur.color === color && cur.clock !== undefined) return cur.clock;
    cur = cur.parentID ? nodeMap.get(cur.parentID) : undefined;
  }
  return undefined;
}

/** Display form: strips the hours part under an hour ("0:05:00" → "5:00"). */
export function formatClock(clock: string): string {
  const m = clock.match(/^(\d+):([0-5]\d):([0-5]\d)$/);
  if (!m) return clock;
  return Number(m[1]) > 0 ? clock : `${Number(m[2])}:${m[3]}`;
}

/** Seconds → the same display form as formatClock (300 → "5:00"). */
export function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return formatClock(
    `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
  );
}
