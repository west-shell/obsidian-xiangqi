import type { ChessNode } from "../types";
import { GLYPH_DEFS } from "./winningChances";

/**
 * Lichess study glyph catalog (lila public/glyphs.json) plus the plugin's
 * legacy custom annotations. Trimmed to the essentials: move quality
 * ($1..$6), the four position glyphs ($10, $13, $16, $17) and the legacy
 * custom marks — observation glyphs, move extras and the graded/winning
 * position variants are intentionally omitted.
 *
 * Standard glyphs are keyed by their NAG number as a string ("16" for $16)
 * and exported as `$n` NAGs. The five legacy custom keys ("+", "-", "=",
 * "bm", "st") are kept verbatim — they round-trip through the private
 * `#a:` comment form and are never written as NAGs, so lichess files and
 * custom marks never bleed into each other.
 */
export type AnnotationCategory = "move" | "position" | "custom";

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
 * Menu order: move quality first, then position, then the legacy custom
 * marks. Quality glyphs ($1..$6) live in the single `node.glyph` slot and
 * are mutually exclusive; position glyphs replace each other; custom
 * marks toggle freely.
 */
export const STUDY_GLYPHS: AnnotationGlyph[] = [
  // -- move quality (exclusive, stored in node.glyph) --
  entry(1, "!", "move", "annotation.good", "#22ac38"),
  entry(2, "?", "move", "annotation.mistake", "#e69f00"),
  entry(3, "!!", "move", "annotation.brilliant", "#168226"),
  entry(4, "??", "move", "annotation.blunder", "#df5353"),
  entry(5, "!?", "move", "annotation.interesting", "#ea45d8"),
  entry(6, "?!", "move", "annotation.dubious", "#56b4e9"),
  // -- position (mutually exclusive, trimmed to the four essentials) --
  // Badge colours mirror lila's prerendered set (ui/lib/src/game/glyphs.ts).
  entry(10, "=", "position", "annotation.equal", "#82c2ef"),
  entry(13, "∞", "position", "annotation.unclear", "#f5918f"),
  entry(16, "±", "position", "annotation.wBetter", "#aaa"),
  entry(17, "∓", "position", "annotation.bBetter", "#444"),
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
 * node.glyph slot; position glyphs replace each other; custom marks
 * toggle freely in the array.
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
