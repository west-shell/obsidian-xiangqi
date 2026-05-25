<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Chessground } from "@west-shell/chessground-xq";
  import type { Api } from "@west-shell/chessground-xq/api";
  import type { Config } from "@west-shell/chessground-xq/config";
  import type { DrawShape } from "@west-shell/chessground-xq/draw";
  import { pos2key, key2pos } from "@west-shell/chessground-xq/util";
  import type * as cg from "@west-shell/chessground-xq/types";
  import { genFENFromBoard } from "../utils/parse";
  import { isValidMove } from "../utils/rules";
  import type { ITurn } from "../types";
  import type { EventBus } from "../core/event-bus";
  import type { IBoard, IMove, IPosition, ISettings } from "../types";

  interface Props {
    settings: ISettings;
    board: IBoard;
    lastMove?: IMove | null;
    markedPos?: IPosition | null;
    currentTurn: ITurn;
    eventBus: EventBus;
    rotated: boolean;
    variations?: IMove[];
    freeMode?: boolean;
    boardWidth?: number;
    userShapes?: DrawShape[];
  }

  let {
    settings,
    board,
    lastMove = null,
    markedPos = null,
    currentTurn,
    eventBus,
    rotated,
    variations = [],
    freeMode = false,
    boardWidth: boardWidthOverride,
    userShapes = [],
  }: Props = $props();

  let boardWidth = $derived(boardWidthOverride ?? settings.cellSize * 9);

  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;
  let fen = $derived(genFENFromBoard(board, currentTurn));
  let turnColor: cg.Color = $derived(
    currentTurn === "black" ? "black" : "white",
  );

  // Our internal coords: y=0 top, y=9 bottom
  // Chessground: y=0 bottom, y=9 top
  function toKey(pos: IPosition): cg.Key {
    return pos2key([pos.x, 9 - pos.y])!;
  }

  function toPos(key: cg.Key): IPosition {
    const [x, y] = key2pos(key);
    return { x, y: 9 - y };
  }

  function computeDests(board: IBoard, turn: ITurn): Map<cg.Key, cg.Key[]> {
    const dests = new Map<cg.Key, cg.Key[]>();
    for (let x = 0; x < 9; x++) {
      for (let y = 0; y < 10; y++) {
        const piece = board[x][y];
        if (!piece) continue;
        const isRed = piece === piece.toUpperCase();
        if ((turn === "red" && !isRed) || (turn === "black" && isRed)) continue;

        const from: IPosition = { x, y };
        const keys: cg.Key[] = [];
        for (let tx = 0; tx < 9; tx++) {
          for (let ty = 0; ty < 10; ty++) {
            if (tx === x && ty === y) continue;
            if (isValidMove(from, { x: tx, y: ty }, board)) {
              keys.push(toKey({ x: tx, y: ty }));
            }
          }
        }
        if (keys.length > 0) {
          dests.set(toKey(from), keys);
        }
      }
    }
    return dests;
  }

  function computeVariationShapes(variations: IMove[]): DrawShape[] {
    return variations.map((move) => ({
      orig: toKey(move.from),
      dest: toKey(move.to),
      brush: "paleBlue",
    }));
  }

  let shapes = $derived(computeVariationShapes(variations));
  let dests = $derived(computeDests(board, currentTurn));

  onMount(async () => {
    const events: Config["events"] = freeMode
      ? {
          change: () => {
            if (api) eventBus.emit("fen-updated", api.getFen());
          },
          select: (key) => {
            eventBus.emit("click", toPos(key));
          },
        }
      : {
          move: (orig, dest) => {
            const from = toPos(orig);
            const to = toPos(dest);

            if (isValidMove(from, to, board)) {
              eventBus.emit("runmove", {
                from,
                to,
              } as IMove);
            } else {
              api?.cancelMove();
              eventBus.emit("invalid-move", { from: orig, to: dest });
            }
          },
        };

    const config: Config = {
      fen,
      orientation: rotated ? "black" : "white",
      turnColor,
      coordinates: settings.showCoordinateLabels,
      viewOnly: settings.viewOnly ?? false,
      movable: freeMode
        ? { free: true, color: "both" }
        : {
            free: false,
            color: turnColor,
            showDests: true,
            dests,
          },
      highlight: {
        lastMove: settings.showLastMove,
        check: true,
      },
      drawable: {
        enabled: true,
        visible: true,
        shapes: userShapes,
        autoShapes: shapes,
        onChange: (s) => {
          eventBus.emit("user-shapes-changed", s);
        },
      },
      events,
    };

    if (freeMode) {
      config.draggable = { deleteOnDropOff: true };
    }

    if (lastMove) {
      config.lastMove = [toKey(lastMove.from), toKey(lastMove.to)];
    }

    if (markedPos) {
      config.selected = toKey(markedPos);
    }

    api = Chessground(boardElement, config);

    layoutChangeHandler = () => {
      if (api) {
        api.state.dom.bounds.clear();
        api.state.dom.redraw();
      }
    };
    document.body.addEventListener("xq-layout-change", layoutChangeHandler);
  });

  onDestroy(() => {
    if (layoutChangeHandler) {
      document.body.removeEventListener("xq-layout-change", layoutChangeHandler);
    }
    if (api) {
      api.destroy();
    }
  });

  $effect(() => {
    if (!api) return;
    if (freeMode) {
      api.set({ fen, turnColor });
    } else {
      api.set({ fen, turnColor, movable: { color: turnColor, dests } });
    }
  });

  $effect(() => {
    if (!api) return;
    api.set({ orientation: rotated ? "black" : "white" });
  });

  $effect(() => {
    if (!api) return;
    api.set({
      lastMove: lastMove ? [toKey(lastMove.from), toKey(lastMove.to)] : undefined,
    });
  });

  $effect(() => {
    if (!api) return;
    api.set({ drawable: { autoShapes: shapes } });
  });

  $effect(() => {
    if (!api) return;
    api.setShapes(userShapes);
  });

  $effect(() => {
    if (!api || freeMode) return;
    void board;
    if (markedPos) {
      api.selectSquare(toKey(markedPos), true);
    } else {
      api.selectSquare(null);
    }
  });

  $effect(() => {
    if (!api) return;
    api.set({
      coordinates: settings.showCoordinateLabels,
      viewOnly: settings.viewOnly ?? false,
      highlight: { lastMove: settings.showLastMove },
    });
  });
</script>

<div
  bind:this={boardElement}
  class="cg-wrap"
  style="width: {boardWidth}px"
></div>

<style>
  .cg-wrap {
    height: 100%;
    flex-shrink: 0;
    aspect-ratio: 450 / 500;
  }
</style>
