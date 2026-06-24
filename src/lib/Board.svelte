<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    type Api,
    type cg,
    Chess,
    Chessground,
    type Config,
    type DrawShape,
    type Move,
    type Square,
  } from "../chess";
  import type { EventBus } from "../core/event-bus";
  import type { ISettings } from "../types";

  interface Props {
    settings: ISettings;
    fen: string;
    lastMove?: [Square, Square] | null;
    selectedSquare?: Square | null;
    eventBus: EventBus;
    rotated: boolean;
    checkColor?: cg.Color | null;
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
    eventBus,
    rotated,
    checkColor = null,
    variations = [],
    freeMode = false,
    boardWidth: boardWidthOverride,
    userShapes = [],
  }: Props = $props();

  let boardWidth = $derived(boardWidthOverride ?? settings.cellSize * 9);
  let boardHeight = $derived((boardWidth * 10) / 9);
  // oxlint-disable-next-line no-unassigned-vars
  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;

  let turnColor: cg.Color = $derived(
    fen.split(" ")[1] === "b" ? "black" : "white",
  );
  let turnClass = $derived(
    settings.showTurnBorder
      ? `turn-${fen.split(" ")[1] === "b" ? "black" : "white"}`
      : "",
  );
  let _check: cg.Color | false = $derived(checkColor || false);
  // 响应式 chess 引擎实例，确保 move 回调始终使用最新 fen
  let chessEngine = $state(new Chess(fen));
  $effect(() => {
    chessEngine = new Chess(fen);
  });

  function computeDests(fen: string): Map<cg.Key, cg.Key[]> {
    try {
      const chess = new Chess(fen);
      const dests = new Map<cg.Key, cg.Key[]>();
      const moves = chess.moves({ verbose: true }) as Move[];
      for (const move of moves) {
        const orig = move.from;
        const dest = move.to;
        if (!dests.has(orig)) {
          dests.set(orig, []);
        }
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

  let shapes = $derived(
    settings.showNextMove ? computeVariationShapes(variations) : [],
  );
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
              const move = chessEngine.move({ from: orig, to: dest });
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
      viewOnly: settings.viewOnly ?? false,
      movable: freeMode
        ? { free: true, color: "both" }
        : {
            free: false,
            color: turnColor,
            showDests: true,
            dests,
          },
      highlight: freeMode
        ? { lastMove: false }
        : {
            lastMove: settings.showLastMove,
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
      ...(_check ? { check: _check } : {}),
      ...(lastMove ? { lastMove } : {}),
      ...(selectedSquare ? { selected: selectedSquare } : {}),
    };

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
      api.set({ fen, turnColor, check: _check });
    } else {
      api.set({
        fen,
        turnColor,
        movable: { color: turnColor, dests },
        check: _check,
      });
    }
    api.selectSquare(null);
  });

  $effect(() => {
    if (!api) return;
    api.set({ orientation: rotated ? "black" : "white" });
  });

  $effect(() => {
    if (!api) return;
    api.set({
      lastMove: lastMove ? lastMove : undefined,
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
    if (selectedSquare) {
      api.selectSquare(selectedSquare, true);
    } else {
      api.selectSquare(null);
    }
  });

  $effect(() => {
    if (!api) return;
    const cfg: Config = {
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
    };
    if (!freeMode) {
      cfg.highlight = { lastMove: settings.showLastMove };
    }
    api.set(cfg);
  });
</script>

<div class="board-area {turnClass}" style="width:{boardWidth * 1.12}px ;height:{boardHeight * 1.12}px">
  <div bind:this={boardElement} class="xq-wrap"></div>
</div>

<style>
  .board-area {
    display: flex;
    justify-content: center;
    align-items: center;
    background:
      var(--xq-board-texture, none) center / cover no-repeat,
      var(--xq-board-bg, #d0b899);
  }
  .xq-wrap {
    width: 97%;
    height: auto;
    aspect-ratio: 450 / 500;
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
  }

  .board-area.turn-white {
    box-shadow: 0 0 0.12em 0.15em var(--xq-piece-red, var(--color-red));
  }

  .board-area.turn-black {
    box-shadow: 0 0 0.15em 0.15em var(--xq-piece-black, var(--color-blue));
  }
</style>
