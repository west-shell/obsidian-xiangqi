import type { ChessNode } from "../types";
import { GLYPH_DEFS } from "./winningChances";

/**
 * Lichess study glyph catalog (lila public/glyphs.json) plus the plugin's
 * legacy custom annotations.
 *
 * Standard glyphs are keyed by their NAG number as a string ("16" for $16)
 * and exported as `$n` NAGs. The five legacy custom keys ("+", "-", "=",
 * "bm", "st") are kept verbatim — they round-trip through the private
 * `#a:` comment form and are never written as NAGs, so lichess files and
 * custom marks never bleed into each other.
 */
export type AnnotationCategory = "move" | "position" | "observation" | "custom";

export interface AnnotationGlyph {
  /** Internal key: NAG number as string, or a legacy custom key. */
  key: string;
  /** Standard NAG number; undefined for custom annotations. */
  nag?: number;
  /** Display symbol ("±", "□"); customs keep their lucide icon instead. */
  symbol: string;
  category: AnnotationCategory;
  /** i18n key under "annotation.". */
  nameKey: string;
  /** Badge background colour. */
  color: string;
  /** Lucide icon name (custom annotations only). */
  icon?: string;
}

const entry = (
  nag: number,
  symbol: string,
  category: AnnotationCategory,
  nameKey: string,
  color: string,
): AnnotationGlyph => ({
  key: String(nag),
  nag,
  symbol,
  category,
  nameKey,
  color,
});

/**
 * Menu order follows lichess (move, position, observation); the legacy
 * custom marks come last. Quality glyphs ($1..$6) live in the single
 * `node.glyph` slot and are mutually exclusive; position glyphs replace
 * each other; everything else stacks freely.
 */
export const STUDY_GLYPHS: AnnotationGlyph[] = [
  // -- move quality (exclusive, stored in node.glyph) --
  entry(1, "!", "move", "annotation.good", "#22ac38"),
  entry(2, "?", "move", "annotation.mistake", "#e69f00"),
  entry(3, "!!", "move", "annotation.brilliant", "#168226"),
  entry(4, "??", "move", "annotation.blunder", "#df5353"),
  entry(5, "!?", "move", "annotation.interesting", "#ea45d8"),
  entry(6, "?!", "move", "annotation.dubious", "#56b4e9"),
  // -- move extras (stack freely) --
  entry(7, "□", "move", "annotation.onlyMove", "#7d8590"),
  entry(22, "⨀", "move", "annotation.zugzwang", "#8d6e63"),
  // -- position (mutually exclusive) --
  entry(10, "=", "position", "annotation.equal", "#82c2ef"),
  entry(13, "∞", "position", "annotation.unclear", "#a46de0"),
  entry(14, "⩲", "position", "annotation.wSlightly", "#8fbf4d"),
  entry(15, "⩱", "position", "annotation.bSlightly", "#e8a33d"),
  entry(16, "±", "position", "annotation.wBetter", "#5aa832"),
  entry(17, "∓", "position", "annotation.bBetter", "#d9772f"),
  entry(18, "+−", "position", "annotation.wWinning", "#168226"),
  entry(19, "−+", "position", "annotation.bWinning", "#df5353"),
  // -- observation (stack freely) --
  entry(146, "N", "observation", "annotation.novelty", "#7aa0c4"),
  entry(32, "↑↑", "observation", "annotation.development", "#4fa3a5"),
  entry(36, "↑", "observation", "annotation.initiative", "#cf9c3a"),
  entry(40, "→", "observation", "annotation.attack", "#d95f5f"),
  entry(132, "⇆", "observation", "annotation.counterplay", "#6fa8dc"),
  entry(138, "⊕", "observation", "annotation.timeTrouble", "#b06ac9"),
  entry(44, "=∞", "observation", "annotation.compensation", "#63b0cd"),
  entry(140, "∆", "observation", "annotation.idea", "#8f7fd1"),
  // -- legacy custom annotations (kept verbatim, private #a: format) --
  {
    key: "+",
    symbol: "+",
    category: "custom",
    nameKey: "annotation.w+",
    color: "#22ac38",
    icon: "thumbs-up",
  },
  {
    key: "-",
    symbol: "-",
    category: "custom",
    nameKey: "annotation.b+",
    color: "#df5353",
    icon: "thumbs-down",
  },
  {
    key: "=",
    symbol: "=",
    category: "custom",
    nameKey: "annotation.eq",
    color: "#82c2ef",
    icon: "handshake",
  },
  {
    key: "bm",
    symbol: "bm",
    category: "custom",
    nameKey: "annotation.bm",
    color: "#e69f00",
    icon: "bookmark",
  },
  {
    key: "st",
    symbol: "st",
    category: "custom",
    nameKey: "annotation.br",
    color: "#22ac38",
    icon: "star",
  },
];

export const GLYPH_BY_KEY: Record<string, AnnotationGlyph> = Object.fromEntries(
  STUDY_GLYPHS.map((g) => [g.key, g]),
);

/** Legacy NAGs our old exporter used for custom keys, kept importable. */
const LEGACY_NAG_KEYS: Record<string, string> = {
  $24: "st",
};

const QUALITY_KEYS = new Set(["1", "2", "3", "4", "5", "6"]);

/**
 * Map an imported NAG token ("$16") to an annotation key. Quality NAGs
 * ($1..$6) are excluded — they belong to the node.glyph slot and are
 * handled by nagToGlyph in the parser.
 */
export function nagToAnnotationKey(nag: string): string | null {
  const legacy = LEGACY_NAG_KEYS[nag];
  if (legacy) return legacy;
  const key = nag.replace(/^\$/, "");
  const def = GLYPH_BY_KEY[key];
  return def && def.nag && !QUALITY_KEYS.has(key) ? key : null;
}

/** Whether a node currently carries the given annotation key (menu state). */
export function hasAnnotation(node: ChessNode, key: string): boolean {
  const def = GLYPH_BY_KEY[key];
  if (!def) return false;
  if (QUALITY_KEYS.has(key)) return node.glyph?.symbol === def.symbol;
  return node.annotations?.includes(key) ?? false;
}

/** Add an annotation key during import (dedupe, no exclusivity rules). */
export function pushAnnotation(node: ChessNode, key: string): void {
  if (!GLYPH_BY_KEY[key]) return;
  node.annotations ??= [];
  if (!node.annotations.includes(key)) node.annotations.push(key);
}

/**
 * User toggle from the annotation menu. Quality glyphs swap the single
 * node.glyph slot; position glyphs replace each other; everything else
 * (move extras, observations, custom marks) toggles freely in the array.
 */
export function applyAnnotationToggle(node: ChessNode, key: string): void {
  const def = GLYPH_BY_KEY[key];
  if (!def) return;
  if (QUALITY_KEYS.has(key)) {
    const glyph = GLYPH_DEFS[def.symbol];
    node.glyph = node.glyph?.symbol === def.symbol ? undefined : glyph;
    return;
  }
  if (node.annotations?.includes(key)) {
    node.annotations = node.annotations.filter((k) => k !== key);
    if (node.annotations.length === 0) node.annotations = undefined;
    return;
  }
  if (def.category === "position") {
    node.annotations = [
      ...(node.annotations ?? []).filter(
        (k) => GLYPH_BY_KEY[k]?.category !== "position",
      ),
      key,
    ];
    return;
  }
  pushAnnotation(node, key);
}
