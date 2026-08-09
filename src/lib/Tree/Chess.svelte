<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import PieceBTNs from "../GenFEN/PieceBTNs.svelte";
  import GenFENToolbar from "../GenFEN/Toolbar.svelte";
  import type { ChessNode, IOptions, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { cg, DrawShape, Move, Piece, Square } from "../../chess";
  import { onMount, tick } from "svelte";

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
  }: Props = $props();

  let lastMove: [Square, Square] | null = $derived(
    currentNode.move ? [currentNode.move.from, currentNode.move.to] : null,
  );
  let rotated = $state((() => options.rotated ?? false)());
  let variations = $derived(
    currentNode.children
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
    <Board {settings} {fen} {eventBus} {rotated} freeMode={true} />
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
      {variations}
      {userShapes}
      {engineBestMove}
      {enginePonder}
    />
    <Toolbar {eventBus} {fen} {options} />
    <Tree {nodeMap} {eventBus} {currentNode} {currentPath} {settings} />
  </div>
{/if}

<style>
  .xq-layout {
    --red: #861818;
    --black: #000080;
  }
</style>
