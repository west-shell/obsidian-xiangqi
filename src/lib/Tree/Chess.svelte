<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import PieceBTNs from "../GenFEN/PieceBTNs.svelte";
  import GenFENToolbar from "../GenFEN/Toolbar.svelte";
  import type { ChessNode, IOptions, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { cg, DrawShape, Move, Piece, Square } from "../../chess";
  import type ChessPlugin from "../../main";
  import { onMount, tick } from "svelte";
  import { annotationShapes } from "../../utils/glyphs";

  const SHAPES_RE = /^([a-i][0-9])([a-i][0-9])?:([gryb])$/;
  const BRUSH_MAP: Record<string, string> = {
    green: "g",
    red: "r",
    blue: "b",
    yellow: "y",
  };
  const BRUSH_REV: Record<string, string> = {
    g: "green",
    r: "red",
    b: "blue",
    y: "yellow",
  };

  function loadShapes(node: ChessNode): DrawShape[] {
    if (!node.comments) return [];
    const shapes: DrawShape[] = [];
    for (const c of node.comments) {
      const m = c.match(SHAPES_RE);
      if (m) {
        const brush = BRUSH_REV[m[3]];
        shapes.push({
          orig: m[1] as cg.Key,
          dest: m[2] as cg.Key | undefined,
          brush,
        });
      }
    }
    return shapes;
  }

  /** Convert DrawShape[] to comment strings and save to node */
  function saveShapes(node: ChessNode, shapes: DrawShape[]) {
    const shapeComments = shapes.map(
      (s) => s.orig + (s.dest ?? "") + ":" + BRUSH_MAP[s.brush ?? "green"],
    );
    node.comments = [
      ...(node.comments ?? []).filter((c) => !SHAPES_RE.test(c)),
      ...shapeComments,
    ];
  }

  const ALL_ANNOTATION_KEYS = ["W+", "B+", "=", "?", "!", "W#", "B#", "=#"];
  function getPrimaryAnnotation(node: ChessNode): string | undefined {
    return node.comments?.find((c) => ALL_ANNOTATION_KEYS.includes(c));
  }

  const ANNOTATION_BG: Record<string, string> = {
    "W+": "#22ac38",
    "B+": "#df5353",
    "=": "#82c2ef",
    "?": "#e69f00",
    "!": "#22ac38",
    "W#": "#bbb",
    "B#": "#333",
    "=#": "#6e7781",
  };

  const ANNOTATION_ICONS: Record<string, string[]> = {
    "thumbs-up": [
      "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
      "M7 10v12",
    ],
    "thumbs-down": [
      "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",
      "M17 14V2",
    ],
    handshake: [
      "m11 17 2 2a1 1 0 1 0 3-3",
      "m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4",
      "m21 3 1 11h-2",
      "M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3",
      "M3 4h8",
    ],
    bookmark: [
      "M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",
    ],
    star: [
      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    ],
  };

  const ANNOTATION_ICON_MAP: Record<string, string> = {
    "W+": "thumbs-up",
    "B+": "thumbs-down",
    "=": "handshake",
    "?": "bookmark",
    "!": "star",
    "W#": "thumbs-up",
    "B#": "thumbs-down",
    "=#": "handshake",
  };

  function annotationGlyphSvg(key: string, stack: number): string {
    const bg = ANNOTATION_BG[key];
    const iconName = ANNOTATION_ICON_MAP[key];
    const paths = iconName ? ANNOTATION_ICONS[iconName] : undefined;
    if (!bg) return "";
    const x = -12;
    const y = 68;
    let inner = "";
    if (paths) {
      inner = paths
        .map(
          (d) => `<path fill="none" stroke="#fff" stroke-width="2" d="${d}"/>`,
        )
        .join("");
    }
    return `<g transform="matrix(.4 0 0 .4 ${x} ${y})"><circle cx="50" cy="50" r="50" fill="${bg}"/><g transform="translate(14,14) scale(3)">${inner}</g></g>`;
  }

  interface Props {
    settings: ISettings;
    fen: string;
    eventBus: EventBus;
    nodeMap: NodeMap;
    currentNode: ChessNode;
    currentPath: string[];
    options: IOptions;
    editing?: boolean;
    selectedPiece?: Piece | null;
    isFenMode?: boolean;
    plugin?: ChessPlugin;
  }

  let {
    settings,
    fen,
    eventBus,
    nodeMap,
    currentNode,
    currentPath,
    options,
    editing = false,
    selectedPiece = null,
    isFenMode = false,
    plugin,
  }: Props = $props();

  let lastMove: [Square, Square] | null = $derived(
    currentNode.move ? [currentNode.move.from, currentNode.move.to] : null,
  );
  let rotated = $state((() => options?.rotated ?? false)());
  let mainVariation = $derived(
    currentNode.children.length > 0 && currentNode.children[0].move
      ? [currentNode.children[0].move]
      : [],
  );
  let otherVariations = $derived(
    currentNode.children
      .slice(1)
      .map((child) => child.move)
      .filter((m): m is Move => m != null) ?? [],
  );
  let checkColor = $derived(
    currentNode.move &&
      (currentNode.move.isCheck || currentNode.move.isCheckmate)
      ? currentNode.move.color === "w"
        ? "black"
        : "white"
      : null,
  ) as "white" | "black" | null;
  let userShapes = $derived(loadShapes(currentNode));
  let engineBestMove: { from: Square; to: Square } | null = $state(null);
  let enginePonder: { from: Square; to: Square } | null = $state(null);

  let glyphShapes = $derived.by(() => {
    if (!settings.showMoveAnnotations) return [];
    const node = currentNode;
    const shapes: DrawShape[] = [];
    // In xiangqi, no castling — use move.to directly as dest
    const dest = node.move ? node.move.to : undefined;
    if (node.glyph && dest) {
      const engineShapes = annotationShapes(dest, node.glyph);
      shapes.push(...engineShapes);
    }
    const ann = getPrimaryAnnotation(node);
    if (ann && dest) {
      const svg = annotationGlyphSvg(
        ann,
        shapes.filter((s) => s.customSvg).length,
      );
      if (svg) {
        shapes.push({
          orig: dest as DrawShape["orig"],
          brush: "",
          customSvg: { html: svg },
        });
      }
    }
    if (node.isCheckmate && dest) {
      const crownPaths = ["M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"];
      const inner = crownPaths
        .map(
          (d) => `<path fill="none" stroke="#fff" stroke-width="2" d="${d}"/>`,
        )
        .join("");
      const svg = `<g transform="matrix(.4 0 0 .4 -12 -12)"><circle cx="50" cy="50" r="50" fill="#df5353"/><g transform="translate(14,14) scale(3)">${inner}</g></g>`;
      shapes.push({
        orig: dest as DrawShape["orig"],
        brush: "",
        customSvg: { html: svg },
      });
    }
    return shapes;
  });

  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });

  $effect(() => {
    eventBus.on<{
      bestmove: string;
      ponder?: string;
      score?: number;
      depth?: number;
    } | null>("engine-result", (result) => {
      if (result) {
        const from = result.bestmove.slice(0, 2) as Square;
        const to = result.bestmove.slice(2, 4) as Square;
        engineBestMove = { from, to };
        if (result.ponder) {
          enginePonder = {
            from: result.ponder.slice(0, 2) as Square,
            to: result.ponder.slice(2, 4) as Square,
          };
        } else {
          enginePonder = null;
        }
      } else {
        engineBestMove = null;
        enginePonder = null;
      }
    });
    eventBus.on("clear-engine-bestmove", () => {
      engineBestMove = null;
      enginePonder = null;
    });
  });

  $effect(() => {
    eventBus.on<DrawShape[]>("user-shapes-changed", (shapes) => {
      saveShapes(currentNode, shapes ?? []);
      eventBus.emit("modified", null);
      eventBus.emit("updateUI", null);
    });
  });

  $effect(() => {
    eventBus.on("rotate", () => {
      rotated = !rotated;
    });
  });
</script>

{#if editing}
  <div class="xq-layout xq-layout--genfen">
    <Board
      {settings}
      {fen}
      {eventBus}
      {rotated}
      freeMode={true}
      {mainVariation}
      {otherVariations}
    />
    <PieceBTNs {fen} {eventBus} {selectedPiece} />
    <GenFENToolbar
      {eventBus}
      currentTurn={fen.split(" ")[1] === "b" ? "black" : "white"}
      {isFenMode}
    />
  </div>
{:else}
  <div class="xq-layout">
    <Board
      {settings}
      {fen}
      {lastMove}
      {checkColor}
      {eventBus}
      {rotated}
      {mainVariation}
      {otherVariations}
      {userShapes}
      {engineBestMove}
      {enginePonder}
      {glyphShapes}
    />
    <Toolbar {eventBus} {options} {settings} {plugin} {rotated} />
    <Tree {nodeMap} {eventBus} {currentNode} {currentPath} {settings} />
  </div>
{/if}

<style>
  .xq-layout {
    --red: #861818;
    --black: #000080;
  }
</style>
