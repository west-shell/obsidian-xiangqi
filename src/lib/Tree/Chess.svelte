<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import PieceBTNs from "../GenFEN/PieceBTNs.svelte";
  import GenFENToolbar from "../GenFEN/Toolbar.svelte";
  import type {
    ChessNode,
    GameSlot,
    IOptions,
    ISettings,
    NodeMap,
    NodeShape,
  } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { cg, DrawShape, Move, Piece, Square } from "../../chess";
  import type ChessPlugin from "../../main";
  import { onMount, tick } from "svelte";
  import { annotationShapes } from "../../utils/glyphs";
  import { badgeBoardSvg } from "../../utils/icon";

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
    if (!node.shapes) return [];
    return node.shapes.map((s: NodeShape) => ({
      orig: s.orig as cg.Key,
      dest: s.dest as cg.Key | undefined,
      brush: BRUSH_REV[s.brush] ?? s.brush,
    }));
  }

  function saveShapes(node: ChessNode, shapes: DrawShape[]) {
    node.shapes = shapes.map((s) => ({
      orig: s.orig,
      dest: s.dest,
      brush: BRUSH_MAP[s.brush ?? "green"] ?? s.brush,
    }));
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
    games?: GameSlot[];
    currentGameIndex?: number;
    isBlockMode?: boolean;
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
    games = [],
    currentGameIndex = 0,
    isBlockMode = false,
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
    const ann = node.annotation;
    if (ann && dest) {
      const svg = badgeBoardSvg(ann, shapes.filter((s) => s.customSvg).length);
      if (svg) {
        shapes.push({
          orig: dest as DrawShape["orig"],
          brush: "",
          customSvg: { html: svg },
        });
      }
    }
    if (node.isCheckmate && dest) {
      const svg = badgeBoardSvg("checkmate");
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
    <Tree
      {nodeMap}
      {eventBus}
      {currentNode}
      {currentPath}
      {settings}
      {games}
      {currentGameIndex}
      {isBlockMode}
    />
  </div>
{/if}

<style>
  .xq-layout {
    --red: #861818;
    --black: #000080;
  }
</style>
