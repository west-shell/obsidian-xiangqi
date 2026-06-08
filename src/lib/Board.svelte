<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Chessground } from "@west-shell/xiangqiground";
  import type { Api } from "@west-shell/xiangqiground/api";
  import type { Config } from "@west-shell/xiangqiground/config";
  import type { DrawShape } from "@west-shell/xiangqiground/draw";
  import type * as cg from "@west-shell/xiangqiground/types";
  import { Chess, type Move, type Square } from "@west-shell/xiangqi.js";
  import type { EventBus } from "../core/event-bus";
  import type { ISettings } from "../types";

  interface Props {
    settings: ISettings;
    fen: string;
    lastMove?: [Square, Square] | null;
    selectedSquare?: Square | null;
    checkColor?: cg.Color | null;
    eventBus: EventBus;
    rotated: boolean;
    variations?: Move[];
    freeMode?: boolean;
    boardWidth?: number;
    userShapes?: DrawShape[];
  }

  let {
    settings,
    fen,
    lastMove = null,
    selectedSquare = null,
    checkColor = null,
    eventBus,
    rotated,
    variations = [],
    freeMode = false,
    boardWidth: boardWidthOverride,
    userShapes = [],
  }: Props = $props();

  let boardWidth = $derived(boardWidthOverride ?? settings.cellSize * 9);
  let boardHeight = $derived((boardWidth * 10) / 9);
  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;
  let turnColor: cg.Color = $derived(fen.split(" ")[1] === "b" ? "black" : "white");
  let turnClass = $derived(
    settings.showTurnBorder ? `turn-${fen.split(" ")[1] === "b" ? "black" : "red"}` : "",
  );
  let _check: cg.Color | false = $derived(checkColor || false);

  function computeDests(fen: string): Map<cg.Key, cg.Key[]> {
    try {
      const chess = new Chess(fen);
      const dests = new Map<cg.Key, cg.Key[]>();
      const moves = chess.moves({ verbose: true }) as Move[];
      for (const move of moves) {
        const orig = move.from;
        const dest = move.to;
        if (!dests.has(orig)) dests.set(orig, []);
        dests.get(orig)!.push(dest);
      }
      return dests;
    } catch {
      return new Map();
    }
  }

  function computeVariationShapes(variations: Move[]): DrawShape[] {
    return variations.map((move) => ({
      orig: move.from,
      dest: move.to,
      brush: "blue",
    }));
  }

  let shapes = $derived(settings.showNextMove ? computeVariationShapes(variations) : []);
  let dests = $derived(computeDests(fen));

  onMount(async () => {
    const events: Config["events"] = freeMode
      ? {
          change: () => {
            if (api) eventBus.emit("fen-updated", api.getFen());
          },
          select: (key) => {
            eventBus.emit("click", key);
          },
        }
      : {
          move: (orig, dest) => {
            try {
              const chess = new Chess(fen);
              const move = chess.move({ from: orig, to: dest });
              if (move) {
                eventBus.emit("runmove", move);
              } else {
                api?.cancelMove();
                eventBus.emit("invalid-move", { from: orig, to: dest });
              }
            } catch {
              api?.cancelMove();
              eventBus.emit("invalid-move", { from: orig, to: dest });
            }
          },
        };

    const config: Config = {
      fen,
      orientation: rotated ? "black" : "white",
      turnColor,
      coordinates: true,
      draggable: { enabled: true },
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
        eraseOnMovablePieceClick: false,
        onChange: (s) => {
          eventBus.emit("user-shapes-changed", s);
        },
      },
      events,
    };

    if (freeMode) {
      config.draggable = { deleteOnDropOff: true };
    }

    config.check = _check;

    if (lastMove) {
      config.lastMove = lastMove;
    }

    if (selectedSquare) {
      config.selected = selectedSquare;
    }

    // 等待容器布局完成，避免 bounds 为 0 时 renderCircle 产生 NaN
    if (!boardElement.offsetWidth) {
      await new Promise<void>((resolve) => {
        const ro = new ResizeObserver(() => {
          if (boardElement.offsetWidth) {
            ro.disconnect();
            resolve();
          }
        });
        ro.observe(boardElement);
      });
    }
    api = Chessground(boardElement, config);

    layoutChangeHandler = () => {
      if (api) {
        api.state.dom.bounds.clear();
        api.state.dom.redraw();
      }
    };
    (activeDocument ?? document).body.addEventListener("xq-layout-change", layoutChangeHandler);
  });

  onDestroy(() => {
    if (layoutChangeHandler) {
      (activeDocument ?? document).body.removeEventListener(
        "xq-layout-change",
        layoutChangeHandler,
      );
    }
    if (api) {
      api.destroy();
    }
  });

  $effect(() => {
    if (!api) return;
    if (freeMode) {
      api.set({ fen, turnColor, check: _check });
    } else {
      api.set({ fen, turnColor, movable: { color: turnColor, dests }, check: _check });
    }
  });

  $effect(() => {
    if (!api) return;
    api.set({ orientation: rotated ? "black" : "white" });
  });

  $effect(() => {
    if (!api) return;
    api.set({ lastMove: lastMove ? lastMove : undefined });
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
    if (selectedSquare) {
      api.selectSquare(selectedSquare, true);
    } else {
      api.selectSquare(null);
    }
  });

  $effect(() => {
    if (!api) return;
    api.set({
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
      highlight: { lastMove: settings.showLastMove },
    });
  });
</script>

<!-- <div class="board-container {turnClass}" style="width: {boardWidth}px height: {boardHeight}px"> -->
<div bind:this={boardElement} class="xq-wrap {turnClass}" style="width:{boardWidth}px"></div>

<!-- </div> -->

<style>
  .xq-wrap {
    height: 100%;
    flex-shrink: 0;
    aspect-ratio: 450 / 500;
    /* border-radius: 2px; */
    /* background-color: yellow; */
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
  }

  .xq-wrap.turn-red {
    box-shadow: 0 0 0.12em 0.15em rgba(255, 50, 50, 0.5);
  }

  .xq-wrap.turn-black {
    box-shadow: 0 0 0.12em 0.15em rgba(0, 0, 0, 0.7);
  }
</style>
