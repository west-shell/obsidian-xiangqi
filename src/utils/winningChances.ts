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

/**
 * PGN Numeric Annotation Glyphs (NAG) for the six move-quality symbols.
 * Other NAGs (positional like $14, time trouble, etc.) are legal PGN but
 * have no equivalent glyph model and are ignored.
 */
const NAG_TO_SYMBOL: Record<string, string> = {
  $1: "!",
  $2: "?",
  $3: "!!",
  $4: "??",
  $5: "!?",
  $6: "?!",
};

const SYMBOL_TO_NAG: Record<string, string> = {
  "!": "$1",
  "?": "$2",
  "!!": "$3",
  "??": "$4",
  "!?": "$5",
  "?!": "$6",
};

/**
 * Map a NAG to its glyph. Accepts both the numeric form ("$1".."$6") and
 * the equivalent suffix-symbol form ("!", "?", "!!", "??", "!?", "?!").
 */
export function nagToGlyph(nag: string): MoveGlyph | null {
  const symbol = nag.startsWith("$") ? NAG_TO_SYMBOL[nag] : nag;
  const def = symbol ? GLYPH_DEFS[symbol] : undefined;
  return def ?? null;
}

export function glyphToNag(glyph: MoveGlyph): string | null {
  return SYMBOL_TO_NAG[glyph.symbol] ?? null;
}

/**
 * Positional/annotation NAGs mapped onto the plugin's `#a:` annotation keys.
 * Import mapping is a superset of the export mapping (ANNOTATION_NAG in
 * stringify-pgn) so foreign files with $14/$15/$18/$19 degrade gracefully.
 */
const NAG_TO_ANNOTATION: Record<string, string> = {
  $10: "=",
  $14: "+",
  $15: "-",
  $16: "+",
  $17: "-",
  $18: "+",
  $19: "-",
  $24: "st",
};

export function nagToAnnotation(nag: string): string | null {
  return NAG_TO_ANNOTATION[nag] ?? null;
}

/**
 * Noise band for cross-search comparisons (lila's areSimilarEvals):
 * winning-chance deltas within this margin are considered measurement
 * noise and never trigger an annotation.
 */
export const EVAL_NOISE_BAND = 0.14;

function winningChances(cp: number): number {
  return 2 / (1 + Math.exp(-0.003_682_08 * cp)) - 1;
}

function winningChancesFromEval(ev: {
  score: number;
  scoreType: "cp" | "mate";
}): number {
  if (ev.scoreType === "mate") {
    if (ev.score === 0) return 0;
    return ev.score > 0 ? 1 : -1;
  }
  return winningChances(ev.score);
}

/**
 * Compute the glyph for a played move.
 *
 * `prevEval` is the evaluation of the position BEFORE the move,
 * `playedEval` the evaluation attributed to the played move itself:
 * either the matching PV line from the SAME search of the parent
 * position (sameSearch = true, exact measurement), or the child
 * node's own eval from a separate search (sameSearch = false,
 * subject to the noise band).
 */
export function computeGlyph(
  prevEval: NodeEval | undefined,
  playedEval: NodeEval | undefined,
  color: string | null,
  sameSearch: boolean,
): MoveGlyph | null {
  if (!prevEval || !playedEval || !color) return null;

  const prevChances = winningChancesFromEval(prevEval);
  const playedChances = winningChancesFromEval(playedEval);

  let delta = playedChances - prevChances;
  if (color === "black") delta = -delta;

  if (Math.abs(delta) <= (sameSearch ? 0 : EVAL_NOISE_BAND)) return null;

  if (delta <= -0.3) return GLYPH_DEFS["??"];
  if (delta <= -0.2) return GLYPH_DEFS["?"];
  if (delta <= -0.1) return GLYPH_DEFS["?!"];
  if (delta >= 0.2) return GLYPH_DEFS["!!"];
  if (delta >= 0.1) return GLYPH_DEFS["!"];
  if (delta >= 0.05) return GLYPH_DEFS["!?"];

  return null;
}
