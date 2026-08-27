import type { MoveGlyph, NodeEval } from "../types";

export type { MoveGlyph };

const GLYPH_DEFS: Record<string, MoveGlyph> = {
  "?!": { symbol: "?!", name: "Inaccuracy", color: "#56b4e9" },
  "?": { symbol: "?", name: "Mistake", color: "#e69f00" },
  "??": { symbol: "??", name: "Blunder", color: "#df5353" },
  "!": { symbol: "!", name: "Good move", color: "#22ac38" },
  "!!": { symbol: "!!", name: "Brilliant", color: "#168226" },
  "!?": { symbol: "!?", name: "Interesting", color: "#ea45d8" },
};

export { GLYPH_DEFS };

function winningChances(cp: number): number {
  return 2 / (1 + Math.exp(-0.003_682_08 * cp)) - 1;
}

function winningChancesFromEval(ev: NodeEval): number {
  if (ev.scoreType === "mate") {
    if (ev.score === 0) return 0;
    return ev.score > 0 ? 1 : -1;
  }
  return winningChances(ev.score);
}

export function computeGlyph(
  prevEval: NodeEval | undefined,
  curEval: NodeEval | undefined,
  color: string | null,
): MoveGlyph | null {
  if (!prevEval || !curEval || !color) return null;

  const prevChances = winningChancesFromEval(prevEval);
  const curChances = winningChancesFromEval(curEval);

  let delta = curChances - prevChances;
  if (color === "black") delta = -delta;

  if (delta <= -0.3) return GLYPH_DEFS["??"];
  if (delta <= -0.2) return GLYPH_DEFS["?"];
  if (delta <= -0.1) return GLYPH_DEFS["?!"];
  if (delta >= 0.2) return GLYPH_DEFS["!!"];
  if (delta >= 0.1) return GLYPH_DEFS["!"];
  if (delta >= 0.05) return GLYPH_DEFS["!?"];

  return null;
}
